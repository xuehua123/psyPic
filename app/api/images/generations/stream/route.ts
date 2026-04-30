import type { ImageGenerationParams } from "@/lib/validation/image-params";
import { parseGenerationParams } from "@/lib/validation/image-params";
import { createRequestId, jsonError } from "@/server/services/api-response";
import { getKeyBinding, getSession } from "@/server/services/dev-store";
import {
  createImageTask,
  getImageTaskConcurrencyState,
  markImageTaskFailed,
  markImageTaskRunning,
  markImageTaskSucceeded
} from "@/server/services/image-task-service";
import { decryptKeyBindingSecret } from "@/server/services/key-binding-service";
import { readSessionIdFromRequest } from "@/server/services/session-service";
import {
  getSub2APITimeoutMs,
  normalizeUsage,
  requestImageGenerationStreamWithSub2API,
  Sub2APIError,
  type Sub2APIUsage
} from "@/server/services/sub2api-client";
import { createTempAssetFromBase64 } from "@/server/services/temp-asset-service";

type StreamOptions = {
  partialImages: number;
};

type ParsedStreamRequest =
  | {
      success: true;
      params: ImageGenerationParams;
      options: StreamOptions;
    }
  | {
      success: false;
      error: {
        code: "invalid_parameter";
        message: string;
        field: string;
      };
    };

type SseController = ReadableStreamDefaultController<Uint8Array>;
type SseRecord = Record<string, unknown>;

const encoder = new TextEncoder();

export async function POST(request: Request) {
  const requestId = createRequestId();
  const sessionId = readSessionIdFromRequest(request);
  const session = sessionId ? getSession(sessionId) : null;

  if (!session) {
    return jsonError({
      status: 401,
      code: "unauthorized",
      message: "请先导入或配置 Sub2API Key",
      requestId
    });
  }

  const binding = getKeyBinding(session.key_binding_id);

  if (!binding || binding.status !== "active") {
    return jsonError({
      status: 403,
      code: "forbidden",
      message: "当前 session 没有关联可用 key binding",
      requestId
    });
  }

  const parsed = parseStreamRequest(await request.json().catch(() => null));

  if (!parsed.success) {
    return jsonError({
      status: 400,
      code: parsed.error.code,
      message: parsed.error.message,
      field: parsed.error.field,
      requestId
    });
  }

  if (parsed.params.n > binding.limits.max_n) {
    return jsonError({
      status: 400,
      code: "invalid_parameter",
      message: `数量不能超过 ${binding.limits.max_n}`,
      field: "n",
      requestId
    });
  }

  const concurrency = getImageTaskConcurrencyState(session.user_id);

  if (concurrency.limited) {
    return jsonError({
      status: 429,
      code: "rate_limited",
      message: "当前有图片任务正在运行，请等待完成或取消后重试。",
      requestId
    });
  }

  const startedAt = Date.now();
  const task = createImageTask({
    userId: session.user_id,
    keyBindingId: binding.id,
    type: "generation",
    prompt: parsed.params.prompt,
    params: parsed.params
  });
  markImageTaskRunning(task.id);

  const abortController = new AbortController();
  const timeout = setTimeout(
    () => abortController.abort(),
    getSub2APITimeoutMs()
  );

  try {
    const upstream = await requestImageGenerationStreamWithSub2API({
      baseUrl: binding.sub2api_base_url,
      apiKey: decryptKeyBindingSecret(binding),
      params: parsed.params,
      partialImages: parsed.options.partialImages,
      signal: abortController.signal
    });

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(
          encodeSse("task_started", {
            task_id: task.id,
            status: "running",
            request_id: requestId,
            upstream_request_id: upstream.upstreamRequestId
          })
        );

        try {
          await pipeUpstreamImageEvents({
            controller,
            response: upstream.response,
            taskId: task.id,
            userId: session.user_id,
            params: parsed.params,
            startedAt,
            upstreamRequestId: upstream.upstreamRequestId
          });
        } catch (error) {
          const streamError =
            error instanceof Sub2APIError
              ? error
              : new Sub2APIError({
                  status: 502,
                  code: "upstream_error",
                  message: error instanceof Error ? error.message : "图片生成流失败",
                  upstreamRequestId: upstream.upstreamRequestId
                });

          markImageTaskFailed(task.id, {
            code: streamError.code,
            message: streamError.message,
            durationMs: Date.now() - startedAt,
            upstreamRequestId: streamError.upstreamRequestId
          });
          controller.enqueue(
            encodeSse("error", {
              task_id: task.id,
              code: streamError.code,
              message: streamError.message,
              request_id: requestId,
              upstream_request_id: streamError.upstreamRequestId
            })
          );
        } finally {
          clearTimeout(timeout);
          controller.close();
        }
      },
      cancel() {
        clearTimeout(timeout);
        abortController.abort();
      }
    });

    return new Response(stream, {
      headers: {
        "cache-control": "no-store, no-transform",
        connection: "keep-alive",
        "content-type": "text/event-stream; charset=utf-8",
        "x-accel-buffering": "no"
      }
    });
  } catch (error) {
    clearTimeout(timeout);

    if (error instanceof Sub2APIError) {
      markImageTaskFailed(task.id, {
        code: error.code,
        message: error.message,
        durationMs: Date.now() - startedAt,
        upstreamRequestId: error.upstreamRequestId
      });

      return jsonError({
        status: error.status,
        code: error.code,
        message: error.message,
        requestId,
        upstreamRequestId: error.upstreamRequestId
      });
    }

    markImageTaskFailed(task.id, {
      code: "upstream_error",
      message: "图片生成流启动失败",
      durationMs: Date.now() - startedAt
    });

    return jsonError({
      status: 502,
      code: "upstream_error",
      message: "图片生成流启动失败",
      requestId
    });
  }
}

function parseStreamRequest(input: unknown): ParsedStreamRequest {
  if (!isRecord(input)) {
    return {
      success: false,
      error: {
        code: "invalid_parameter",
        message: "请求体必须是 JSON 对象",
        field: "request"
      }
    };
  }

  const partialImages = input.partial_images ?? 1;

  if (
    typeof partialImages !== "number" ||
    !Number.isInteger(partialImages) ||
    partialImages < 0 ||
    partialImages > 3
  ) {
    return {
      success: false,
      error: {
        code: "invalid_parameter",
        message: "partial_images 必须是 0 到 3 的整数",
        field: "partial_images"
      }
    };
  }

  const paramsInput = { ...input };
  delete paramsInput.stream;
  delete paramsInput.partial_images;
  const parsed = parseGenerationParams(paramsInput);

  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: parsed.error.code,
        message: parsed.error.message,
        field: parsed.error.details.field
      }
    };
  }

  return {
    success: true,
    params: parsed.data,
    options: {
      partialImages
    }
  };
}

async function pipeUpstreamImageEvents(input: {
  controller: SseController;
  response: Response;
  taskId: string;
  userId: string;
  params: ImageGenerationParams;
  startedAt: number;
  upstreamRequestId?: string;
}) {
  if (!input.response.body) {
    throw new Sub2APIError({
      status: 502,
      code: "upstream_error",
      message: "Sub2API 未返回可读取的图片生成流",
      upstreamRequestId: input.upstreamRequestId
    });
  }

  const reader = input.response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;

  while (!completed) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split(/\r?\n\r?\n/);
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      completed =
        (await handleUpstreamSseBlock({
          ...input,
          block: part
        })) || completed;
    }
  }

  if (!completed && buffer.trim()) {
    completed = await handleUpstreamSseBlock({
      ...input,
      block: buffer
    });
  }

  if (!completed) {
    throw new Sub2APIError({
      status: 502,
      code: "upstream_error",
      message: "图片生成流提前结束",
      upstreamRequestId: input.upstreamRequestId
    });
  }
}

async function handleUpstreamSseBlock(input: {
  controller: SseController;
  block: string;
  taskId: string;
  userId: string;
  params: ImageGenerationParams;
  startedAt: number;
  upstreamRequestId?: string;
}) {
  const event = parseSseBlock(input.block);

  if (!event.data || event.data === "[DONE]") {
    return false;
  }

  const payload = parseJsonRecord(event.data);
  const type = readString(payload, "type") ?? event.event;

  if (type === "image_generation.partial_image") {
    const b64Json = readString(payload, "b64_json");

    if (!b64Json) {
      return false;
    }

    const asset = await createTempAssetFromBase64({
      userId: input.userId,
      taskId: input.taskId,
      b64Json,
      format: input.params.output_format
    });
    input.controller.enqueue(
      encodeSse("partial_image", {
        task_id: input.taskId,
        index: readNumber(payload, "partial_image_index") ?? 0,
        asset_id: asset.id,
        url: `/api/assets/${asset.id}`,
        format: input.params.output_format
      })
    );

    return false;
  }

  if (type === "image_generation.completed") {
    const images = await Promise.all(
      extractB64Images(payload).map(async (b64Json) => {
        const asset = await createTempAssetFromBase64({
          userId: input.userId,
          taskId: input.taskId,
          b64Json,
          format: input.params.output_format
        });

        return {
          asset_id: asset.id,
          url: `/api/assets/${asset.id}`,
          width: asset.width,
          height: asset.height,
          format: input.params.output_format
        };
      })
    );
    const usage = normalizeUsage(readUsage(payload));
    const durationMs = Date.now() - input.startedAt;

    markImageTaskSucceeded(input.taskId, {
      images,
      usage,
      durationMs,
      upstreamRequestId: input.upstreamRequestId
    });
    input.controller.enqueue(
      encodeSse("completed", {
        task_id: input.taskId,
        images,
        usage,
        duration_ms: durationMs
      })
    );

    return true;
  }

  if (type === "error") {
    throw new Sub2APIError({
      status: 502,
      code: readString(payload, "code") ?? "upstream_error",
      message: readString(payload, "message") ?? "图片生成流失败",
      upstreamRequestId: input.upstreamRequestId
    });
  }

  return false;
}

function parseSseBlock(block: string) {
  const lines = block.split(/\r?\n/);
  const data: string[] = [];
  let event = "";

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    }

    if (line.startsWith("data:")) {
      data.push(line.slice("data:".length).trim());
    }
  }

  return {
    event,
    data: data.join("\n")
  };
}

function encodeSse(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function extractB64Images(payload: SseRecord | null) {
  const directImage = readString(payload, "b64_json");

  if (directImage) {
    return [directImage];
  }

  const data = payload?.data;

  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((item) => (isRecord(item) ? readString(item, "b64_json") : undefined))
    .filter((item): item is string => typeof item === "string");
}

function readUsage(payload: SseRecord | null): Sub2APIUsage | undefined {
  const usage = payload?.usage;

  return isRecord(usage) ? usage : undefined;
}

function parseJsonRecord(input: string) {
  try {
    const parsed = JSON.parse(input);

    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readString(input: SseRecord | null, key: string) {
  const value = input?.[key];

  return typeof value === "string" ? value : undefined;
}

function readNumber(input: SseRecord | null, key: string) {
  const value = input?.[key];

  return typeof value === "number" ? value : undefined;
}

function isRecord(input: unknown): input is SseRecord {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

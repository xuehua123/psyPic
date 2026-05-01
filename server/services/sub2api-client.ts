import type { ImageGenerationParams } from "@/lib/validation/image-params";
import { redactSensitiveValue } from "@/server/services/key-binding-service";

const DEFAULT_SUB2API_TIMEOUT_MS = 300000;

export type Sub2APIImage = {
  b64_json: string;
};

export type Sub2APIUsage = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  estimated_cost?: string;
};

export type Sub2APIGenerationResponse = {
  images: Sub2APIImage[];
  usage: Required<Sub2APIUsage>;
  upstreamRequestId?: string;
};

export type Sub2APIStreamResponse = {
  response: Response;
  upstreamRequestId?: string;
};

export class Sub2APIError extends Error {
  code: string;
  status: number;
  upstreamRequestId?: string;

  constructor(input: {
    code: string;
    status: number;
    message: string;
    upstreamRequestId?: string;
  }) {
    super(redactSensitiveValue(input.message));
    this.name = "Sub2APIError";
    this.code = input.code;
    this.status = input.status;
    this.upstreamRequestId = input.upstreamRequestId;
  }
}

export async function generateImageWithSub2API(input: {
  baseUrl: string;
  apiKey: string;
  params: ImageGenerationParams;
  timeoutMs?: number;
}): Promise<Sub2APIGenerationResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    input.timeoutMs ?? getSub2APITimeoutMs()
  );

  try {
    const response = await fetch(buildGenerationUrl(input.baseUrl), {
      method: "POST",
      redirect: "manual",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${input.apiKey}`
      },
      body: JSON.stringify(buildGenerationPayload(input.params)),
      signal: controller.signal
    });
    const upstreamRequestId =
      response.headers.get("x-request-id") ??
      response.headers.get("x-openai-request-id") ??
      undefined;
    const body = await response.json().catch(() => ({}));

    if (isRedirectStatus(response.status)) {
      throw new Sub2APIError({
        status: 502,
        code: "upstream_redirect",
        message: redirectErrorMessage(),
        upstreamRequestId
      });
    }

    if (!response.ok) {
      throw new Sub2APIError({
        status: response.status,
        code: mapStatusToCode(response.status),
        message: extractErrorMessage(body, response.status),
        upstreamRequestId
      });
    }

    const data = Array.isArray(body.data) ? body.data : [];
    const usage = normalizeUsage(body.usage);

    return {
      images: data
        .filter((item: { b64_json?: unknown }) => typeof item.b64_json === "string")
        .map((item: { b64_json: string }) => ({ b64_json: item.b64_json })),
      usage,
      upstreamRequestId
    };
  } catch (error) {
    if (error instanceof Sub2APIError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new Sub2APIError({
        status: 408,
        code: "timeout",
        message: "图片生成请求超时"
      });
    }

    throw new Sub2APIError({
      status: 502,
      code: "upstream_error",
      message: error instanceof Error ? error.message : "上游服务失败"
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestImageGenerationStreamWithSub2API(input: {
  baseUrl: string;
  apiKey: string;
  params: ImageGenerationParams;
  partialImages: number;
  signal?: AbortSignal;
}): Promise<Sub2APIStreamResponse> {
  try {
    const response = await fetch(buildGenerationUrl(input.baseUrl), {
      method: "POST",
      redirect: "manual",
      headers: {
        accept: "text/event-stream",
        "content-type": "application/json",
        authorization: `Bearer ${input.apiKey}`
      },
      body: JSON.stringify({
        ...buildGenerationPayload(input.params),
        stream: true,
        partial_images: input.partialImages
      }),
      signal: input.signal
    });
    const upstreamRequestId =
      response.headers.get("x-request-id") ??
      response.headers.get("x-openai-request-id") ??
      undefined;

    if (isRedirectStatus(response.status)) {
      throw new Sub2APIError({
        status: 502,
        code: "upstream_redirect",
        message: redirectErrorMessage(),
        upstreamRequestId
      });
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));

      throw new Sub2APIError({
        status: response.status,
        code: mapStatusToCode(response.status),
        message: extractErrorMessage(body, response.status),
        upstreamRequestId
      });
    }

    if (!response.body) {
      throw new Sub2APIError({
        status: 502,
        code: "upstream_error",
        message: "Sub2API 未返回可读取的图片生成流",
        upstreamRequestId
      });
    }

    return { response, upstreamRequestId };
  } catch (error) {
    if (error instanceof Sub2APIError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new Sub2APIError({
        status: 408,
        code: "timeout",
        message: "图片生成流请求超时"
      });
    }

    throw new Sub2APIError({
      status: 502,
      code: "upstream_error",
      message: error instanceof Error ? error.message : "上游服务失败"
    });
  }
}

export async function editImageWithSub2API(input: {
  baseUrl: string;
  apiKey: string;
  params: ImageGenerationParams;
  image?: File;
  images?: File[];
  mask?: File;
  timeoutMs?: number;
}): Promise<Sub2APIGenerationResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    input.timeoutMs ?? getSub2APITimeoutMs()
  );

  try {
    const response = await fetch(buildImageUrl(input.baseUrl, "edits"), {
      method: "POST",
      redirect: "manual",
      headers: {
        authorization: `Bearer ${input.apiKey}`
      },
      body: buildEditPayload(
        input.params,
        input.images ?? (input.image ? [input.image] : []),
        input.mask
      ),
      signal: controller.signal
    });
    const upstreamRequestId =
      response.headers.get("x-request-id") ??
      response.headers.get("x-openai-request-id") ??
      undefined;
    const body = await response.json().catch(() => ({}));

    if (isRedirectStatus(response.status)) {
      throw new Sub2APIError({
        status: 502,
        code: "upstream_redirect",
        message: redirectErrorMessage(),
        upstreamRequestId
      });
    }

    if (!response.ok) {
      throw new Sub2APIError({
        status: response.status,
        code: mapStatusToCode(response.status),
        message: extractErrorMessage(body, response.status),
        upstreamRequestId
      });
    }

    const data = Array.isArray(body.data) ? body.data : [];
    const usage = normalizeUsage(body.usage);

    return {
      images: data
        .filter((item: { b64_json?: unknown }) => typeof item.b64_json === "string")
        .map((item: { b64_json: string }) => ({ b64_json: item.b64_json })),
      usage,
      upstreamRequestId
    };
  } catch (error) {
    if (error instanceof Sub2APIError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new Sub2APIError({
        status: 408,
        code: "timeout",
        message: "图片编辑请求超时"
      });
    }

    throw new Sub2APIError({
      status: 502,
      code: "upstream_error",
      message: error instanceof Error ? error.message : "上游服务失败"
    });
  } finally {
    clearTimeout(timeout);
  }
}

function buildGenerationUrl(baseUrl: string) {
  return buildImageUrl(baseUrl, "generations");
}

function buildImageUrl(baseUrl: string, action: "generations" | "edits") {
  const normalizedBase = normalizeImageBaseUrl(baseUrl);

  if (normalizedBase.endsWith("/v1")) {
    return `${normalizedBase}/images/${action}`;
  }

  return `${normalizedBase}/v1/images/${action}`;
}

function normalizeImageBaseUrl(baseUrl: string) {
  const normalizedBase = baseUrl.trim().replace(/\/+$/, "");

  try {
    const url = new URL(normalizedBase);
    url.hash = "";
    url.search = "";

    const path = url.pathname.replace(/\/+$/, "");
    const imagePathMatch = path.match(/^(.*\/v1)\/images(?:\/(?:generations|edits))?$/);

    if (imagePathMatch?.[1]) {
      url.pathname = imagePathMatch[1];
      return url.toString().replace(/\/+$/, "");
    }

    return normalizedBase;
  } catch {
    return normalizedBase.replace(/\/v1\/images(?:\/(?:generations|edits))?$/, "/v1");
  }
}

function buildGenerationPayload(params: ImageGenerationParams) {
  return Object.fromEntries(
    Object.entries(params).filter(([key, value]) => {
      if (key === "output_compression" && value === null) {
        return false;
      }

      return value !== undefined;
    })
  );
}

function buildEditPayload(
  params: ImageGenerationParams,
  images: File[],
  mask?: File
) {
  const formData = new FormData();
  for (const image of images) {
    formData.append("image", image);
  }

  if (mask) {
    formData.set("mask", mask);
  }

  for (const [key, value] of Object.entries(params)) {
    if (key === "output_compression" && value === null) {
      continue;
    }

    if (value !== undefined) {
      formData.set(key, String(value));
    }
  }

  return formData;
}

export function normalizeUsage(
  usage: Sub2APIUsage | undefined
): Required<Sub2APIUsage> {
  return {
    input_tokens: usage?.input_tokens ?? 0,
    output_tokens: usage?.output_tokens ?? 0,
    total_tokens: usage?.total_tokens ?? 0,
    estimated_cost: usage?.estimated_cost ?? "0.0000"
  };
}

function mapStatusToCode(status: number) {
  if (status === 400) {
    return "invalid_parameter";
  }

  if (status === 401) {
    return "unauthorized";
  }

  if (status === 403) {
    return "forbidden";
  }

  if (status === 408) {
    return "timeout";
  }

  if (status === 429) {
    return "rate_limited";
  }

  return "upstream_error";
}

export function getSub2APITimeoutMs() {
  const configuredTimeout = Number(process.env.SUB2API_TIMEOUT_MS);

  if (Number.isFinite(configuredTimeout) && configuredTimeout > 0) {
    return configuredTimeout;
  }

  return DEFAULT_SUB2API_TIMEOUT_MS;
}

function isRedirectStatus(status: number) {
  return status >= 300 && status < 400;
}

function extractErrorMessage(body: unknown, status: number) {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "object" &&
    body.error !== null &&
    "message" in body.error &&
    typeof body.error.message === "string"
  ) {
    return body.error.message;
  }

  return fallbackErrorMessage(status);
}

function redirectErrorMessage() {
  return "Sub2API Base URL 发生跳转，鉴权头可能被丢弃；请把设置里的 Base URL 改成最终 HTTPS 地址。";
}

function fallbackErrorMessage(status: number) {
  if (status === 401) {
    return "Sub2API Key 无效、已过期，或 Base URL 与 Key 不匹配，请重新配置或从 Sub2API 重新导入。";
  }

  if (status === 403) {
    return "当前 Sub2API Key 无权调用 Images API，或额度/分组限制不允许。";
  }

  if (status === 429) {
    return "Sub2API 请求被限流或额度不足，请检查 Key 额度与频率限制。";
  }

  return `Sub2API 请求失败，HTTP ${status}`;
}

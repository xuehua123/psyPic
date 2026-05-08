import { z } from "zod";
import {
  workbenchSyncPullSchema,
  workbenchSyncPushSchema
} from "@/lib/validation/workbench";
import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import { requireRequestUser } from "@/server/services/request-user-service";
import {
  MAX_WORKBENCH_SYNC_OPERATIONS,
  MAX_WORKBENCH_SYNC_PAYLOAD_BYTES,
  pullWorkbenchChangesForUser,
  pushWorkbenchChangesForUser
} from "@/server/services/workbench-sync-service";
import { WorkbenchServiceError } from "@/server/services/workbench-project-service";

export async function GET(request: Request) {
  const requestId = createRequestId();
  const unavailable = ensureWorkbenchDatabaseMode(requestId);
  if (unavailable) return unavailable;

  const viewer = await requireWorkbenchUser(request, requestId);
  if (viewer instanceof Response) return viewer;

  try {
    const url = new URL(request.url);
    const parsed = workbenchSyncPullSchema.parse({
      updatedSince: url.searchParams.get("updated_since")
    });
    const changes = await pullWorkbenchChangesForUser(viewer.user.id, parsed);

    return jsonOk(changes, requestId);
  } catch (error) {
    return workbenchErrorResponse(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  const unavailable = ensureWorkbenchDatabaseMode(requestId);
  if (unavailable) return unavailable;

  const viewer = await requireWorkbenchUser(request, requestId);
  if (viewer instanceof Response) return viewer;

  try {
    const contentLength = readContentLength(request);
    if (contentLength > MAX_WORKBENCH_SYNC_PAYLOAD_BYTES) {
      return payloadTooLargeResponse(requestId);
    }

    const rawBody = await request.json().catch(() => null);
    const bodyText = JSON.stringify(rawBody ?? null);
    if (bodyText.length > MAX_WORKBENCH_SYNC_PAYLOAD_BYTES) {
      return payloadTooLargeResponse(requestId);
    }

    const body = readObjectBody(rawBody);
    const operations = readOperations(body);
    if (
      Array.isArray(operations) &&
      operations.length > MAX_WORKBENCH_SYNC_OPERATIONS
    ) {
      return payloadTooLargeResponse(requestId);
    }

    const parsed = workbenchSyncPushSchema.parse({
      operations,
      pull: readPull(body.pull)
    });

    const result = await pushWorkbenchChangesForUser(viewer.user.id, parsed);

    return jsonOk(result, requestId);
  } catch (error) {
    return workbenchErrorResponse(error, requestId);
  }
}

async function requireWorkbenchUser(request: Request, requestId: string) {
  const viewer = await requireRequestUser(request);

  if (!viewer) {
    return jsonError({
      status: 401,
      code: "unauthorized",
      message: "请先登录",
      requestId
    });
  }

  return viewer;
}

function ensureWorkbenchDatabaseMode(requestId: string) {
  const mode = process.env.PSYPIC_WORKBENCH_PROJECTS_STORE?.trim().toLowerCase();

  if (mode && mode !== "database" && mode !== "db") {
    return Response.json(
      {
        error: {
          code: "workbench_store_unavailable",
          message: "工作台数据库模式当前不可用"
        },
        request_id: requestId
      },
      {
        status: 503,
        headers: {
          "cache-control": "no-store",
          "retry-after": "30"
        }
      }
    );
  }

  return null;
}

function readOperations(body: Record<string, unknown>) {
  if (!Array.isArray(body.operations)) {
    return body.operations;
  }

  return body.operations.map((operation) => {
    if (!operation || typeof operation !== "object" || Array.isArray(operation)) {
      return operation;
    }

    const item = operation as Record<string, unknown>;
    return {
      clientMutationId: item.client_mutation_id,
      entity: item.entity,
      action: item.action,
      data: item.data
    };
  });
}

function readPull(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const pull = value as Record<string, unknown>;
  return {
    updatedSince: pull.updated_since
  };
}

function readContentLength(request: Request) {
  const value = request.headers.get("content-length");
  if (!value) return 0;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function payloadTooLargeResponse(requestId: string) {
  return jsonError({
    status: 413,
    code: "payload_too_large",
    message: "sync payload 超出限制",
    requestId
  });
}

function workbenchErrorResponse(error: unknown, requestId: string) {
  if (error instanceof z.ZodError) {
    const firstIssue = error.issues[0];
    return jsonError({
      status: 422,
      code: "invalid_parameter",
      message: firstIssue?.message ?? "参数错误",
      field: firstIssue?.path[0]?.toString() ?? "request",
      requestId
    });
  }

  if (error instanceof WorkbenchServiceError) {
    const statusByCode: Record<string, number> = {
      not_found: 404,
      forbidden: 403,
      invalid_relation: 422,
      unavailable: 503
    };

    return jsonError({
      status: statusByCode[error.code] ?? 500,
      code: error.code,
      message: error.message,
      requestId
    });
  }

  return jsonError({
    status: 500,
    code: "internal_error",
    message: "工作台 sync 请求失败",
    requestId
  });
}

function readObjectBody(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new z.ZodError([
      {
        code: "custom",
        path: ["body"],
        message: "请求体必须是对象",
        input: value
      }
    ]);
  }

  return value as Record<string, unknown>;
}

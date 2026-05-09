import { z } from "zod";
import { creativeSessionUpdateSchema } from "@/lib/validation/workbench";
import { recordAuditLog } from "@/server/services/audit-log-service";
import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import { requireRequestUser } from "@/server/services/request-user-service";
import {
  deleteCreativeSessionForUser,
  updateCreativeSessionForUser
} from "@/server/services/creative-session-service";
import { WorkbenchServiceError } from "@/server/services/workbench-project-service";

type SessionContext = {
  params: Promise<{ sessionId: string }>;
};

export async function PATCH(request: Request, context: SessionContext) {
  const requestId = createRequestId();
  const unavailable = ensureWorkbenchDatabaseMode(requestId);
  if (unavailable) return unavailable;

  const viewer = await requireWorkbenchUser(request, requestId);
  if (viewer instanceof Response) return viewer;

  try {
    const { sessionId } = await context.params;
    const body = readObjectBody(await request.json().catch(() => null));
    const parsed = creativeSessionUpdateSchema.parse({
      title: body.title,
      forkParentVersionNodeId: body.fork_parent_version_node_id,
      activeVersionNodeId: body.active_version_node_id,
      customLabel: body.custom_label,
      isPinned: body.is_pinned,
      isArchived: body.is_archived,
      lastReadAt: body.last_read_at
    });

    return jsonOk(
      await updateCreativeSessionForUser(viewer.user.id, sessionId, parsed),
      requestId
    );
  } catch (error) {
    return workbenchErrorResponse(error, requestId);
  }
}

export async function DELETE(request: Request, context: SessionContext) {
  const requestId = createRequestId();
  const unavailable = ensureWorkbenchDatabaseMode(requestId);
  if (unavailable) return unavailable;

  const viewer = await requireWorkbenchUser(request, requestId);
  if (viewer instanceof Response) return viewer;

  try {
    const { sessionId } = await context.params;
    const deleted = await deleteCreativeSessionForUser(viewer.user.id, sessionId);
    await recordAuditLog({
      actorUserId: viewer.user.id,
      action: "workbench.session.deleted",
      targetType: "creative_session",
      targetId: sessionId,
      requestId,
      metadata: {
        session_id: sessionId,
        project_id: deleted.project_id
      }
    }).catch(() => undefined);

    return jsonOk(deleted, requestId);
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
    message: "工作台请求失败",
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

import { z } from "zod";
import {
  versionNodeCreateSchema,
  versionNodeListSchema
} from "@/lib/validation/workbench";
import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import { requireRequestUser } from "@/server/services/request-user-service";
import {
  createVersionNodeForUser,
  listVersionNodesForUser
} from "@/server/services/version-node-service";
import { WorkbenchServiceError } from "@/server/services/workbench-project-service";

export async function GET(request: Request) {
  const requestId = createRequestId();
  const unavailable = ensureWorkbenchDatabaseMode(requestId);
  if (unavailable) return unavailable;

  const viewer = await requireWorkbenchUser(request, requestId);
  if (viewer instanceof Response) return viewer;

  try {
    const url = new URL(request.url);
    const parsed = versionNodeListSchema.parse({
      sessionId: url.searchParams.get("session_id"),
      cursor: url.searchParams.get("cursor"),
      limit: parseOptionalInt(url.searchParams.get("limit"))
    });
    const page = await listVersionNodesForUser(viewer.user.id, parsed);

    return jsonOk(
      {
        items: page.items,
        next_cursor: page.nextCursor
      },
      requestId
    );
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
    const body = readObjectBody(await request.json().catch(() => null));
    const parsed = versionNodeCreateSchema.parse({
      projectId: body.project_id,
      sessionId: body.session_id,
      parentVersionNodeId: body.parent_version_node_id,
      promptSnapshot: body.prompt_snapshot,
      paramsSnapshot: body.params_snapshot,
      sourceAssetIds: body.source_asset_ids,
      outputAssetIds: body.output_asset_ids,
      boardDocumentId: body.board_document_id,
      boardSnapshot: body.board_snapshot,
      boardExportAssetId: body.board_export_asset_id,
      branchLabel: body.branch_label,
      status: body.status
    });

    return jsonOk(await createVersionNodeForUser(viewer.user.id, parsed), requestId);
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

function parseOptionalInt(value: string | null) {
  if (value === null || value.trim() === "") {
    return undefined;
  }

  return Number(value);
}

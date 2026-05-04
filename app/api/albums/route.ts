import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import { getSession } from "@/server/services/dev-store";
import {
  createImageAlbumForUser,
  listImageAlbumsForUser
} from "@/server/services/image-task-service";
import { readSessionIdFromRequest } from "@/server/services/session-service";

export async function GET(request: Request) {
  const requestId = createRequestId();
  const session = readRequestSession(request);

  if (!session) {
    return jsonError({
      status: 401,
      code: "unauthorized",
      message: "请先导入或配置 Sub2API Key",
      requestId
    });
  }

  return jsonOk(
    {
      items: await listImageAlbumsForUser(session.user_id)
    },
    requestId
  );
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  const session = readRequestSession(request);

  if (!session) {
    return jsonError({
      status: 401,
      code: "unauthorized",
      message: "请先导入或配置 Sub2API Key",
      requestId
    });
  }

  const parsed = parseCreateAlbumBody(await request.json().catch(() => null));

  if (!parsed.success) {
    return jsonError({
      status: 400,
      code: "invalid_parameter",
      message: parsed.message,
      field: parsed.field,
      requestId
    });
  }

  const album = await createImageAlbumForUser(session.user_id, {
    title: parsed.data.title,
    assetIds: parsed.data.asset_ids
  });

  if (!album) {
    return jsonError({
      status: 404,
      code: "not_found",
      message: "相册素材不存在",
      requestId
    });
  }

  return jsonOk(album, requestId);
}

function readRequestSession(request: Request) {
  const sessionId = readSessionIdFromRequest(request);

  return sessionId ? getSession(sessionId) : null;
}

function parseCreateAlbumBody(value: unknown):
  | { success: true; data: { title: string; asset_ids: string[] } }
  | { success: false; message: string; field: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      success: false,
      message: "请求体必须是对象",
      field: "body"
    };
  }

  const input = value as Record<string, unknown>;

  if (typeof input.title !== "string" || input.title.trim().length === 0) {
    return {
      success: false,
      message: "相册标题不能为空",
      field: "title"
    };
  }

  if (
    !Array.isArray(input.asset_ids) ||
    input.asset_ids.some((assetId) => typeof assetId !== "string")
  ) {
    return {
      success: false,
      message: "asset_ids 必须是字符串数组",
      field: "asset_ids"
    };
  }

  return {
    success: true,
    data: {
      title: input.title,
      asset_ids: input.asset_ids
    }
  };
}

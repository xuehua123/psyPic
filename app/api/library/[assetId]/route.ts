import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import { getSession } from "@/server/services/dev-store";
import {
  getImageLibraryAssetForUser,
  type ImageLibraryMetadataPatch,
  updateImageLibraryAssetForUser
} from "@/server/services/image-task-service";
import { readSessionIdFromRequest } from "@/server/services/session-service";

export async function GET(
  request: Request,
  context: { params: Promise<{ assetId: string }> }
) {
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

  const { assetId } = await context.params;
  const item = getImageLibraryAssetForUser(session.user_id, assetId);

  if (!item) {
    return jsonError({
      status: 404,
      code: "not_found",
      message: "素材不存在",
      requestId
    });
  }

  return jsonOk(item, requestId);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ assetId: string }> }
) {
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

  const parsed = parseMetadataPatch(await request.json().catch(() => null));

  if (!parsed.success) {
    return jsonError({
      status: 400,
      code: "invalid_parameter",
      message: parsed.message,
      field: parsed.field,
      requestId
    });
  }

  const { assetId } = await context.params;
  const item = updateImageLibraryAssetForUser(
    session.user_id,
    assetId,
    parsed.data
  );

  if (!item) {
    return jsonError({
      status: 404,
      code: "not_found",
      message: "素材不存在",
      requestId
    });
  }

  return jsonOk(item, requestId);
}

function parseMetadataPatch(value: unknown):
  | { success: true; data: ImageLibraryMetadataPatch }
  | { success: false; message: string; field: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      success: false,
      message: "请求体必须是对象",
      field: "body"
    };
  }

  const input = value as Record<string, unknown>;
  const patch: ImageLibraryMetadataPatch = {};

  if ("favorite" in input) {
    if (typeof input.favorite !== "boolean") {
      return {
        success: false,
        message: "favorite 必须是布尔值",
        field: "favorite"
      };
    }

    patch.favorite = input.favorite;
  }

  if ("tags" in input) {
    if (
      !Array.isArray(input.tags) ||
      input.tags.some((tag) => typeof tag !== "string")
    ) {
      return {
        success: false,
        message: "tags 必须是字符串数组",
        field: "tags"
      };
    }

    patch.tags = input.tags;
  }

  return { success: true, data: patch };
}

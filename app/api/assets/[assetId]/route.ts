import { createRequestId, jsonError } from "@/server/services/api-response";
import { getSession } from "@/server/services/dev-store";
import { readSessionIdFromRequest } from "@/server/services/session-service";
import {
  readTempAssetForUser,
  TempAssetError
} from "@/server/services/temp-asset-service";

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
      message: "请先登录后访问图片",
      requestId
    });
  }

  const { assetId } = await context.params;

  try {
    const asset = await readTempAssetForUser(assetId, session.user_id);

    const body = new ArrayBuffer(asset.bytes.byteLength);
    new Uint8Array(body).set(asset.bytes);

    return new Response(body, {
      status: 200,
      headers: {
        "content-type": asset.mime_type,
        "content-length": String(asset.size_bytes),
        "cache-control": "private, no-store"
      }
    });
  } catch (error) {
    if (error instanceof TempAssetError) {
      return jsonError({
        status: error.code === "forbidden" ? 403 : 404,
        code: error.code,
        message: error.message,
        requestId
      });
    }

    return jsonError({
      status: 404,
      code: "not_found",
      message: "图片不存在",
      requestId
    });
  }
}

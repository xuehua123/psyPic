import { createRequestId, jsonError } from "@/server/services/api-response";
import { getSession } from "@/server/services/dev-store";
import { getImageLibraryAssetForUser } from "@/server/services/image-task-service";
import { readSessionIdFromRequest } from "@/server/services/session-service";
import { readTempAssetForUser, TempAssetError } from "@/server/services/temp-asset-service";
import { createZipArchive } from "@/server/services/zip-service";

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

  const parsed = parseZipBody(await request.json().catch(() => null));

  if (!parsed.success) {
    return jsonError({
      status: 400,
      code: "invalid_parameter",
      message: parsed.message,
      field: parsed.field,
      requestId
    });
  }

  try {
    const files = await Promise.all(
      parsed.data.asset_ids.map(async (assetId) => {
    const item = await getImageLibraryAssetForUser(session.user_id, assetId);

        if (!item) {
          throw new TempAssetError("not_found", "素材不存在");
        }

        const asset = await readTempAssetForUser(assetId, session.user_id);
        const extension = item.format === "jpeg" ? "jpg" : item.format;

        return {
          name: `${assetId}.${extension}`,
          bytes: asset.bytes
        };
      })
    );
    const archive = createZipArchive(files);

    return new Response(archive, {
      status: 200,
      headers: {
        "content-type": "application/zip",
        "content-disposition": 'attachment; filename="psypic-assets.zip"',
        "cache-control": "private, no-store"
      }
    });
  } catch (error) {
    if (error instanceof TempAssetError) {
      return jsonError({
        status: error.code === "forbidden" ? 403 : 404,
        code: error.code === "forbidden" ? "forbidden" : "not_found",
        message: error.message,
        requestId
      });
    }

    return jsonError({
      status: 404,
      code: "not_found",
      message: "素材不存在",
      requestId
    });
  }
}

function parseZipBody(value: unknown):
  | { success: true; data: { asset_ids: string[] } }
  | { success: false; message: string; field: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      success: false,
      message: "请求体必须是对象",
      field: "body"
    };
  }

  const input = value as Record<string, unknown>;

  if (
    !Array.isArray(input.asset_ids) ||
    input.asset_ids.length === 0 ||
    input.asset_ids.some((assetId) => typeof assetId !== "string")
  ) {
    return {
      success: false,
      message: "asset_ids 必须是非空字符串数组",
      field: "asset_ids"
    };
  }

  return {
    success: true,
    data: {
      asset_ids: Array.from(new Set(input.asset_ids.map((assetId) => assetId.trim())))
    }
  };
}

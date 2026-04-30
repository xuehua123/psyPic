import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import { getSession } from "@/server/services/dev-store";
import { listImageLibraryAssetsForUser } from "@/server/services/image-task-service";
import { readSessionIdFromRequest } from "@/server/services/session-service";

export async function GET(request: Request) {
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

  const url = new URL(request.url);
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const favorite = parseFavoriteFilter(url.searchParams.get("favorite"));
  const library = listImageLibraryAssetsForUser(session.user_id, {
    cursor: url.searchParams.get("cursor"),
    limit,
    favorite,
    tag: url.searchParams.get("tag"),
    query: url.searchParams.get("q")
  });

  return jsonOk(
    {
      items: library.items,
      next_cursor: library.nextCursor
    },
    requestId
  );
}

function parseFavoriteFilter(value: string | null) {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
}

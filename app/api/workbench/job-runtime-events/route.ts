import { createRequestId, jsonError, jsonOk } from "@/server/services/api-response";
import {
  listJobRuntimeEventsForUser
} from "@/server/services/job-runtime-event-service";
import { requireRequestUser } from "@/server/services/request-user-service";

export async function GET(request: Request) {
  const requestId = createRequestId();
  const viewer = await requireRequestUser(request);

  if (!viewer) {
    return jsonError({
      status: 401,
      code: "unauthorized",
      message: "请先登录",
      requestId
    });
  }

  const url = new URL(request.url);
  const limit = parseOptionalInt(url.searchParams.get("limit"));
  const events = await listJobRuntimeEventsForUser(viewer.user.id, {
    taskId: emptyToNull(url.searchParams.get("task_id")),
    versionNodeId: emptyToNull(url.searchParams.get("version_node_id")),
    cursor: emptyToNull(url.searchParams.get("cursor")),
    limit
  });

  return jsonOk(
    {
      items: events.items,
      next_cursor: events.nextCursor
    },
    requestId
  );
}

function emptyToNull(value: string | null) {
  return value && value.trim() ? value.trim() : null;
}

function parseOptionalInt(value: string | null) {
  if (!value || !value.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

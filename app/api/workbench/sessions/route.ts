import {
  creativeSessionCreateSchema,
  creativeSessionListSchema
} from "@/lib/validation/workbench";
import { createRequestId, jsonOk } from "@/server/services/api-response";
import {
  createCreativeSessionForUser,
  listCreativeSessionsForUser
} from "@/server/services/creative-session-service";
import {
  ensureWorkbenchDatabaseMode,
  parseOptionalInt,
  readObjectBody,
  requireWorkbenchUser,
  workbenchErrorResponse
} from "@/app/api/workbench/projects/route";

export async function GET(request: Request) {
  const requestId = createRequestId();
  const unavailable = ensureWorkbenchDatabaseMode(requestId);
  if (unavailable) return unavailable;

  const viewer = await requireWorkbenchUser(request, requestId);
  if (viewer instanceof Response) return viewer;

  try {
    const url = new URL(request.url);
    const parsed = creativeSessionListSchema.parse({
      projectId: url.searchParams.get("project_id"),
      cursor: url.searchParams.get("cursor"),
      limit: parseOptionalInt(url.searchParams.get("limit"))
    });
    const page = await listCreativeSessionsForUser(viewer.user.id, parsed);

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
    const parsed = creativeSessionCreateSchema.parse({
      projectId: body.project_id,
      title: body.title,
      forkParentVersionNodeId: body.fork_parent_version_node_id,
      activeVersionNodeId: body.active_version_node_id,
      customLabel: body.custom_label,
      isPinned: body.is_pinned,
      isArchived: body.is_archived,
      lastReadAt: body.last_read_at
    });

    return jsonOk(
      await createCreativeSessionForUser(viewer.user.id, parsed),
      requestId
    );
  } catch (error) {
    return workbenchErrorResponse(error, requestId);
  }
}

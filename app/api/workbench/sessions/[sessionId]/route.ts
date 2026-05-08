import { creativeSessionUpdateSchema } from "@/lib/validation/workbench";
import { createRequestId, jsonOk } from "@/server/services/api-response";
import {
  deleteCreativeSessionForUser,
  updateCreativeSessionForUser
} from "@/server/services/creative-session-service";
import {
  ensureWorkbenchDatabaseMode,
  readObjectBody,
  requireWorkbenchUser,
  workbenchErrorResponse
} from "@/app/api/workbench/projects/route";

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
    return jsonOk(
      await deleteCreativeSessionForUser(viewer.user.id, sessionId),
      requestId
    );
  } catch (error) {
    return workbenchErrorResponse(error, requestId);
  }
}

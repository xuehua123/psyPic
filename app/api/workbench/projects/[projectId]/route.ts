import { workbenchProjectUpdateSchema } from "@/lib/validation/workbench";
import { createRequestId, jsonOk } from "@/server/services/api-response";
import {
  deleteWorkbenchProjectForUser,
  getWorkbenchProjectForUser,
  updateWorkbenchProjectForUser
} from "@/server/services/workbench-project-service";
import {
  ensureWorkbenchDatabaseMode,
  readObjectBody,
  requireWorkbenchUser,
  workbenchErrorResponse
} from "@/app/api/workbench/projects/route";

type ProjectContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(request: Request, context: ProjectContext) {
  const requestId = createRequestId();
  const unavailable = ensureWorkbenchDatabaseMode(requestId);
  if (unavailable) return unavailable;

  const viewer = await requireWorkbenchUser(request, requestId);
  if (viewer instanceof Response) return viewer;

  try {
    const { projectId } = await context.params;
    return jsonOk(
      await getWorkbenchProjectForUser(viewer.user.id, projectId),
      requestId
    );
  } catch (error) {
    return workbenchErrorResponse(error, requestId);
  }
}

export async function PATCH(request: Request, context: ProjectContext) {
  const requestId = createRequestId();
  const unavailable = ensureWorkbenchDatabaseMode(requestId);
  if (unavailable) return unavailable;

  const viewer = await requireWorkbenchUser(request, requestId);
  if (viewer instanceof Response) return viewer;

  try {
    const { projectId } = await context.params;
    const body = readObjectBody(await request.json().catch(() => null));
    const parsed = workbenchProjectUpdateSchema.parse({
      title: body.title,
      sortOrder: body.sort_order,
      collapsed: body.collapsed,
      activeSessionId: body.active_session_id
    });
    return jsonOk(
      await updateWorkbenchProjectForUser(viewer.user.id, projectId, parsed),
      requestId
    );
  } catch (error) {
    return workbenchErrorResponse(error, requestId);
  }
}

export async function DELETE(request: Request, context: ProjectContext) {
  const requestId = createRequestId();
  const unavailable = ensureWorkbenchDatabaseMode(requestId);
  if (unavailable) return unavailable;

  const viewer = await requireWorkbenchUser(request, requestId);
  if (viewer instanceof Response) return viewer;

  try {
    const { projectId } = await context.params;
    return jsonOk(
      await deleteWorkbenchProjectForUser(viewer.user.id, projectId),
      requestId
    );
  } catch (error) {
    return workbenchErrorResponse(error, requestId);
  }
}

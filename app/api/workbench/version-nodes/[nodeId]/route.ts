import { versionNodeUpdateSchema } from "@/lib/validation/workbench";
import { createRequestId, jsonOk } from "@/server/services/api-response";
import {
  getVersionNodeForUser,
  updateVersionNodeForUser
} from "@/server/services/version-node-service";
import {
  ensureWorkbenchDatabaseMode,
  readObjectBody,
  requireWorkbenchUser,
  workbenchErrorResponse
} from "@/app/api/workbench/projects/route";

type VersionNodeContext = {
  params: Promise<{ nodeId: string }>;
};

export async function GET(request: Request, context: VersionNodeContext) {
  const requestId = createRequestId();
  const unavailable = ensureWorkbenchDatabaseMode(requestId);
  if (unavailable) return unavailable;

  const viewer = await requireWorkbenchUser(request, requestId);
  if (viewer instanceof Response) return viewer;

  try {
    const { nodeId } = await context.params;
    return jsonOk(await getVersionNodeForUser(viewer.user.id, nodeId), requestId);
  } catch (error) {
    return workbenchErrorResponse(error, requestId);
  }
}

export async function PATCH(request: Request, context: VersionNodeContext) {
  const requestId = createRequestId();
  const unavailable = ensureWorkbenchDatabaseMode(requestId);
  if (unavailable) return unavailable;

  const viewer = await requireWorkbenchUser(request, requestId);
  if (viewer instanceof Response) return viewer;

  try {
    const { nodeId } = await context.params;
    const body = readObjectBody(await request.json().catch(() => null));
    const parsed = versionNodeUpdateSchema.parse({
      status: body.status,
      outputAssetIds: body.output_asset_ids,
      branchLabel: body.branch_label,
      boardDocumentId: body.board_document_id,
      boardSnapshot: body.board_snapshot,
      boardExportAssetId: body.board_export_asset_id
    });

    return jsonOk(
      await updateVersionNodeForUser(viewer.user.id, nodeId, parsed),
      requestId
    );
  } catch (error) {
    return workbenchErrorResponse(error, requestId);
  }
}

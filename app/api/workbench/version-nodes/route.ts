import {
  versionNodeCreateSchema,
  versionNodeListSchema
} from "@/lib/validation/workbench";
import { createRequestId, jsonOk } from "@/server/services/api-response";
import {
  createVersionNodeForUser,
  listVersionNodesForUser
} from "@/server/services/version-node-service";
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
    const parsed = versionNodeListSchema.parse({
      sessionId: url.searchParams.get("session_id"),
      cursor: url.searchParams.get("cursor"),
      limit: parseOptionalInt(url.searchParams.get("limit"))
    });
    const page = await listVersionNodesForUser(viewer.user.id, parsed);

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
    const parsed = versionNodeCreateSchema.parse({
      projectId: body.project_id,
      sessionId: body.session_id,
      parentVersionNodeId: body.parent_version_node_id,
      promptSnapshot: body.prompt_snapshot,
      paramsSnapshot: body.params_snapshot,
      sourceAssetIds: body.source_asset_ids,
      outputAssetIds: body.output_asset_ids,
      boardDocumentId: body.board_document_id,
      boardSnapshot: body.board_snapshot,
      boardExportAssetId: body.board_export_asset_id,
      branchLabel: body.branch_label,
      status: body.status
    });

    return jsonOk(await createVersionNodeForUser(viewer.user.id, parsed), requestId);
  } catch (error) {
    return workbenchErrorResponse(error, requestId);
  }
}

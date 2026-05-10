import type { StoredProject } from "./projects-store";
import type { CreatorVersionNode, CreatorVersionImage } from "./version-graph";
import type {
  WorkbenchProject,
  WorkbenchVersionNode
} from "./workbench-types";
import type { ImageGenerationParams } from "@/lib/validation/image-params";
import type { CreatorProjectId } from "./types";

export type StoredWorkbenchVersionNode = CreatorVersionNode & {
  projectId: string;
  sessionId: string;
  boardDocumentId: string | null;
  boardSnapshot: unknown | null;
  boardExportAssetId: string | null;
};

export function mapWorkbenchProjectToStoredProject(
  project: WorkbenchProject
): StoredProject {
  return {
    id: project.id as CreatorProjectId,
    title: project.title,
    description: undefined,
    isBuiltin: false,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    sortOrder: project.sort_order
  };
}

export function mapWorkbenchVersionNodeToCreatorNode(
  node: WorkbenchVersionNode,
  depth: number = 0,
  branchId: string = node.id
): StoredWorkbenchVersionNode {
  const params = (node.params_snapshot || {
    prompt: node.prompt_snapshot,
    model: "gpt-image-2",
    size: "1024x1024",
    quality: "standard",
    n: 1,
    output_format: "png"
  }) as ImageGenerationParams;

  const images: CreatorVersionImage[] = node.output_asset_ids.map((id) => ({
    asset_id: id,
    url: `/api/assets/${id}`,
    format: params.output_format || "png"
  }));

  let status: CreatorVersionNode["status"] = "succeeded";
  if (node.status === "failed" || node.status === "timed_out" || node.status === "canceled") {
    status = "failed";
  } else if (node.status === "running" || node.status === "queued" || node.status === "partial_image") {
    status = "running";
  }

  return {
    id: node.id,
    parentId: node.parent_version_node_id,
    branchId,
    branchLabel: node.branch_label || "主线",
    depth,
    createdAt: node.created_at,
    status,
    prompt: node.prompt_snapshot,
    params,
    images,
    selectedImageId: images[0]?.asset_id,
    source: "generation",
    projectId: node.project_id,
    sessionId: node.session_id,
    boardDocumentId: node.board_document_id,
    boardSnapshot: node.board_snapshot,
    boardExportAssetId: node.board_export_asset_id
  };
}

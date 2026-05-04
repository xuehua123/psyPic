import type { LocalHistoryItem } from "@/lib/history/local-history";
import type { ImageGenerationParams } from "@/lib/validation/image-params";

export type CreatorVersionSource = "generation" | "edit" | "history" | "same";

export type CreatorVersionImage = {
  asset_id: string;
  url: string;
  format: string;
};

export type CreatorVersionNode = {
  id: string;
  parentId: string | null;
  branchId: string;
  branchLabel: string;
  depth: number;
  createdAt: string;
  status: "succeeded" | "failed" | "running" | "queued";
  prompt: string;
  params: ImageGenerationParams;
  images: CreatorVersionImage[];
  selectedImageId?: string;
  requestId?: string;
  upstreamRequestId?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    estimated_cost: string;
  };
  durationMs?: number;
  source: CreatorVersionSource;
};

type CreateVersionNodeInput = {
  existingNodes: CreatorVersionNode[];
  parentId: string | null;
  prompt: string;
  params: ImageGenerationParams;
  images: CreatorVersionImage[];
  requestId?: string;
  upstreamRequestId?: string;
  usage?: CreatorVersionNode["usage"];
  durationMs?: number;
  source: CreatorVersionSource;
  status?: CreatorVersionNode["status"];
  createdAt?: string;
  id?: string;
};

export function createVersionNode(input: CreateVersionNodeInput) {
  const parent = input.parentId
    ? input.existingNodes.find((node) => node.id === input.parentId) ?? null
    : null;
  const siblingCount = input.parentId
    ? getChildCount(input.existingNodes, input.parentId)
    : 0;
  const rootCount = input.parentId
    ? 0
    : input.existingNodes.filter((node) => node.parentId === null).length;
  const startsBranch = Boolean(parent && siblingCount > 0);
  const id = input.id ?? createNodeId(input.images[0]?.asset_id);
  const branchId = parent
    ? startsBranch
      ? id
      : parent.branchId
    : id;
  const branchLabel = parent
    ? startsBranch
      ? getNextBranchLabel(input.existingNodes, parent.id)
      : parent.branchLabel
    : rootCount === 0
      ? "主线"
      : `对话 ${rootCount + 1}`;

  return {
    id,
    parentId: parent?.id ?? null,
    branchId,
    branchLabel,
    depth: parent ? parent.depth + 1 : 0,
    createdAt: input.createdAt ?? new Date().toISOString(),
    status: input.status ?? "succeeded",
    prompt: input.prompt,
    params: input.params,
    images: input.images,
    selectedImageId: input.images[0]?.asset_id,
    requestId: input.requestId,
    upstreamRequestId: input.upstreamRequestId,
    usage: input.usage,
    durationMs: input.durationMs,
    source: input.source
  } satisfies CreatorVersionNode;
}

export function createNodeFromHistory(item: LocalHistoryItem) {
  const image = parseHistoryImage(item);

  return {
    id: item.versionNodeId ?? `history_${item.taskId}`,
    parentId: item.parentTaskId ?? null,
    branchId: item.branchId ?? item.versionNodeId ?? `history_${item.taskId}`,
    branchLabel: item.branchLabel ?? "主线",
    depth: item.parentTaskId ? 1 : 0,
    createdAt: item.createdAt,
    status: "succeeded",
    prompt: item.prompt,
    params: {
      prompt: item.prompt,
      ...item.params
    },
    images: item.images ?? [image],
    selectedImageId: (item.images ?? [image])[0]?.asset_id,
    requestId: item.requestId,
    usage: {
      input_tokens: 0,
      output_tokens: item.totalTokens,
      total_tokens: item.totalTokens,
      estimated_cost: "0.0000"
    },
    durationMs: item.durationMs,
    source: "history"
  } satisfies CreatorVersionNode;
}

export function getChildCount(nodes: CreatorVersionNode[], parentId: string) {
  return nodes.filter((node) => node.parentId === parentId).length;
}

export function getNextBranchLabel(
  nodes: CreatorVersionNode[],
  parentId: string
) {
  return `分支 ${getChildCount(nodes, parentId) + 1}`;
}

export function summarizeNodeParams(node: CreatorVersionNode) {
  return [
    node.params.size,
    node.params.quality,
    `${node.params.n} 张`,
    node.params.output_format
  ].join(" · ");
}

export function formatVersionNodeTime(node: CreatorVersionNode) {
  return new Date(node.createdAt).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function createNodeId(seed?: string) {
  const suffix =
    seed ??
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2));

  return `node_${suffix}`;
}

function parseHistoryImage(item: LocalHistoryItem) {
  const assetId =
    item.thumbnailUrl.split("/").filter(Boolean).at(-1) ?? item.taskId;

  return {
    asset_id: assetId,
    url: item.thumbnailUrl,
    format: item.params.output_format
  };
}

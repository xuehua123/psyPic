"use client";

import Link from "next/link";
import {
  Brush,
  Copy,
  Download,
  Eraser,
  ExternalLink,
  FlipHorizontal,
  History,
  ImagePlus,
  PanelBottom,
  Play,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tags,
  UploadCloud,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ChangeEvent,
  ClipboardEvent,
  CSSProperties,
  DragEvent,
  FormEvent,
  PointerEvent as ReactPointerEvent
} from "react";

import BatchWorkflowPanel from "@/components/creator/BatchWorkflowPanel";
import BranchMapSection from "@/components/creator/studio/BranchMapSection";
import ChatEmptyState from "@/components/creator/studio/ChatEmptyState";
import ChatHeader from "@/components/creator/studio/ChatHeader";
import ChatTurn from "@/components/creator/studio/ChatTurn";
import CommunityPublishPanel from "@/components/creator/studio/CommunityPublishPanel";
import { CreatorStudioProvider } from "@/components/creator/studio/CreatorStudioContext";
import NodeInspectorSection from "@/components/creator/studio/NodeInspectorSection";
import PartialPreviewStrip from "@/components/creator/studio/PartialPreviewStrip";
import ProjectSidebar from "@/components/creator/studio/ProjectSidebar";
import TaskStatusStrip from "@/components/creator/studio/TaskStatusStrip";
import VersionStreamSection from "@/components/creator/studio/VersionStreamSection";
import AppShell from "@/components/layout/AppShell";

import { formatApiError, formatTaskError } from "@/lib/creator/api-error";
import {
  fetchReferenceImageFile,
  mimeTypeForFormat,
  normalizeContentType
} from "@/lib/creator/content-type";
import { buildEditFormData } from "@/lib/creator/edit-form";
import {
  isRecord,
  parseGenerationImage,
  parseGenerationImages,
  parseJsonRecord,
  parseSseBlock,
  parseUsage,
  readNumber,
  readString
} from "@/lib/creator/sse-parser";
import {
  canCancelTask,
  canRetryTask,
  isImageTaskSnapshot,
  taskStatusLabels,
  taskTypeLabels
} from "@/lib/creator/task-status";
import { createTemplateFieldValues } from "@/lib/creator/template-render";
import type {
  ApiCommunityWorkResponse,
  ApiGenerationResponse,
  ApiLibraryPatchResponse,
  ApiLibraryResponse,
  ApiPromptAssistResponse,
  ApiSameGenerationDraftResponse,
  ApiTaskResponse,
  CreatorConversationId,
  CreatorMode,
  CreatorProjectId,
  CurrentTask,
  GenerationImage,
  GenerationResult,
  LibraryAssetItem,
  MaskMode,
  TemplateFieldValue,
  TemplateFieldValues
} from "@/lib/creator/types";

import {
  listLocalHistoryItems,
  saveLocalHistoryItem,
  type LocalHistoryItem
} from "@/lib/history/local-history";
import {
  createNodeFromHistory,
  createVersionNode,
  formatVersionNodeTime,
  summarizeNodeParams,
  type CreatorVersionNode
} from "@/lib/creator/version-graph";
import {
  creatorProjects,
  type SidebarProjectGroup
} from "@/lib/creator/projects";
import {
  listPromptFavorites,
  savePromptFavorite,
  type PromptFavoriteItem
} from "@/lib/prompts/prompt-favorites";
import { commercialSizePresets } from "@/lib/templates/commercial-size-presets";
import {
  commercialTemplates,
  renderCommercialPrompt,
  type CommercialTemplate
} from "@/lib/templates/commercial-templates";
import {
  GENERATION_SIZE_OPTIONS,
  imageGenerationDefaults,
  type ImageGenerationParams
} from "@/lib/validation/image-params";

const qualityOptions = [
  { label: "自动", value: "auto" },
  { label: "标准", value: "medium" },
  { label: "高质", value: "high" }
] as const;

const maskCanvasSize = 512;
const defaultTemplateId = "tpl_ecommerce_main";

export default function CreatorWorkspace({
  showAdminLink = false
}: {
  showAdminLink?: boolean;
} = {}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [mode, setMode] = useState<CreatorMode>("text");
  const [selectedTemplateId, setSelectedTemplateId] = useState(defaultTemplateId);
  const [templateFieldValues, setTemplateFieldValues] =
    useState<TemplateFieldValues>(() =>
      createTemplateFieldValues(
        commercialTemplates.find((template) => template.id === defaultTemplateId) ??
          commercialTemplates[0],
        "电商主图"
      )
    );
  const [prompt, setPrompt] = useState("");
  const [size, setSize] =
    useState<ImageGenerationParams["size"]>("1024x1024");
  const [quality, setQuality] =
    useState<ImageGenerationParams["quality"]>("medium");
  const [outputFormat, setOutputFormat] =
    useState<ImageGenerationParams["output_format"]>("png");
  const [n, setN] = useState(1);
  const [outputCompression, setOutputCompression] = useState("");
  const [moderation, setModeration] =
    useState<ImageGenerationParams["moderation"]>("auto");
  const [streamEnabled, setStreamEnabled] = useState(false);
  const [partialImageCount, setPartialImageCount] = useState(2);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAssistingPrompt, setIsAssistingPrompt] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [partialImages, setPartialImages] = useState<GenerationImage[]>([]);
  const [historyItems, setHistoryItems] = useState<LocalHistoryItem[]>([]);
  const [promptFavorites, setPromptFavorites] = useState<PromptFavoriteItem[]>(
    []
  );
  const [libraryItems, setLibraryItems] = useState<LibraryAssetItem[]>([]);
  const [libraryStatus, setLibraryStatus] = useState<
    "idle" | "loading" | "loaded" | "unavailable"
  >("idle");
  const [libraryFavoriteOnly, setLibraryFavoriteOnly] = useState(false);
  const [libraryTagFilter, setLibraryTagFilter] = useState("");
  const [publishAssetId, setPublishAssetId] = useState<string | null>(null);
  const [publishingAssetId, setPublishingAssetId] = useState<string | null>(null);
  const [publishMessages, setPublishMessages] = useState<Record<string, string>>(
    {}
  );
  const [referenceImages, setReferenceImages] = useState<File[]>([]);
  const referenceImage = referenceImages[0] ?? null;
  const referencePreviews = useMemo(() => {
    if (
      referenceImages.length === 0 ||
      typeof URL.createObjectURL !== "function"
    ) {
      return [];
    }

    return referenceImages.map((image) => ({
      name: image.name,
      url: URL.createObjectURL(image)
    }));
  }, [referenceImages]);
  const [maskEnabled, setMaskEnabled] = useState(false);
  const [maskMode, setMaskMode] = useState<MaskMode>("paint");
  const [maskBrushSize, setMaskBrushSize] = useState(48);
  const [currentTask, setCurrentTask] = useState<CurrentTask | null>(null);
  const [versionNodes, setVersionNodes] = useState<CreatorVersionNode[]>([]);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [forkParentId, setForkParentId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] =
    useState<CreatorProjectId>("commercial");
  const [activeConversationId, setActiveConversationId] =
    useState<CreatorConversationId>("all");
  const [nodeProjectIds, setNodeProjectIds] = useState<
    Record<string, CreatorProjectId>
  >({});
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskDrawingRef = useRef(false);

  const mvpTemplates = useMemo(
    () => commercialTemplates.filter((template) => template.enabledForMvp),
    []
  );
  const selectedTemplate = useMemo(
    () => commercialTemplates.find((template) => template.id === selectedTemplateId),
    [selectedTemplateId]
  );
  const selectedCommercialSizeId =
    commercialSizePresets.find((preset) => preset.size === size)?.id ?? "custom";
  const sidebarProjects = useMemo<SidebarProjectGroup[]>(
    () =>
      creatorProjects.map((project) => {
        const nodes = versionNodes.filter(
          (node) => (nodeProjectIds[node.id] ?? "commercial") === project.id
        );

        return {
          project,
          nodes,
          branchSummaries: Array.from(
            new Map(
              nodes.map((node) => [
                node.branchId,
                {
                  id: node.branchId,
                  label: node.branchLabel,
                  count: nodes.filter((item) => item.branchId === node.branchId)
                    .length,
                  latestNode:
                    nodes
                      .filter((item) => item.branchId === node.branchId)
                      .sort(
                        (left, right) =>
                          new Date(right.createdAt).getTime() -
                          new Date(left.createdAt).getTime()
                      )[0] ?? null
                }
              ])
            ).values()
          )
        };
      }),
    [nodeProjectIds, versionNodes]
  );
  const activeProjectGroup = useMemo<SidebarProjectGroup>(
    () =>
      sidebarProjects.find((item) => item.project.id === activeProjectId) ??
      sidebarProjects[0] ?? {
        project: creatorProjects[0],
        nodes: [],
        branchSummaries: []
      },
    [activeProjectId, sidebarProjects]
  );
  const activeProject = activeProjectGroup.project;
  const projectVersionNodes = activeProjectGroup.nodes;
  const branchSummaries = activeProjectGroup.branchSummaries;
  const displayedVersionNodes = useMemo(() => {
    if (activeConversationId === "new") {
      return [];
    }

    if (!activeConversationId.startsWith("branch:")) {
      return projectVersionNodes;
    }

    const branchId = activeConversationId.slice("branch:".length);
    const branchNodes = projectVersionNodes.filter(
      (node) => node.branchId === branchId
    );
    const ancestorIds = new Set<string>();

    branchNodes.forEach((node) => {
      let parentId = node.parentId;

      while (parentId) {
        ancestorIds.add(parentId);
        parentId =
          projectVersionNodes.find((candidate) => candidate.id === parentId)
            ?.parentId ?? null;
      }
    });

    return projectVersionNodes.filter(
      (node) => node.branchId === branchId || ancestorIds.has(node.id)
    );
  }, [activeConversationId, projectVersionNodes]);
  const activeVersionNode = useMemo(
    () => projectVersionNodes.find((node) => node.id === activeNodeId) ?? null,
    [activeNodeId, projectVersionNodes]
  );
  const activeBranchSummary = activeConversationId.startsWith("branch:")
    ? branchSummaries.find(
        (branch) =>
          branch.id === activeConversationId.slice("branch:".length)
      ) ?? null
    : null;
  const galleryImages = activeVersionNode?.images ?? [];
  const galleryRequestId = activeVersionNode?.requestId ?? "";
  const galleryTotalTokens =
    activeVersionNode?.usage?.total_tokens ?? 0;

  useEffect(() => {
    return () => {
      if (typeof URL.revokeObjectURL !== "function") {
        return;
      }

      referencePreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [referencePreviews]);

  useEffect(() => {
    void listLocalHistoryItems()
      .then((items) => {
        setHistoryItems(items);
        const importedNodes = items.map(createNodeFromHistory);
        setVersionNodes((nodes) => (nodes.length > 0 ? nodes : importedNodes));
        setNodeProjectIds((projects) => ({
          ...Object.fromEntries(
            importedNodes.map((node) => [node.id, "commercial"] as const)
          ),
          ...projects
        }));
        setActiveNodeId((current) => current ?? importedNodes[0]?.id ?? null);
      })
      .catch(() => setHistoryItems([]));
  }, []);

  useEffect(() => {
    void listPromptFavorites()
      .then(setPromptFavorites)
      .catch(() => setPromptFavorites([]));
  }, []);

  useEffect(() => {
    const assetId = new URLSearchParams(window.location.search).get(
      "reference_asset"
    );

    if (!assetId) {
      return;
    }

    let active = true;

    async function loadReferenceAsset() {
      try {
        const response = await fetch(`/api/library/${assetId}`);
        const body = (await response.json()) as ApiLibraryPatchResponse;

        if (!active || !response.ok || !body.data) {
          return;
        }

        const asset = body.data;
        const extension = asset.format === "jpeg" ? "jpg" : asset.format;
        const reference = await fetchReferenceImageFile({
          url: asset.thumbnail_url,
          fileName: `${asset.asset_id}.${extension}`,
          fallbackType: mimeTypeForFormat(asset.format)
        });

        if (!active) {
          return;
        }

        setReferenceImages([reference]);
        setPrompt(asset.prompt);
        setSize(asset.params.size);
        setQuality(asset.params.quality);
        setOutputFormat(asset.params.output_format);
        setN(asset.params.n);
        setOutputCompression(
          asset.params.output_compression === null
            ? ""
            : String(asset.params.output_compression)
        );
        setModeration(asset.params.moderation);
        setMode("image");
        setErrorMessage("");
      } catch {
        if (active) {
          setErrorMessage("无法读取素材作为参考图。");
        }
      }
    }

    void loadReferenceAsset();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const workId = new URLSearchParams(window.location.search).get("same_work");

    if (!workId) {
      return;
    }

    let active = true;

    async function loadSameGenerationDraft() {
      try {
        const response = await fetch(`/api/community/works/${workId}/same`, {
          method: "POST"
        });
        const body = (await response.json()) as ApiSameGenerationDraftResponse;

        if (!active || !response.ok || !body.data) {
          return;
        }

        const draft = body.data.draft;
        setPrompt(draft.prompt);

        if (draft.params?.size) {
          setSize(draft.params.size);
        }

        if (draft.params?.quality) {
          setQuality(draft.params.quality);
        }

        if (draft.params?.output_format) {
          setOutputFormat(draft.params.output_format);
        }

        if (draft.params?.n) {
          setN(draft.params.n);
        }

        if ("output_compression" in (draft.params ?? {})) {
          setOutputCompression(
            draft.params?.output_compression === null ||
              draft.params?.output_compression === undefined
              ? ""
              : String(draft.params.output_compression)
          );
        }

        if (draft.params?.moderation) {
          setModeration(draft.params.moderation);
        }

        setActiveProjectId("same");
        setActiveConversationId("new");
        setActiveNodeId(null);
        setMode("text");
        setErrorMessage("");
      } catch {
        if (active) {
          setErrorMessage("无法读取社区同款草稿。");
        }
      }
    }

    void loadSameGenerationDraft();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!maskEnabled || !referenceImage) {
      return;
    }

    const canvas = maskCanvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    canvas.width = maskCanvasSize;
    canvas.height = maskCanvasSize;
    context.globalCompositeOperation = "source-over";
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(255,255,255,1)";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }, [maskEnabled, referenceImage]);

  async function submitGeneration() {
    if (!prompt.trim() || isGenerating) {
      setErrorMessage("Prompt 不能为空。");
      return;
    }

    setIsGenerating(true);
    setErrorMessage("");
    setPartialImages([]);

    const requestParams = buildGenerationRequest();
    if (mode === "image" && !referenceImage) {
      setIsGenerating(false);
      setErrorMessage("请先上传一张参考图。");
      return;
    }

    if (streamEnabled && mode === "text") {
      await submitStreamingGeneration(requestParams);
      return;
    }

    let maskFile: File | undefined;

    if (mode === "image" && maskEnabled) {
      try {
        maskFile = await exportMaskFile();
      } catch {
        setIsGenerating(false);
        setErrorMessage("遮罩导出失败，请清空遮罩后重试。");
        return;
      }
    }

    try {
      const taskType = mode === "image" ? "edit" : "generation";
      setCurrentTask({
        status: "submitting",
        type: taskType,
        prompt: requestParams.prompt
      });

      const response = await fetch(
        mode === "image" ? "/api/images/edits" : "/api/images/generations",
        mode === "image" && referenceImages.length > 0
          ? {
              method: "POST",
              body: buildEditFormData(requestParams, referenceImages, maskFile)
            }
          : {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(requestParams)
            }
      );
      const body = (await response.json()) as ApiGenerationResponse;

      if (!response.ok || !body.data) {
        setErrorMessage(formatApiError(body));
        setCurrentTask({
          status: "failed",
          type: taskType,
          prompt: requestParams.prompt,
          error: body.error
        });
        return;
      }

      const nextResult: GenerationResult = {
        ...body.data,
        request_id: body.request_id ?? "",
        upstream_request_id: body.upstream_request_id
      };
      commitGenerationResult(nextResult, requestParams);
      setCurrentTask({
        id: nextResult.task_id,
        type: taskType,
        status: "succeeded",
        prompt: requestParams.prompt,
        images: nextResult.images,
        usage: nextResult.usage,
        duration_ms: nextResult.duration_ms,
        upstream_request_id: nextResult.upstream_request_id
      });
      void refreshTaskStatus(nextResult.task_id);

    } catch {
      setErrorMessage("网络错误，请检查服务和 session。");
      setCurrentTask({
        status: "failed",
        type: mode === "image" ? "edit" : "generation",
        prompt: requestParams.prompt,
        error: {
          code: "network_error",
          message: "网络错误，请检查服务和 session。"
        }
      });
    } finally {
      setIsGenerating(false);
    }
  }

  async function submitStreamingGeneration(requestParams: ImageGenerationParams) {
    setCurrentTask({
      status: "submitting",
      type: "generation",
      prompt: requestParams.prompt
    });

    try {
      const response = await fetch("/api/images/generations/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...requestParams,
          stream: true,
          partial_images: partialImageCount
        })
      });

      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => ({}))) as ApiGenerationResponse;
        setErrorMessage(formatApiError(body));
        setCurrentTask({
          status: "failed",
          type: "generation",
          prompt: requestParams.prompt,
          error: body.error
        });
        return;
      }

      await readGenerationStream(response.body, requestParams);
    } catch {
      setErrorMessage("网络错误，请检查流式生成服务。");
      setCurrentTask({
        status: "failed",
        type: "generation",
        prompt: requestParams.prompt,
        error: {
          code: "network_error",
          message: "网络错误，请检查流式生成服务。"
        }
      });
    } finally {
      setIsGenerating(false);
    }
  }

  async function readGenerationStream(
    body: ReadableStream<Uint8Array>,
    requestParams: ImageGenerationParams
  ) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let requestId = "";
    let upstreamRequestId: string | undefined;

    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split(/\r?\n\r?\n/);
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const event = parseSseBlock(part);
        const data = parseJsonRecord(event.data);

        if (event.event === "task_started") {
          requestId = readString(data, "request_id") ?? "";
          upstreamRequestId = readString(data, "upstream_request_id");
          setCurrentTask({
            id: readString(data, "task_id"),
            type: "generation",
            status: "running",
            prompt: requestParams.prompt,
            upstream_request_id: upstreamRequestId
          });
        }

        if (event.event === "partial_image") {
          const partial = parseGenerationImage(data);

          if (partial) {
            setPartialImages((items) => [...items, partial]);
          }
        }

        if (event.event === "completed") {
          const taskId = readString(data, "task_id") ?? "";
          const images = parseGenerationImages(data);
          const usage = parseUsage(data);
          const durationMs = readNumber(data, "duration_ms") ?? 0;
          const nextResult: GenerationResult = {
            task_id: taskId,
            images,
            usage,
            duration_ms: durationMs,
            request_id: requestId,
            upstream_request_id: upstreamRequestId
          };

          commitGenerationResult(nextResult, requestParams);
          setCurrentTask({
            id: taskId,
            type: "generation",
            status: "succeeded",
            prompt: requestParams.prompt,
            images,
            usage,
            duration_ms: durationMs,
            upstream_request_id: upstreamRequestId
          });
        }

        if (event.event === "error") {
          const message = readString(data, "message") ?? "流式生成失败。";
          setErrorMessage(message);
          setCurrentTask({
            id: readString(data, "task_id"),
            type: "generation",
            status: "failed",
            prompt: requestParams.prompt,
            error: {
              code: readString(data, "code") ?? "upstream_error",
              message
            }
          });
        }
      }
    }
  }

  function commitGenerationResult(
    nextResult: GenerationResult,
    requestParams: ImageGenerationParams
  ) {
    const firstImage = nextResult.images[0];
    if (!firstImage) {
      return;
    }

    const createdAt = new Date().toISOString();
    const parentId =
      activeConversationId === "new" ? null : forkParentId ?? activeNodeId;
    const versionNode = createVersionNode({
      existingNodes: versionNodes,
      parentId,
      id: `node_${nextResult.task_id}`,
      prompt: requestParams.prompt,
      params: requestParams,
      images: nextResult.images,
      requestId: nextResult.request_id,
      upstreamRequestId: nextResult.upstream_request_id,
      usage: nextResult.usage,
      durationMs: nextResult.duration_ms,
      source: mode === "image" ? "edit" : "generation",
      createdAt
    });
    const historyItem: LocalHistoryItem = {
      taskId: nextResult.task_id,
      prompt: requestParams.prompt,
      params: {
        model: requestParams.model,
        size: requestParams.size,
        quality: requestParams.quality,
        n: requestParams.n,
        output_format: requestParams.output_format,
        output_compression: requestParams.output_compression,
        background: requestParams.background,
        moderation: requestParams.moderation
      },
      thumbnailUrl: firstImage.url,
      images: nextResult.images,
      parentTaskId: versionNode.parentId,
      branchId: versionNode.branchId,
      branchLabel: versionNode.branchLabel,
      versionNodeId: versionNode.id,
      requestId: nextResult.request_id,
      durationMs: nextResult.duration_ms,
      totalTokens: nextResult.usage.total_tokens,
      createdAt
    };

    setVersionNodes((nodes) => [...nodes, versionNode]);
    setNodeProjectIds((projects) => ({
      ...projects,
      [versionNode.id]: activeProjectId
    }));
    setActiveNodeId(versionNode.id);
    setActiveConversationId(`branch:${versionNode.branchId}`);
    setForkParentId(null);
    setHistoryItems((items) => [historyItem, ...items]);
    void saveLocalHistoryItem(historyItem).catch(() => undefined);
  }

  function buildGenerationRequest(): ImageGenerationParams {
    return {
      ...imageGenerationDefaults,
      prompt,
      size,
      quality,
      n,
      output_format: outputFormat,
      output_compression:
        outputFormat === "png" || outputCompression.trim() === ""
          ? null
          : Number(outputCompression),
      moderation
    };
  }



  async function refreshTaskStatus(taskId: string) {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, { method: "GET" });
      const body = (await response.json()) as ApiTaskResponse;

      if (response.ok && body.data && isImageTaskSnapshot(body.data)) {
        setCurrentTask(body.data);
      }
    } catch {
      // 任务状态刷新失败不影响已返回的生成结果。
    }
  }

  async function cancelCurrentTask() {
    if (!currentTask?.id || !canCancelTask(currentTask)) {
      return;
    }

    try {
      const response = await fetch(`/api/tasks/${currentTask.id}`, {
        method: "POST"
      });
      const body = (await response.json()) as ApiTaskResponse;

      if (!response.ok || !body.data || !isImageTaskSnapshot(body.data)) {
        setErrorMessage(formatTaskError(body));
        return;
      }

      setCurrentTask(body.data);
    } catch {
      setErrorMessage("取消任务失败，请检查网络。");
    }
  }


  async function optimizePrompt() {
    if (!prompt.trim() || isAssistingPrompt) {
      setErrorMessage("Prompt 不能为空。");
      return;
    }

    setIsAssistingPrompt(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/prompts/assist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt,
          mode,
          template_id: selectedTemplateId
        })
      });
      const body = (await response.json()) as ApiPromptAssistResponse;

      if (!response.ok || !body.data) {
        setErrorMessage(body.error?.message ?? "Prompt 优化失败。");
        return;
      }

      setPrompt(body.data.optimized_prompt);
    } catch {
      setErrorMessage("Prompt 优化失败，请检查网络。");
    } finally {
      setIsAssistingPrompt(false);
    }
  }

  async function saveCurrentPromptFavorite() {
    if (!prompt.trim()) {
      setErrorMessage("Prompt 不能为空。");
      return;
    }

    const item = await savePromptFavorite({
      prompt,
      templateId: selectedTemplateId,
      mode
    });

    setPromptFavorites((items) => [
      item,
      ...items.filter((current) => current.prompt !== item.prompt)
    ]);
    setErrorMessage("");
  }

  function applyPromptFavorite(item: PromptFavoriteItem) {
    setPrompt(item.prompt);
    setMode(item.mode);
    if (item.templateId) {
      setSelectedTemplateId(item.templateId);
    }
    setErrorMessage("");
  }



  async function copyPrompt() {
    await navigator.clipboard?.writeText(prompt);
  }

  async function exportMaskFile() {
    if (!maskEnabled) {
      return undefined;
    }

    const canvas = maskCanvasRef.current;

    if (!canvas) {
      throw new Error("mask canvas missing");
    }

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });

    if (!blob) {
      throw new Error("mask export failed");
    }

    return new File([blob], "mask.png", { type: "image/png" });
  }


  function handleReferenceInput(event: ChangeEvent<HTMLInputElement>) {
    selectReferenceImages(Array.from(event.target.files ?? []));
  }

  function handleReferenceDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    selectReferenceImages(Array.from(event.dataTransfer.files));
  }

  function handleReferencePaste(event: ClipboardEvent<HTMLDivElement>) {
    const images = Array.from(event.clipboardData.files).filter((file) =>
      file.type.startsWith("image/")
    );

    selectReferenceImages(images);
  }

  function selectReferenceImages(files: File[]) {
    const images = files
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, 4);

    if (images.length === 0) {
      return;
    }

    setReferenceImages(images);
    setMaskEnabled(
      Boolean(
        commercialTemplates.find((template) => template.id === selectedTemplateId)
          ?.requiresMask
      )
    );
    setErrorMessage("");
  }

  function removeReferenceImage(index: number) {
    setReferenceImages((current) =>
      current.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  function resetMaskCanvas() {
    const canvas = maskCanvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    canvas.width = maskCanvasSize;
    canvas.height = maskCanvasSize;
    context.globalCompositeOperation = "source-over";
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(255,255,255,1)";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  function invertMaskCanvas() {
    const canvas = maskCanvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

    for (let index = 0; index < imageData.data.length; index += 4) {
      imageData.data[index] = 255;
      imageData.data[index + 1] = 255;
      imageData.data[index + 2] = 255;
      imageData.data[index + 3] = 255 - imageData.data[index + 3];
    }

    context.putImageData(imageData, 0, 0);
  }

  function startMaskStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    maskDrawingRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drawMaskStroke(event);
  }

  function continueMaskStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (maskDrawingRef.current) {
      drawMaskStroke(event);
    }
  }

  function stopMaskStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    maskDrawingRef.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  function drawMaskStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = maskCanvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    const rect = canvas.getBoundingClientRect();

    if (rect.width === 0 || rect.height === 0) {
      return;
    }

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    context.globalCompositeOperation =
      maskMode === "paint" ? "destination-out" : "source-over";
    context.fillStyle = "rgba(255,255,255,1)";
    context.beginPath();
    context.arc(x, y, maskBrushSize / 2, 0, Math.PI * 2);
    context.fill();
  }

  function selectCommercialTemplate(templateId: string) {
    const template = commercialTemplates.find((item) => item.id === templateId);

    setSelectedTemplateId(templateId);

    if (template) {
      const nextFieldValues = createTemplateFieldValues(
        template,
        prompt.trim() || template.name
      );

      setTemplateFieldValues(nextFieldValues);
      applyTemplateRender(template, nextFieldValues);
    }
  }

  function updateTemplateFieldValue(key: string, value: TemplateFieldValue) {
    setTemplateFieldValues((current) => ({
      ...current,
      [key]: value
    }));
  }

  function applySelectedTemplate() {
    if (!selectedTemplate) {
      return;
    }

    applyTemplateRender(selectedTemplate, templateFieldValues);
  }

  function applyTemplateRender(
    template: CommercialTemplate,
    fieldValues: TemplateFieldValues
  ) {
    const missingField = template.fields.find((field) => {
      const value = fieldValues[field.key];

      return (
        field.required &&
        field.defaultValue === undefined &&
        (value === undefined ||
          (typeof value === "string" && value.trim().length === 0))
      );
    });

    if (missingField) {
      setErrorMessage(`${missingField.label} 不能为空。`);
      return;
    }

    const rendered = renderCommercialPrompt(template.id, fieldValues);

    setPrompt(rendered.prompt);
    setSize(rendered.params.size);
    setQuality(rendered.params.quality);
    setOutputFormat(rendered.params.output_format);
    setN(rendered.params.n);
    setOutputCompression(
      rendered.params.output_compression === null
        ? ""
        : String(rendered.params.output_compression)
    );
    setModeration(rendered.params.moderation);
    setMode(template.requiresImage ? "image" : "text");
    setMaskEnabled(Boolean(template.requiresMask));
    setErrorMessage("");
  }

  function selectCommercialSize(presetId: string) {
    const preset = commercialSizePresets.find((item) => item.id === presetId);

    if (preset) {
      setSize(preset.size);
    }
  }

  function renderTemplateField(field: CommercialTemplate["fields"][number]) {
    const fieldId = `template-field-${field.key}`;
    const value = templateFieldValues[field.key] ?? field.defaultValue ?? "";

    if (field.type === "boolean") {
      return (
        <label className="checkbox-row template-checkbox-field" key={field.key}>
          <input
            aria-label={field.label}
            checked={Boolean(value)}
            onChange={(event) =>
              updateTemplateFieldValue(field.key, event.currentTarget.checked)
            }
            type="checkbox"
          />
          {field.label}
        </label>
      );
    }

    if (field.type === "select") {
      const optionValue = typeof value === "string" ? value : "";
      const options =
        field.options && field.options.length > 0 ? field.options : [optionValue];

      return (
        <div className="field template-field" key={field.key}>
          <label htmlFor={fieldId}>{field.label}</label>
          <select
            aria-required={field.required}
            className="select"
            id={fieldId}
            onChange={(event) =>
              updateTemplateFieldValue(field.key, event.target.value)
            }
            value={optionValue}
          >
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      );
    }

    return (
      <div className="field template-field" key={field.key}>
        <label htmlFor={fieldId}>{field.label}</label>
        <input
          aria-required={field.required}
          className="input"
          id={fieldId}
          onChange={(event) =>
            updateTemplateFieldValue(field.key, event.target.value)
          }
          type="text"
          value={typeof value === "string" ? value : ""}
        />
      </div>
    );
  }

  async function handleResultAsReference(image: GenerationImage) {
    try {
      const reference = await fetchReferenceImageFile({
        url: image.url,
        fileName: `${image.asset_id}.${image.format}`,
        fallbackType: mimeTypeForFormat(image.format)
      });

      setReferenceImages([reference]);
      setMode("image");
      setErrorMessage("");
    } catch {
      setErrorMessage("无法读取生成结果作为参考图。");
    }
  }

  async function loadServerLibrary() {
    setLibraryStatus("loading");

    const params = new URLSearchParams({ limit: "30" });

    if (libraryFavoriteOnly) {
      params.set("favorite", "true");
    }

    if (libraryTagFilter.trim()) {
      params.set("tag", libraryTagFilter.trim());
    }

    try {
      const response = await fetch(`/api/library?${params.toString()}`, {
        method: "GET"
      });
      const body = (await response.json()) as ApiLibraryResponse;

      if (!response.ok || !body.data) {
        setLibraryStatus("unavailable");
        return;
      }

      setLibraryItems(body.data.items);
      setLibraryStatus("loaded");
    } catch {
      setLibraryStatus("unavailable");
    }
  }

  async function toggleLibraryFavorite(item: LibraryAssetItem) {
    try {
      const response = await fetch(`/api/library/${item.asset_id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          favorite: !item.favorite,
          tags: item.tags
        })
      });
      const body = (await response.json()) as ApiLibraryPatchResponse;

      if (!response.ok || !body.data) {
        setErrorMessage(body.error?.message ?? "素材收藏状态更新失败。");
        return;
      }

      setLibraryItems((items) =>
        items.map((current) =>
          current.asset_id === body.data?.asset_id ? body.data : current
        )
      );
    } catch {
      setErrorMessage("素材收藏状态更新失败。");
    }
  }

  async function publishLibraryItem(
    event: FormEvent<HTMLFormElement>,
    item: LibraryAssetItem
  ) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const title = readFormString(formData, "title") || defaultCommunityTitle(item);
    const visibility = readFormString(formData, "visibility") || "private";

    setPublishingAssetId(item.asset_id);
    setPublishMessages((messages) => ({
      ...messages,
      [item.asset_id]: "发布中"
    }));

    try {
      const response = await fetch("/api/community/works", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          task_id: item.task_id,
          asset_id: item.asset_id,
          visibility,
          title,
          scene: "general",
          tags: item.tags,
          disclose_prompt: formData.get("disclose_prompt") === "on",
          disclose_params: formData.get("disclose_params") === "on",
          disclose_reference_images:
            formData.get("disclose_reference_images") === "on",
          allow_same_generation: formData.get("allow_same_generation") === "on",
          allow_reference_reuse: formData.get("allow_reference_reuse") === "on",
          public_confirmed: formData.get("public_confirmed") === "on"
        })
      });
      const body = (await response.json()) as ApiCommunityWorkResponse;

      if (!response.ok || !body.data) {
        setPublishMessages((messages) => ({
          ...messages,
          [item.asset_id]: body.error?.message ?? "发布失败"
        }));
        return;
      }

      setPublishMessages((messages) => ({
        ...messages,
        [item.asset_id]: `已发布：${body.data?.work_id ?? ""}`
      }));
      setPublishAssetId(null);
    } catch {
      setPublishMessages((messages) => ({
        ...messages,
        [item.asset_id]: "发布失败，请检查网络。"
      }));
    } finally {
      setPublishingAssetId(null);
    }
  }

  async function handleLibraryContinueEdit(item: LibraryAssetItem) {
    try {
      const reference = await fetchReferenceImageFile({
        url: item.thumbnail_url,
        fileName: libraryReferenceName(item),
        fallbackType: mimeTypeForFormat(item.format)
      });

      setReferenceImages([reference]);
      setPrompt(item.prompt);
      setSize(item.params.size);
      setQuality(item.params.quality);
      setOutputFormat(item.params.output_format);
      setN(item.params.n);
      setOutputCompression(
        item.params.output_compression === null
          ? ""
          : String(item.params.output_compression)
      );
      setModeration(item.params.moderation);
      setMode("image");
      setErrorMessage("");
    } catch {
      setErrorMessage("无法读取素材作为参考图。");
    }
  }

  async function handleHistoryContinueEdit(item: LocalHistoryItem) {
    try {
      const format = item.params.output_format;
      const reference = await fetchReferenceImageFile({
        url: item.thumbnailUrl,
        fileName: historyReferenceName(item),
        fallbackType: mimeTypeForFormat(format)
      });

      setReferenceImages([reference]);
      setPrompt(item.prompt);
      setSize(item.params.size);
      setQuality(item.params.quality);
      setOutputFormat(format);
      setN(item.params.n);
      setOutputCompression(
        item.params.output_compression === null
          ? ""
          : String(item.params.output_compression)
      );
      setModeration(item.params.moderation);
      setMode("image");
      setErrorMessage("");
    } catch {
      setErrorMessage("无法读取历史结果作为参考图。");
    }
  }

  function historyReferenceName(item: LocalHistoryItem) {
    const assetName = item.thumbnailUrl.split("/").filter(Boolean).at(-1) ?? item.taskId;
    const extension = item.params.output_format === "jpeg" ? "jpg" : item.params.output_format;

    return `${assetName}.${extension}`;
  }

  function libraryReferenceName(item: LibraryAssetItem) {
    const extension = item.format === "jpeg" ? "jpg" : item.format;

    return `${item.asset_id}.${extension}`;
  }

  function defaultCommunityTitle(item: LibraryAssetItem) {
    return item.prompt.trim().slice(0, 28) || item.asset_id;
  }

  function readFormString(formData: FormData, key: string) {
    const value = formData.get(key);

    return typeof value === "string" ? value.trim() : "";
  }

  function restoreVersionNodeParams(node: CreatorVersionNode) {
    setPrompt(node.prompt);
    setSize(node.params.size);
    setQuality(node.params.quality);
    setOutputFormat(node.params.output_format);
    setN(node.params.n);
    setOutputCompression(
      node.params.output_compression === null
        ? ""
        : String(node.params.output_compression)
    );
    setModeration(node.params.moderation);
    setErrorMessage("");
  }

  function returnToVersionNode(node: CreatorVersionNode) {
    setActiveProjectId(nodeProjectIds[node.id] ?? "commercial");
    setActiveConversationId(`branch:${node.branchId}`);
    setActiveNodeId(node.id);
    setForkParentId(null);
    setErrorMessage("");
  }

  function startVersionFork(node: CreatorVersionNode) {
    setActiveProjectId(nodeProjectIds[node.id] ?? "commercial");
    setActiveConversationId(`branch:${node.branchId}`);
    setActiveNodeId(node.id);
    setForkParentId(node.id);
    restoreVersionNodeParams(node);
  }

  function selectProject(projectId: CreatorProjectId) {
    const nextProjectNodes = versionNodes.filter(
      (node) => (nodeProjectIds[node.id] ?? "commercial") === projectId
    );
    const latestNode = [...nextProjectNodes].sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    )[0];

    setActiveProjectId(projectId);
    setActiveConversationId(latestNode ? "all" : "new");
    setActiveNodeId(latestNode?.id ?? null);
    setForkParentId(null);
    setErrorMessage("");
  }

  function selectConversation(conversationId: CreatorConversationId) {
    if (conversationId === "new") {
      setActiveConversationId("new");
      setActiveNodeId(null);
      setForkParentId(null);
      setPrompt("");
      setErrorMessage("");
      return;
    }

    const nextNodes = conversationId.startsWith("branch:")
      ? projectVersionNodes.filter(
          (node) => node.branchId === conversationId.slice("branch:".length)
        )
      : projectVersionNodes;
    const latestNode = [...nextNodes].sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    )[0];

    setActiveConversationId(conversationId);
    setActiveNodeId(latestNode?.id ?? null);
    setForkParentId(null);
    setErrorMessage("");
  }

  const useCodexChatStudio =
    process.env.NEXT_PUBLIC_PSYPIC_LEGACY_CREATOR !== "1";
  const currentConversationTitle =
    activeConversationId === "new"
      ? activeProject.emptyTitle
      : activeConversationId === "all"
      ? activeProject.emptyTitle
      : activeBranchSummary?.latestNode?.prompt.slice(0, 30) ||
        activeBranchSummary?.label ||
        activeProject.emptyTitle;

  if (useCodexChatStudio) {
    return (
      <AppShell
        bodyClassName="product-workbench-body"
        currentPath="/"
        showAdminLink={showAdminLink}
      >
        <CreatorStudioProvider
          value={{
            activeNodeId,
            returnToVersionNode,
            restoreVersionNodeParams,
            startVersionFork,
            submitGeneration,
            copyPrompt,
            handleResultAsReference
          }}
        >
        <main className="chat-studio-shell" data-testid="chat-studio-shell">
        <ProjectSidebar
          activeConversationId={activeConversationId}
          activeProjectId={activeProjectId}
          activeProjectTitle={activeProject.title}
          onSelectConversation={selectConversation}
          onSelectProject={selectProject}
          sidebarProjects={sidebarProjects}
        />

        <section className="chat-workspace" data-testid="center-workspace">
          <ChatHeader
            conversationTitle={currentConversationTitle}
            forkParentId={forkParentId}
          />

          <div
            className="chat-transcript"
            data-testid="chat-transcript"
            aria-label="创作对话流"
          >
            {displayedVersionNodes.length === 0 ? (
              <ChatEmptyState
                emptyDescription={activeProject.emptyDescription}
                emptyTitle={activeProject.emptyTitle}
              />
            ) : (
              displayedVersionNodes.map((node, index) => (
                <ChatTurn key={node.id} index={index} node={node} />
              ))
            )}

            <TaskStatusStrip
              currentTask={currentTask}
              isGenerating={isGenerating}
              onCancelTask={() => void cancelCurrentTask()}
              onRefreshTask={(taskId) => void refreshTaskStatus(taskId)}
              onRetryGeneration={submitGeneration}
            />

            <PartialPreviewStrip partialImages={partialImages} />
          </div>

          <div className="chat-composer" data-testid="prompt-composer">
            <div className="composer-inner">
              <div className="composer-context-row">
                <span>{mode === "image" ? "图生图" : "文生图"}</span>
                <span>{size}</span>
                <span>{quality}</span>
                <span>{n} 张</span>
                <span>{outputFormat}</span>
                {streamEnabled ? <span>stream</span> : null}
              </div>
              <label className="sr-only" htmlFor="prompt">
                Prompt
              </label>
              <textarea
                className="chat-prompt-input"
                id="prompt"
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="描述你要生成的商业图片"
                value={prompt}
              />
              <div className="composer-actions">
                <span className="inline-hint">
                  {forkParentId
                    ? "当前上下文：独立分支。"
                    : "默认不生成文字，不改变参考图主体。"}
                </span>
                <div className="prompt-action-buttons">
                  <button
                    className="secondary-button"
                    disabled={isAssistingPrompt || isGenerating}
                    onClick={optimizePrompt}
                    type="button"
                  >
                    <Sparkles size={16} aria-hidden="true" />
                    {isAssistingPrompt ? "优化中" : "优化 Prompt"}
                  </button>
                  <button
                    className="secondary-button"
                    disabled={isGenerating}
                    onClick={() => void saveCurrentPromptFavorite()}
                    type="button"
                  >
                    <Star size={16} aria-hidden="true" />
                    收藏 Prompt
                  </button>
                  <button
                    className="primary-button"
                    disabled={isGenerating}
                    onClick={submitGeneration}
                    type="button"
                  >
                    <Play size={16} aria-hidden="true" />
                    {isGenerating ? "生成中" : "生成图片"}
                  </button>
                </div>
              </div>
              {errorMessage ? (
                <p className="error-message" role="alert">
                  {errorMessage}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <aside
          className="studio-inspector"
          data-testid="right-history-panel"
          aria-label="参数、素材与 Inspector"
        >
          <div className="inspector-scroll">
            <section className="inspector-section">
              <div className="section-heading">
                <SlidersHorizontal size={15} aria-hidden="true" />
                <strong>生成参数</strong>
              </div>
              <div className="field-stack">
                <div className="field">
                  <div className="field-label">模式</div>
                  <div className="segmented">
                    <button
                      className={`segment ${mode === "text" ? "active" : ""}`}
                      onClick={() => setMode("text")}
                      type="button"
                    >
                      文生图
                    </button>
                    <button
                      className={`segment ${mode === "image" ? "active" : ""}`}
                      onClick={() => setMode("image")}
                      type="button"
                    >
                      图生图
                    </button>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="model">模型</label>
                  <select className="select" id="model" defaultValue="gpt-image-2">
                    <option value="gpt-image-2">gpt-image-2</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="commercial-size">商业尺寸</label>
                  <select
                    className="select"
                    id="commercial-size"
                    onChange={(event) => selectCommercialSize(event.target.value)}
                    value={selectedCommercialSizeId}
                  >
                    {commercialSizePresets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label} · {preset.size}
                      </option>
                    ))}
                    <option value="custom">按尺寸选择</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="size">尺寸</label>
                  <select
                    className="select"
                    id="size"
                    onChange={(event) =>
                      setSize(event.target.value as ImageGenerationParams["size"])
                    }
                    value={size}
                  >
                    {GENERATION_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size === "auto" ? "自动" : size}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <div className="field-label">质量</div>
                  <div className="segmented three">
                    {qualityOptions.map((option) => (
                      <button
                        className={`segment ${
                          option.value === quality ? "active" : ""
                        }`}
                        key={option.value}
                        onClick={() => setQuality(option.value)}
                        type="button"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="output-format">输出格式</label>
                  <select
                    className="select"
                    id="output-format"
                    onChange={(event) =>
                      setOutputFormat(
                        event.target
                          .value as ImageGenerationParams["output_format"]
                      )
                    }
                    value={outputFormat}
                  >
                    <option value="png">PNG</option>
                    <option value="jpeg">JPEG</option>
                    <option value="webp">WebP</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="count">数量</label>
                  <input
                    className="input"
                    id="count"
                    min={1}
                    max={8}
                    onChange={(event) => setN(Number(event.target.value))}
                    type="number"
                    value={n}
                  />
                </div>

                <label className="toggle-row">
                  <input
                    aria-label="流式预览"
                    checked={streamEnabled}
                    onChange={(event) => setStreamEnabled(event.target.checked)}
                    type="checkbox"
                  />
                  <span>流式预览</span>
                </label>

                {streamEnabled ? (
                  <div className="field">
                    <label htmlFor="partial-images">Partial Images</label>
                    <select
                      className="select"
                      id="partial-images"
                      onChange={(event) =>
                        setPartialImageCount(Number(event.target.value))
                      }
                      value={partialImageCount}
                    >
                      <option value={0}>0</option>
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                    </select>
                  </div>
                ) : null}

                <button
                  aria-expanded={advancedOpen}
                  className="secondary-button"
                  onClick={() => setAdvancedOpen((open) => !open)}
                  type="button"
                >
                  <SlidersHorizontal size={16} aria-hidden="true" />
                  高级参数
                </button>

                {advancedOpen ? (
                  <div className="field-stack">
                    <div className="field">
                      <label htmlFor="compression">Output Compression</label>
                      <input
                        className="input"
                        id="compression"
                        max={100}
                        min={1}
                        onChange={(event) => setOutputCompression(event.target.value)}
                        type="number"
                        placeholder="仅 JPEG/WebP"
                        value={outputCompression}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="moderation">Moderation</label>
                      <select
                        className="select"
                        id="moderation"
                        onChange={(event) =>
                          setModeration(
                            event.target
                              .value as ImageGenerationParams["moderation"]
                          )
                        }
                        value={moderation}
                      >
                        <option value="auto">auto</option>
                        <option value="low">low</option>
                      </select>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            {mode === "image" ? (
              <section className="inspector-section">
                <div
                  className="reference-dropzone"
                  data-testid="reference-dropzone"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleReferenceDrop}
                  onPaste={handleReferencePaste}
                  tabIndex={0}
                >
                  <label className="reference-upload">
                    <input
                      accept="image/png,image/jpeg,image/webp"
                      aria-label="参考图"
                      multiple
                      onChange={handleReferenceInput}
                      type="file"
                    />
                    <ImagePlus size={18} aria-hidden="true" />
                    <span>
                      <strong>参考图</strong>
                      <span>
                        {referenceImages.length > 0
                          ? `${referenceImages.length} 张参考图`
                          : "点击、拖拽或粘贴图片"}
                      </span>
                    </span>
                  </label>
                  {referenceImages.length > 0 ? (
                    <div className="reference-list">
                      {referenceImages.map((image, index) => (
                        <div
                          className="reference-preview-item"
                          key={`${image.name}-${image.lastModified}-${index}`}
                        >
                          {referencePreviews[index] ? (
                            <img
                              alt={`参考图 ${image.name}`}
                              src={referencePreviews[index].url}
                            />
                          ) : null}
                          <span className="reference-preview-name">{image.name}</span>
                          <button
                            aria-label={`移除参考图 ${image.name}`}
                            onClick={() => removeReferenceImage(index)}
                            type="button"
                          >
                            <X size={12} aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                {referenceImage ? (
                  <section className="mask-editor" aria-label="遮罩编辑器">
                    <label className="toggle-row">
                      <input
                        aria-label="遮罩编辑"
                        checked={maskEnabled}
                        onChange={(event) => setMaskEnabled(event.target.checked)}
                        type="checkbox"
                      />
                      <span>遮罩编辑</span>
                    </label>
                    {maskEnabled ? (
                      <div className="mask-editor-body">
                        <div className="mask-toolbar">
                          <div className="segmented" aria-label="遮罩模式">
                            <button
                              className={`segment ${
                                maskMode === "paint" ? "active" : ""
                              }`}
                              onClick={() => setMaskMode("paint")}
                              type="button"
                            >
                              <Brush size={15} aria-hidden="true" />
                              涂抹
                            </button>
                            <button
                              className={`segment ${
                                maskMode === "restore" ? "active" : ""
                              }`}
                              onClick={() => setMaskMode("restore")}
                              type="button"
                            >
                              <Eraser size={15} aria-hidden="true" />
                              还原
                            </button>
                          </div>
                          <label className="mask-size-control">
                            <span>画笔大小</span>
                            <input
                              aria-label="画笔大小"
                              max={120}
                              min={8}
                              onChange={(event) =>
                                setMaskBrushSize(Number(event.target.value))
                              }
                              type="range"
                              value={maskBrushSize}
                            />
                          </label>
                          <button
                            className="secondary-button"
                            onClick={resetMaskCanvas}
                            type="button"
                          >
                            <RotateCcw size={16} aria-hidden="true" />
                            清空遮罩
                          </button>
                          <button
                            className="secondary-button"
                            onClick={invertMaskCanvas}
                            type="button"
                          >
                            <FlipHorizontal size={16} aria-hidden="true" />
                            反选遮罩
                          </button>
                        </div>
                        <canvas
                          aria-label="遮罩画布"
                          className="mask-canvas"
                          height={maskCanvasSize}
                          onPointerCancel={stopMaskStroke}
                          onPointerDown={startMaskStroke}
                          onPointerLeave={stopMaskStroke}
                          onPointerMove={continueMaskStroke}
                          onPointerUp={stopMaskStroke}
                          ref={maskCanvasRef}
                          width={maskCanvasSize}
                        />
                      </div>
                    ) : null}
                  </section>
                ) : null}
              </section>
            ) : null}

            <section
              className="inspector-section"
              data-testid="commercial-template-list"
            >
              <div className="section-heading">
                <Sparkles size={15} aria-hidden="true" />
                <strong>商业模板</strong>
              </div>
              {selectedTemplate ? (
                <div className="template-field-editor" aria-label="模板字段">
                  <div className="template-editor-header">
                    <strong>{selectedTemplate.name}</strong>
                    <span>{selectedTemplate.description}</span>
                  </div>
                  <div className="template-field-grid">
                    {selectedTemplate.fields.map(renderTemplateField)}
                  </div>
                  <button
                    className="primary-button"
                    onClick={applySelectedTemplate}
                    type="button"
                  >
                    <Sparkles size={16} aria-hidden="true" />
                    应用模板
                  </button>
                </div>
              ) : null}
              <div className="template-list">
                {mvpTemplates.map((template) => (
                  <button
                    className="template-button"
                    key={template.id}
                    onClick={() => selectCommercialTemplate(template.id)}
                    type="button"
                  >
                    <span>
                      <strong>{template.name}</strong>
                      <span>{template.description}</span>
                    </span>
                    <span className="template-pill">
                      {template.requiresImage ? "需参考图" : "文生图"}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <VersionStreamSection
              activeNodeId={activeNodeId}
              forkParentId={forkParentId}
              onRestoreNodeParams={restoreVersionNodeParams}
              onReturnToNode={returnToVersionNode}
              onStartFork={startVersionFork}
              projectVersionNodes={projectVersionNodes}
            />

            <BranchMapSection
              activeNodeId={activeNodeId}
              projectVersionNodes={projectVersionNodes}
            />

            <NodeInspectorSection activeVersionNode={activeVersionNode} />

            <BatchWorkflowPanel defaultSize={size} />

            <section className="inspector-section">
              <div className="section-heading">
                <History size={15} aria-hidden="true" />
                <strong>素材与历史</strong>
                <button
                  aria-label="同步素材库"
                  className="icon-button"
                  disabled={libraryStatus === "loading"}
                  onClick={() => void loadServerLibrary()}
                  title="同步素材库"
                  type="button"
                >
                  <RefreshCw size={16} aria-hidden="true" />
                </button>
              </div>
              <div className="library-toolbar">
                <label className="checkbox-row">
                  <input
                    aria-label="仅收藏素材"
                    checked={libraryFavoriteOnly}
                    onChange={(event) =>
                      setLibraryFavoriteOnly(event.currentTarget.checked)
                    }
                    type="checkbox"
                  />
                  仅收藏
                </label>
                <div className="library-tag-filter">
                  <Tags size={14} aria-hidden="true" />
                  <input
                    aria-label="素材标签过滤"
                    onChange={(event) => setLibraryTagFilter(event.target.value)}
                    placeholder="标签"
                    value={libraryTagFilter}
                  />
                </div>
              </div>

              {libraryStatus === "loading" ? (
                <div className="history-item">
                  <strong>同步中</strong>
                  <p>正在读取服务端素材库。</p>
                </div>
              ) : null}

              {libraryStatus === "unavailable" ? (
                <div className="history-item">
                  <strong>素材库暂不可用</strong>
                  <p>继续使用本地历史，不影响生成和继续编辑。</p>
                </div>
              ) : null}

              {promptFavorites.length > 0 ? (
                <div className="library-section">
                  {promptFavorites.map((item) => (
                    <div className="history-item" key={item.id}>
                      <strong>{item.title}</strong>
                      <p>{item.prompt}</p>
                      <p>{item.mode === "image" ? "图生图" : "文生图"}</p>
                      <div className="history-actions">
                        <button
                          className="secondary-button"
                          onClick={() => applyPromptFavorite(item)}
                          type="button"
                        >
                          <Copy size={16} aria-hidden="true" />
                          套用 Prompt
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {libraryItems.length > 0 ? (
                <div className="library-section">
                  {libraryItems.map((item) => (
                    <div className="history-item library-item" key={item.asset_id}>
                      <img
                        alt=""
                        className="library-thumb"
                        src={item.thumbnail_url}
                      />
                      <div className="library-item-body">
                        <strong>{item.asset_id}</strong>
                        <p>{item.prompt}</p>
                        <p>
                          {item.task_id}
                          {item.usage?.total_tokens
                            ? ` · ${item.usage.total_tokens} tokens`
                            : ""}
                          {item.duration_ms ? ` · ${item.duration_ms}ms` : ""}
                        </p>
                        {item.tags.length > 0 ? (
                          <div className="tag-list">
                            {item.tags.map((tag) => (
                              <span key={tag}>{tag}</span>
                            ))}
                          </div>
                        ) : null}
                        <div className="history-actions">
                          <button
                            className="secondary-button"
                            onClick={() => void handleLibraryContinueEdit(item)}
                            type="button"
                          >
                            <ImagePlus size={16} aria-hidden="true" />
                            继续编辑
                          </button>
                          <button
                            className="secondary-button"
                            onClick={() => void toggleLibraryFavorite(item)}
                            type="button"
                          >
                            <Star
                              fill={item.favorite ? "currentColor" : "none"}
                              size={16}
                              aria-hidden="true"
                            />
                            {item.favorite ? "取消收藏" : "收藏素材"}
                          </button>
                          <button
                            className="secondary-button"
                            onClick={() =>
                              setPublishAssetId((current) =>
                                current === item.asset_id ? null : item.asset_id
                              )
                            }
                            type="button"
                          >
                            <UploadCloud size={16} aria-hidden="true" />
                            发布作品
                          </button>
                          <Link
                            className="secondary-button"
                            href={`/library/${item.asset_id}`}
                          >
                            <ExternalLink size={16} aria-hidden="true" />
                            详情
                          </Link>
                        </div>
                        {publishAssetId === item.asset_id ? (
                          <CommunityPublishPanel
                            defaultTitle={defaultCommunityTitle(item)}
                            isPublishing={publishingAssetId === item.asset_id}
                            item={item}
                            onSubmit={(event) =>
                              void publishLibraryItem(event, item)
                            }
                          />
                        ) : null}
                        {publishMessages[item.asset_id] ? (
                          <p className="inline-hint">
                            {publishMessages[item.asset_id]}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {historyItems.length === 0 &&
              libraryItems.length === 0 &&
              promptFavorites.length === 0 ? (
                <div className="history-item">
                  <strong>尚未生成</strong>
                  <p>生成后会显示 prompt、参数、request id、耗时和 usage。</p>
                </div>
              ) : (
                historyItems.map((item) => (
                  <div className="history-item" key={item.taskId}>
                    <strong>{item.taskId}</strong>
                    <p>{item.prompt}</p>
                    <p>{item.requestId}</p>
                    <p>{item.totalTokens} tokens · {item.durationMs}ms</p>
                    <div className="history-actions">
                      <button
                        className="secondary-button"
                        onClick={() => void handleHistoryContinueEdit(item)}
                        type="button"
                      >
                        <ImagePlus size={16} aria-hidden="true" />
                        继续编辑
                      </button>
                    </div>
                  </div>
                ))
              )}
            </section>
          </div>
        </aside>

        <div className="mobile-bottom-bar">
          <button className="secondary-button" type="button">
            <PanelBottom size={16} aria-hidden="true" />
            打开参数面板
          </button>
          <button
            className="primary-button"
            disabled={isGenerating}
            onClick={submitGeneration}
            type="button"
          >
            <Play size={16} aria-hidden="true" />
            {isGenerating ? "生成中" : "生成"}
          </button>
        </div>
        </main>
        </CreatorStudioProvider>
      </AppShell>
    );
  }

  return (
    <AppShell
      bodyClassName="product-workbench-body"
      currentPath="/"
      showAdminLink={showAdminLink}
    >
      <main className="legacy-workbench-shell">
        <div className="creator-grid gallery-studio-shell" data-testid="creator-gallery-shell">
        <aside
          className="workspace-panel left-column"
          data-testid="left-parameter-panel"
        >
          <div className="panel-header">
            <div className="panel-title">
              <SlidersHorizontal size={16} aria-hidden="true" />
              参数
            </div>
          </div>
          <div className="panel-body field-stack">
            <div className="field">
              <div className="field-label">模式</div>
              <div className="segmented">
                <button
                  className={`segment ${mode === "text" ? "active" : ""}`}
                  onClick={() => setMode("text")}
                  type="button"
                >
                  文生图
                </button>
                <button
                  className={`segment ${mode === "image" ? "active" : ""}`}
                  onClick={() => setMode("image")}
                  type="button"
                >
                  图生图
                </button>
              </div>
            </div>

            <div className="field">
              <label htmlFor="model">模型</label>
              <select className="select" id="model" defaultValue="gpt-image-2">
                <option value="gpt-image-2">gpt-image-2</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="commercial-size">商业尺寸</label>
              <select
                className="select"
                id="commercial-size"
                onChange={(event) => selectCommercialSize(event.target.value)}
                value={selectedCommercialSizeId}
              >
                {commercialSizePresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label} · {preset.size}
                  </option>
                ))}
                <option value="custom">按尺寸选择</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="size">尺寸</label>
              <select
                className="select"
                id="size"
                onChange={(event) =>
                  setSize(event.target.value as ImageGenerationParams["size"])
                }
                value={size}
              >
                {GENERATION_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size === "auto" ? "自动" : size}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <div className="field-label">质量</div>
              <div className="segmented three">
                {qualityOptions.map((option) => (
                  <button
                    className={`segment ${option.value === quality ? "active" : ""}`}
                    key={option.value}
                    onClick={() => setQuality(option.value)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label htmlFor="output-format">输出格式</label>
              <select
                className="select"
                id="output-format"
                onChange={(event) =>
                  setOutputFormat(
                    event.target.value as ImageGenerationParams["output_format"]
                  )
                }
                value={outputFormat}
              >
                <option value="png">PNG</option>
                <option value="jpeg">JPEG</option>
                <option value="webp">WebP</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="count">数量</label>
              <input
                className="input"
                id="count"
                min={1}
                max={4}
                onChange={(event) => setN(Number(event.target.value))}
                type="number"
                value={n}
              />
            </div>

            <label className="toggle-row">
              <input
                aria-label="流式预览"
                checked={streamEnabled}
                onChange={(event) => setStreamEnabled(event.target.checked)}
                type="checkbox"
              />
              <span>流式预览</span>
            </label>

            {streamEnabled ? (
              <div className="field">
                <label htmlFor="partial-images">Partial Images</label>
                <select
                  className="select"
                  id="partial-images"
                  onChange={(event) =>
                    setPartialImageCount(Number(event.target.value))
                  }
                  value={partialImageCount}
                >
                  <option value={0}>0</option>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </div>
            ) : null}

            <button
              aria-expanded={advancedOpen}
              className="secondary-button"
              onClick={() => setAdvancedOpen((open) => !open)}
              type="button"
            >
              <SlidersHorizontal size={16} aria-hidden="true" />
              高级参数
            </button>

            {advancedOpen ? (
              <div className="field-stack">
                <div className="field">
                  <label htmlFor="compression">Output Compression</label>
                  <input
                    className="input"
                    id="compression"
                    max={100}
                    min={1}
                    onChange={(event) => setOutputCompression(event.target.value)}
                    type="number"
                    placeholder="仅 JPEG/WebP"
                    value={outputCompression}
                  />
                </div>
                <div className="field">
                  <label htmlFor="moderation">Moderation</label>
                  <select
                    className="select"
                    id="moderation"
                    onChange={(event) =>
                      setModeration(
                        event.target
                          .value as ImageGenerationParams["moderation"]
                      )
                    }
                    value={moderation}
                  >
                    <option value="auto">auto</option>
                    <option value="low">low</option>
                  </select>
                </div>
              </div>
            ) : null}
          </div>
        </aside>

        <section
          className="workspace-panel center-panel"
          data-testid="center-workspace"
        >
          <div className="panel-header">
            <div className="panel-title">
              <Sparkles size={16} aria-hidden="true" />
              创作
            </div>
            <button className="secondary-button" type="button">
              <ImagePlus size={16} aria-hidden="true" />
              上传参考图
            </button>
          </div>
          <div className="panel-body field-stack">
            {mode === "image" ? (
              <div
                className="reference-dropzone"
                data-testid="reference-dropzone"
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleReferenceDrop}
                onPaste={handleReferencePaste}
                tabIndex={0}
              >
                <label className="reference-upload">
                  <input
                    accept="image/png,image/jpeg,image/webp"
                    aria-label="参考图"
                    multiple
                    onChange={handleReferenceInput}
                    type="file"
                  />
                  <ImagePlus size={18} aria-hidden="true" />
                  <span>
                    <strong>参考图</strong>
                    <span>
                      {referenceImages.length > 0
                        ? `${referenceImages.length} 张参考图`
                        : "点击、拖拽或粘贴图片"}
                    </span>
                  </span>
                </label>
                {referenceImages.length > 0 ? (
                  <div className="reference-list">
                    {referenceImages.map((image, index) => (
                      <div
                        className="reference-preview-item"
                        key={`${image.name}-${image.lastModified}-${index}`}
                      >
                        {referencePreviews[index] ? (
                          <img
                            alt={`参考图 ${image.name}`}
                            src={referencePreviews[index].url}
                          />
                        ) : null}
                        <span className="reference-preview-name">{image.name}</span>
                        <button
                          aria-label={`移除参考图 ${image.name}`}
                          onClick={() => removeReferenceImage(index)}
                          type="button"
                        >
                          <X size={12} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {mode === "image" && referenceImage ? (
              <section className="mask-editor" aria-label="遮罩编辑器">
                <label className="toggle-row">
                  <input
                    aria-label="遮罩编辑"
                    checked={maskEnabled}
                    onChange={(event) => setMaskEnabled(event.target.checked)}
                    type="checkbox"
                  />
                  <span>遮罩编辑</span>
                </label>
                {maskEnabled ? (
                  <div className="mask-editor-body">
                    <div className="mask-toolbar">
                      <div className="segmented" aria-label="遮罩模式">
                        <button
                          className={`segment ${maskMode === "paint" ? "active" : ""}`}
                          onClick={() => setMaskMode("paint")}
                          type="button"
                        >
                          <Brush size={15} aria-hidden="true" />
                          涂抹
                        </button>
                        <button
                          className={`segment ${maskMode === "restore" ? "active" : ""}`}
                          onClick={() => setMaskMode("restore")}
                          type="button"
                        >
                          <Eraser size={15} aria-hidden="true" />
                          还原
                        </button>
                      </div>
                      <label className="mask-size-control">
                        <span>画笔大小</span>
                        <input
                          aria-label="画笔大小"
                          max={120}
                          min={8}
                          onChange={(event) =>
                            setMaskBrushSize(Number(event.target.value))
                          }
                          type="range"
                          value={maskBrushSize}
                        />
                      </label>
                      <button
                        className="secondary-button"
                        onClick={resetMaskCanvas}
                        type="button"
                      >
                        <RotateCcw size={16} aria-hidden="true" />
                        清空遮罩
                      </button>
                      <button
                        className="secondary-button"
                        onClick={invertMaskCanvas}
                        type="button"
                      >
                        <FlipHorizontal size={16} aria-hidden="true" />
                        反选遮罩
                      </button>
                    </div>
                    <canvas
                      aria-label="遮罩画布"
                      className="mask-canvas"
                      height={maskCanvasSize}
                      onPointerCancel={stopMaskStroke}
                      onPointerDown={startMaskStroke}
                      onPointerLeave={stopMaskStroke}
                      onPointerMove={continueMaskStroke}
                      onPointerUp={stopMaskStroke}
                      ref={maskCanvasRef}
                      width={maskCanvasSize}
                    />
                  </div>
                ) : null}
              </section>
            ) : null}

            <div className="field prompt-composer" data-testid="prompt-composer">
              <label htmlFor="prompt">Prompt</label>
              <textarea
                className="textarea"
                id="prompt"
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="描述你要生成的商业图片"
                value={prompt}
              />
              <div className="prompt-actions">
                <span className="inline-hint">
                  默认不生成文字，不改变参考图主体。
                </span>
                <div className="prompt-action-buttons">
                  <button
                    className="secondary-button"
                    disabled={isAssistingPrompt || isGenerating}
                    onClick={optimizePrompt}
                    type="button"
                  >
                    <Sparkles size={16} aria-hidden="true" />
                    {isAssistingPrompt ? "优化中" : "优化 Prompt"}
                  </button>
                  <button
                    className="secondary-button"
                    disabled={isGenerating}
                    onClick={() => void saveCurrentPromptFavorite()}
                    type="button"
                  >
                    <Star size={16} aria-hidden="true" />
                    收藏 Prompt
                  </button>
                  <button
                    className="primary-button"
                    disabled={isGenerating}
                    onClick={submitGeneration}
                    type="button"
                  >
                    <Play size={16} aria-hidden="true" />
                    {isGenerating ? "生成中" : "生成图片"}
                  </button>
                </div>
              </div>
              {errorMessage ? (
                <p className="error-message" role="alert">
                  {errorMessage}
                </p>
              ) : null}
            </div>

            {currentTask ? (
              <section
                aria-label="任务状态"
                className={`task-status-strip task-status-${currentTask.status}`}
                role="status"
              >
                <div className="task-status-main">
                  <div>
                    <span className="field-label">任务状态</span>
                    <strong>{taskStatusLabels[currentTask.status]}</strong>
                  </div>
                  <span className="task-status-pill">
                    {currentTask.type ? taskTypeLabels[currentTask.type] : "任务"}
                  </span>
                </div>
                <div className="task-status-meta">
                  <span>{currentTask.id ?? "等待任务 ID"}</span>
                  {currentTask.duration_ms ? (
                    <span>{currentTask.duration_ms}ms</span>
                  ) : null}
                  {currentTask.upstream_request_id ? (
                    <span>{currentTask.upstream_request_id}</span>
                  ) : null}
                  {currentTask.error?.message ? (
                    <span>{currentTask.error.message}</span>
                  ) : null}
                </div>
                <div className="task-status-actions">
                  {currentTask.id ? (
                    <button
                      className="secondary-button"
                      onClick={() => void refreshTaskStatus(currentTask.id ?? "")}
                      type="button"
                    >
                      <RotateCcw size={16} aria-hidden="true" />
                      刷新状态
                    </button>
                  ) : null}
                  {canCancelTask(currentTask) ? (
                    <button
                      className="secondary-button"
                      onClick={() => void cancelCurrentTask()}
                      type="button"
                    >
                      <X size={16} aria-hidden="true" />
                      取消任务
                    </button>
                  ) : null}
                  {canRetryTask(currentTask) ? (
                    <button
                      className="secondary-button"
                      disabled={isGenerating}
                      onClick={submitGeneration}
                      type="button"
                    >
                      <RotateCcw size={16} aria-hidden="true" />
                      重新生成
                    </button>
                  ) : null}
                </div>
              </section>
            ) : null}

            {partialImages.length > 0 ? (
              <section className="partial-preview-strip" aria-label="流式预览结果">
                <div className="field-label">流式预览</div>
                <div className="partial-preview-list">
                  {partialImages.map((image, index) => (
                    <article className="partial-preview-item" key={image.asset_id}>
                      <img alt="流式预览" src={image.url} />
                      <div>
                        <strong>{image.asset_id}</strong>
                        <span>#{index + 1}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="field" data-testid="commercial-template-list">
              <div className="field-label">商业模板</div>
              {selectedTemplate ? (
                <div className="template-field-editor" aria-label="模板字段">
                  <div className="template-editor-header">
                    <strong>{selectedTemplate.name}</strong>
                    <span>{selectedTemplate.description}</span>
                  </div>
                  <div className="template-field-grid">
                    {selectedTemplate.fields.map(renderTemplateField)}
                  </div>
                  <button
                    className="primary-button"
                    onClick={applySelectedTemplate}
                    type="button"
                  >
                    <Sparkles size={16} aria-hidden="true" />
                    应用模板
                  </button>
                </div>
              ) : null}
              <div className="template-list">
                {mvpTemplates.map((template) => (
                  <button
                    className="template-button"
                    key={template.id}
                    onClick={() => selectCommercialTemplate(template.id)}
                    type="button"
                  >
                    <span>
                      <strong>{template.name}</strong>
                      <span>{template.description}</span>
                    </span>
                    <span className="template-pill">
                      {template.requiresImage ? "需参考图" : "文生图"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div
              className="result-stage active-gallery"
              aria-label="结果区"
              data-testid="active-gallery"
            >
              {galleryImages.length > 0 ? (
                <div className="result-grid">
                  {galleryImages.map((image) => (
                    <article className="result-card" key={image.asset_id}>
                      <img alt="生成结果" src={image.url} />
                      <div className="result-card-body">
                        <strong>{image.asset_id}</strong>
                        <p>{galleryRequestId}</p>
                        <p>{galleryTotalTokens} tokens</p>
                        <div className="result-actions">
                          <a
                            className="secondary-button"
                            download
                            href={image.url}
                          >
                            <Download size={16} aria-hidden="true" />
                            下载
                          </a>
                          <button
                            className="secondary-button"
                            onClick={copyPrompt}
                            type="button"
                          >
                            <Copy size={16} aria-hidden="true" />
                            复制 Prompt
                          </button>
                          <button
                            className="secondary-button"
                            onClick={submitGeneration}
                            type="button"
                          >
                            <RotateCcw size={16} aria-hidden="true" />
                            重试
                          </button>
                          <button
                            className="secondary-button"
                            onClick={() => void handleResultAsReference(image)}
                            type="button"
                          >
                            <ImagePlus size={16} aria-hidden="true" />
                            作为参考图
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-result">
                  <h2>选择模板或输入 Prompt 后生成</h2>
                  <p>
                    当前模板：
                    {commercialTemplates.find(
                      (template) => template.id === selectedTemplateId
                    )?.name ?? "未选择"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <aside
          className="workspace-panel right-column"
          data-testid="right-history-panel"
        >
          <div className="panel-header">
            <div className="panel-title">
              <History size={16} aria-hidden="true" />
              历史与素材
            </div>
            <div className="panel-actions">
              <button
                aria-label="同步素材库"
                className="icon-button"
                disabled={libraryStatus === "loading"}
                onClick={() => void loadServerLibrary()}
                title="同步素材库"
                type="button"
              >
                <RefreshCw size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="panel-body history-list">
            <section
              aria-label="版本流"
              className="version-stream"
              data-testid="version-stream"
            >
              <div className="version-stream-header">
                <div>
                  <strong>对话式版本流</strong>
                  <p>回溯参数，或从任意节点分叉生成。</p>
                </div>
                {forkParentId ? <span className="version-context-pill">分叉中</span> : null}
              </div>
              {versionNodes.length === 0 ? (
                <div className="version-empty">
                  <strong>暂无版本节点</strong>
                  <p>首次生成后会自动记录 prompt、参数和结果。</p>
                </div>
              ) : (
                <div className="version-node-list">
                  {versionNodes.map((node, index) => (
                    <article
                      className={`version-node ${
                        node.id === activeNodeId ? "active" : ""
                      }`}
                      key={node.id}
                    >
                      <div className="version-node-meta">
                        <span className="version-branch-badge">
                          {node.branchLabel}
                        </span>
                        <span>#{index + 1}</span>
                        <span>{formatVersionNodeTime(node)}</span>
                      </div>
                      <strong>{node.source === "edit" ? "图生图" : "文生图"}</strong>
                      <p>Prompt: {node.prompt}</p>
                      <p>{summarizeNodeParams(node)}</p>
                      {node.images.length > 0 ? (
                        <div className="version-thumb-strip">
                          {node.images.slice(0, 4).map((image) => (
                            <img
                              alt=""
                              key={image.asset_id}
                              src={image.url}
                            />
                          ))}
                        </div>
                      ) : null}
                      <div className="history-actions">
                        <button
                          className="secondary-button"
                          onClick={() => returnToVersionNode(node)}
                          type="button"
                          aria-label={`回到版本 ${node.prompt}`}
                        >
                          回到版本
                        </button>
                        <button
                          className="secondary-button"
                          onClick={() => restoreVersionNodeParams(node)}
                          type="button"
                          aria-label={`恢复参数 ${node.prompt}`}
                        >
                          恢复参数
                        </button>
                        <button
                          className="secondary-button"
                          onClick={() => startVersionFork(node)}
                          type="button"
                          aria-label={`从此分叉 ${node.prompt}`}
                        >
                          从此分叉
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section
              aria-label="分支图"
              className="branch-map"
              data-testid="branch-map"
            >
              <div className="version-stream-header">
                <strong>分支图</strong>
                <p>Board 模式前置预览。</p>
              </div>
              {versionNodes.length === 0 ? (
                <p className="inline-hint">生成后显示节点关系。</p>
              ) : (
                <div className="branch-node-list">
                  {versionNodes.map((node) => (
                    <div
                      className={`branch-node ${
                        node.id === activeNodeId ? "active" : ""
                      }`}
                      data-depth={node.depth}
                      key={node.id}
                      style={{ "--node-depth": node.depth } as CSSProperties}
                    >
                      <span>{node.parentId ? "↳" : "●"}</span>
                      <strong>路径：{node.branchLabel}</strong>
                      <p>{node.prompt}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section
              aria-label="当前节点参数"
              className="node-inspector"
              data-testid="node-inspector"
            >
              <div className="version-stream-header">
                <strong>Inspector</strong>
                <p>当前节点的参数快照。</p>
              </div>
              {activeVersionNode ? (
                <div className="inspector-stack">
                  <p>{summarizeNodeParams(activeVersionNode)}</p>
                  <p>{activeVersionNode.requestId ?? "暂无 request id"}</p>
                  <p>{activeVersionNode.durationMs ?? 0}ms</p>
                </div>
              ) : (
                <p className="inline-hint">选择或生成一个版本后查看参数。</p>
              )}
            </section>

            <BatchWorkflowPanel defaultSize={size} />

            <div className="library-toolbar">
              <label className="checkbox-row">
                <input
                  aria-label="仅收藏素材"
                  checked={libraryFavoriteOnly}
                  onChange={(event) =>
                    setLibraryFavoriteOnly(event.currentTarget.checked)
                  }
                  type="checkbox"
                />
                仅收藏
              </label>
              <div className="library-tag-filter">
                <Tags size={14} aria-hidden="true" />
                <input
                  aria-label="素材标签过滤"
                  onChange={(event) => setLibraryTagFilter(event.target.value)}
                  placeholder="标签"
                  value={libraryTagFilter}
                />
              </div>
            </div>

            {libraryStatus === "loading" ? (
              <div className="history-item">
                <strong>同步中</strong>
                <p>正在读取服务端素材库。</p>
              </div>
            ) : null}

            {libraryStatus === "unavailable" ? (
              <div className="history-item">
                <strong>素材库暂不可用</strong>
                <p>继续使用本地历史，不影响生成和继续编辑。</p>
              </div>
            ) : null}

            {promptFavorites.length > 0 ? (
              <div className="library-section">
                {promptFavorites.map((item) => (
                  <div className="history-item" key={item.id}>
                    <strong>{item.title}</strong>
                    <p>{item.prompt}</p>
                    <p>{item.mode === "image" ? "图生图" : "文生图"}</p>
                    <div className="history-actions">
                      <button
                        className="secondary-button"
                        onClick={() => applyPromptFavorite(item)}
                        type="button"
                      >
                        <Copy size={16} aria-hidden="true" />
                        套用 Prompt
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {libraryItems.length > 0 ? (
              <div className="library-section">
                {libraryItems.map((item) => (
                  <div className="history-item library-item" key={item.asset_id}>
                    <img
                      alt=""
                      className="library-thumb"
                      src={item.thumbnail_url}
                    />
                    <div className="library-item-body">
                      <strong>{item.asset_id}</strong>
                      <p>{item.prompt}</p>
                      <p>
                        {item.task_id}
                        {item.usage?.total_tokens
                          ? ` · ${item.usage.total_tokens} tokens`
                          : ""}
                        {item.duration_ms ? ` · ${item.duration_ms}ms` : ""}
                      </p>
                      {item.tags.length > 0 ? (
                        <div className="tag-list">
                          {item.tags.map((tag) => (
                            <span key={tag}>{tag}</span>
                          ))}
                        </div>
                      ) : null}
                      <div className="history-actions">
                        <button
                          className="secondary-button"
                          onClick={() => void handleLibraryContinueEdit(item)}
                          type="button"
                        >
                          <ImagePlus size={16} aria-hidden="true" />
                          继续编辑
                        </button>
                        <button
                          className="secondary-button"
                          onClick={() => void toggleLibraryFavorite(item)}
                          type="button"
                        >
                          <Star
                            fill={item.favorite ? "currentColor" : "none"}
                            size={16}
                            aria-hidden="true"
                          />
                          {item.favorite ? "取消收藏" : "收藏素材"}
                        </button>
                        <button
                          className="secondary-button"
                          onClick={() =>
                            setPublishAssetId((current) =>
                              current === item.asset_id ? null : item.asset_id
                            )
                          }
                          type="button"
                        >
                          <UploadCloud size={16} aria-hidden="true" />
                          发布作品
                        </button>
                        <Link
                          className="secondary-button"
                          href={`/library/${item.asset_id}`}
                        >
                          <ExternalLink size={16} aria-hidden="true" />
                          详情
                        </Link>
                      </div>
                      {publishAssetId === item.asset_id ? (
                        <form
                          className="community-publish-panel"
                          onSubmit={(event) => void publishLibraryItem(event, item)}
                        >
                          <div className="field">
                            <label htmlFor={`publish-title-${item.asset_id}`}>
                              作品标题
                            </label>
                            <input
                              className="input"
                              defaultValue={defaultCommunityTitle(item)}
                              id={`publish-title-${item.asset_id}`}
                              name="title"
                              type="text"
                            />
                          </div>
                          <div className="field">
                            <label htmlFor={`publish-visibility-${item.asset_id}`}>
                              可见性
                            </label>
                            <select
                              className="select"
                              defaultValue="private"
                              id={`publish-visibility-${item.asset_id}`}
                              name="visibility"
                            >
                              <option value="private">私有</option>
                              <option value="unlisted">链接可见</option>
                              <option value="public">公开社区</option>
                            </select>
                          </div>
                          <div className="community-publish-options">
                            <label className="checkbox-row">
                              <input name="disclose_prompt" type="checkbox" />
                              公开 Prompt
                            </label>
                            <label className="checkbox-row">
                              <input name="disclose_params" type="checkbox" />
                              公开参数
                            </label>
                            <label className="checkbox-row">
                              <input
                                name="disclose_reference_images"
                                type="checkbox"
                              />
                              公开参考图
                            </label>
                            <label className="checkbox-row">
                              <input
                                defaultChecked
                                name="allow_same_generation"
                                type="checkbox"
                              />
                              允许同款生成
                            </label>
                            <label className="checkbox-row">
                              <input name="allow_reference_reuse" type="checkbox" />
                              允许参考复用
                            </label>
                            <label className="checkbox-row">
                              <input name="public_confirmed" type="checkbox" />
                              确认公开发布
                            </label>
                          </div>
                          <button
                            className="primary-button"
                            disabled={publishingAssetId === item.asset_id}
                            type="submit"
                          >
                            <UploadCloud size={16} aria-hidden="true" />
                            {publishingAssetId === item.asset_id
                              ? "发布中"
                              : "确认发布"}
                          </button>
                        </form>
                      ) : null}
                      {publishMessages[item.asset_id] ? (
                        <p className="inline-hint">
                          {publishMessages[item.asset_id]}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {historyItems.length === 0 &&
            libraryItems.length === 0 &&
            promptFavorites.length === 0 ? (
              <div className="history-item">
                <strong>尚未生成</strong>
                <p>生成后会显示 prompt、参数、request id、耗时和 usage。</p>
              </div>
            ) : (
              historyItems.map((item) => (
                <div className="history-item" key={item.taskId}>
                  <strong>{item.taskId}</strong>
                  <p>{item.prompt}</p>
                  <p>{item.requestId}</p>
                  <p>{item.totalTokens} tokens · {item.durationMs}ms</p>
                  <div className="history-actions">
                    <button
                      className="secondary-button"
                      onClick={() => void handleHistoryContinueEdit(item)}
                      type="button"
                    >
                      <ImagePlus size={16} aria-hidden="true" />
                      继续编辑
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
        </div>

        <div className="mobile-bottom-bar">
          <button className="secondary-button" type="button">
            <PanelBottom size={16} aria-hidden="true" />
            打开参数面板
          </button>
          <button
            className="primary-button"
            disabled={isGenerating}
            onClick={submitGeneration}
            type="button"
          >
            <Play size={16} aria-hidden="true" />
            {isGenerating ? "生成中" : "生成"}
          </button>
        </div>
      </main>
    </AppShell>
  );
}



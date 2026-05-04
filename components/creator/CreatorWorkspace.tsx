"use client";

import { PanelBottom, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ChangeEvent,
  ClipboardEvent,
  DragEvent,
  FormEvent,
  PointerEvent as ReactPointerEvent
} from "react";

import BatchWorkflowPanel from "@/components/creator/BatchWorkflowPanel";
import { BatchProvider } from "@/components/creator/studio/BatchContext";
import BranchMapSection from "@/components/creator/studio/BranchMapSection";
import ChatHeader from "@/components/creator/studio/ChatHeader";
import ChatTranscript from "@/components/creator/studio/ChatTranscript";
import Composer from "@/components/creator/studio/Composer";
import { CreatorStudioProvider, type CreatorStudioContextValue } from "@/components/creator/studio/CreatorStudioContext";
import Inspector from "@/components/creator/studio/inspector/Inspector";
import LibrarySection from "@/components/creator/studio/inspector/LibrarySection";
import ParamsSection from "@/components/creator/studio/inspector/ParamsSection";
import ReferenceSection from "@/components/creator/studio/inspector/ReferenceSection";
import TemplatesSection from "@/components/creator/studio/inspector/TemplatesSection";
import NodeInspectorSection from "@/components/creator/studio/NodeInspectorSection";
import ProjectSidebar from "@/components/creator/studio/ProjectSidebar";
import VersionStreamSection from "@/components/creator/studio/VersionStreamSection";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";

import { formatApiError, formatTaskError } from "@/lib/creator/api-error";
import {
  fetchReferenceImageFile,
  mimeTypeForFormat
} from "@/lib/creator/content-type";
import { buildEditFormData } from "@/lib/creator/edit-form";
import {
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
  isImageTaskSnapshot
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
  type CreatorVersionNode
} from "@/lib/creator/version-graph";
import {
  defaultProjectSeeds,
  type SidebarProjectGroup
} from "@/lib/creator/projects";
import { useProjects } from "@/lib/creator/use-projects";
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
  imageGenerationDefaults,
  type ImageGenerationParams
} from "@/lib/validation/image-params";

const maskCanvasSize = 512;
const defaultTemplateId = "tpl_ecommerce_main";

export default function CreatorWorkspace({
  showAdminLink = false
}: {
  showAdminLink?: boolean;
} = {}) {
  // Plan Task 6 移动端抽屉：左 ProjectSidebar / 底 Inspector 弹 Sheet
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);

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
  const {
    projects: creatorProjects,
    createProject,
    renameProject: renameProjectInStore,
    deleteProject: deleteProjectInStore
  } = useProjects();
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
    [creatorProjects, nodeProjectIds, versionNodes]
  );
  const activeProjectGroup = useMemo<SidebarProjectGroup>(
    () =>
      sidebarProjects.find((item) => item.project.id === activeProjectId) ??
      sidebarProjects[0] ?? {
        // 极端兜底：用户把所有项目（含 default seed）都删了，IndexedDB
        // 又因为某种原因没把 seed 重新写回 —— 拿首个静态 seed 顶上，
        // 避免空指针。
        project: defaultProjectSeeds[0],
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

  /**
   * 删除项目；如果删的是当前 active 项目，重置回 creatorProjects[0] 或
   * 首个 default seed 兜底，并清空当前会话状态，避免空指针。
   */
  async function handleDeleteProject(projectId: CreatorProjectId) {
    await deleteProjectInStore(projectId);
    if (projectId === activeProjectId) {
      const fallback = creatorProjects.find((meta) => meta.id !== projectId);
      const nextId = fallback?.id ?? defaultProjectSeeds[0].id;
      setActiveProjectId(nextId);
      setActiveConversationId("new");
      setActiveNodeId(null);
      setForkParentId(null);
      setErrorMessage("");
    }
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

  const currentConversationTitle =
    activeConversationId === "new"
      ? activeProject.emptyTitle
      : activeConversationId === "all"
      ? activeProject.emptyTitle
      : activeBranchSummary?.latestNode?.prompt.slice(0, 30) ||
        activeBranchSummary?.label ||
        activeProject.emptyTitle;

  const studioContextValue: CreatorStudioContextValue = {
    activeNodeId,
    returnToVersionNode,
    restoreVersionNodeParams,
    startVersionFork,
    submitGeneration,
    copyPrompt,
    handleResultAsReference,
    prompt,
    setPrompt,
    mode,
    size,
    quality,
    outputFormat,
    n,
    streamEnabled,
    forkParentId,
    errorMessage,
    isAssistingPrompt,
    isGenerating,
    optimizePrompt,
    saveCurrentPromptFavorite,
    setMode,
    setSize,
    setQuality,
    setOutputFormat,
    setN,
    setStreamEnabled,
    partialImageCount,
    setPartialImageCount,
    advancedOpen,
    setAdvancedOpen,
    outputCompression,
    setOutputCompression,
    moderation,
    setModeration,
    selectedCommercialSizeId,
    selectCommercialSize,
    referenceImages,
    referencePreviews,
    referenceImage,
    handleReferenceInput,
    handleReferenceDrop,
    handleReferencePaste,
    removeReferenceImage,
    maskEnabled,
    setMaskEnabled,
    maskMode,
    setMaskMode,
    maskBrushSize,
    setMaskBrushSize,
    maskCanvasRef,
    resetMaskCanvas,
    invertMaskCanvas,
    startMaskStroke,
    continueMaskStroke,
    stopMaskStroke,
    mvpTemplates,
    selectedTemplate,
    templateFieldValues,
    updateTemplateFieldValue,
    selectCommercialTemplate,
    applySelectedTemplate,
    libraryItems,
    libraryStatus,
    libraryFavoriteOnly,
    setLibraryFavoriteOnly,
    libraryTagFilter,
    setLibraryTagFilter,
    promptFavorites,
    historyItems,
    publishAssetId,
    setPublishAssetId,
    publishingAssetId,
    publishMessages,
    loadServerLibrary,
    applyPromptFavorite,
    handleLibraryContinueEdit,
    toggleLibraryFavorite,
    publishLibraryItem,
    handleHistoryContinueEdit,
    defaultCommunityTitle
  };

  return (
    <AppShell
      bodyClassName="product-workbench-body"
      currentPath="/"
      showAdminLink={showAdminLink}
    >
      <CreatorStudioProvider value={studioContextValue}>
      <BatchProvider defaultSize={size}>
      <main className="chat-studio-shell" data-testid="chat-studio-shell">
      <ProjectSidebar
        activeConversationId={activeConversationId}
        activeProjectId={activeProjectId}
        activeProjectTitle={activeProject.title}
        onCreateProject={createProject}
        onDeleteProject={handleDeleteProject}
        onRenameProject={renameProjectInStore}
        onSelectConversation={selectConversation}
        onSelectProject={selectProject}
        sidebarProjects={sidebarProjects}
      />

      <section className="chat-workspace" data-testid="center-workspace">
        <ChatHeader
          conversationTitle={currentConversationTitle}
          forkParentId={forkParentId}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
        />

        <ChatTranscript
          currentTask={currentTask}
          displayedVersionNodes={displayedVersionNodes}
          emptyDescription={activeProject.emptyDescription}
          emptyTitle={activeProject.emptyTitle}
          isGenerating={isGenerating}
          onCancelTask={() => void cancelCurrentTask()}
          onRefreshTask={(taskId) => void refreshTaskStatus(taskId)}
          onRetryGeneration={submitGeneration}
          partialImages={partialImages}
        />

        <Composer />
      </section>

      <Inspector>
          <ParamsSection />

          <ReferenceSection />

          <TemplatesSection />

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

          <BatchWorkflowPanel />

          <LibrarySection />
      </Inspector>

      <div className="mobile-bottom-bar">
        <Button
          onClick={() => setMobileInspectorOpen(true)}
          type="button"
          variant="secondary"
        >
          <PanelBottom size={16} aria-hidden="true" />
          打开参数面板
        </Button>
        <Button
          disabled={isGenerating}
          onClick={submitGeneration}
          type="button"
        >
          <Play size={16} aria-hidden="true" />
          {isGenerating ? "生成中" : "生成"}
        </Button>
      </div>

      {/* Plan Task 6 移动端：左侧项目/对话抽屉，由 ChatHeader 汉堡按钮触发 */}
      <Sheet onOpenChange={setMobileSidebarOpen} open={mobileSidebarOpen}>
        <SheetContent
          className="w-[300px] overflow-y-auto p-0 sm:max-w-[320px]"
          side="left"
        >
          <SheetHeader className="border-b border-border pb-3">
            <SheetTitle>项目 / 对话</SheetTitle>
            <SheetDescription className="sr-only">
              选择项目或对话切换工作台上下文
            </SheetDescription>
          </SheetHeader>
          <div data-mobile-drawer="sidebar">
            <ProjectSidebar
              activeConversationId={activeConversationId}
              activeProjectId={activeProjectId}
              activeProjectTitle={activeProject.title}
              onCreateProject={createProject}
              onDeleteProject={handleDeleteProject}
              onRenameProject={renameProjectInStore}
              onSelectConversation={(conversationId) => {
                selectConversation(conversationId);
                setMobileSidebarOpen(false);
              }}
              onSelectProject={(projectId) => {
                selectProject(projectId);
                setMobileSidebarOpen(false);
              }}
              sidebarProjects={sidebarProjects}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Plan Task 6 移动端：底部 Inspector 抽屉，由 mobile-bottom-bar 触发 */}
      <Sheet onOpenChange={setMobileInspectorOpen} open={mobileInspectorOpen}>
        <SheetContent
          className="max-h-[85vh] overflow-y-auto p-0"
          side="bottom"
        >
          <SheetHeader className="border-b border-border pb-3">
            <SheetTitle>参数与素材</SheetTitle>
            <SheetDescription className="sr-only">
              查看与编辑当前对话的生成参数、参考图、模板与素材
            </SheetDescription>
          </SheetHeader>
          <div data-mobile-drawer="inspector">
            <Inspector>
              <ParamsSection />

              <ReferenceSection />

              <TemplatesSection />

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

              <BatchWorkflowPanel />

              <LibrarySection />
            </Inspector>
          </div>
        </SheetContent>
      </Sheet>
      </main>
      </BatchProvider>
      </CreatorStudioProvider>
    </AppShell>
  );
}



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
  Settings,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tags,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ChangeEvent,
  ClipboardEvent,
  DragEvent,
  PointerEvent as ReactPointerEvent
} from "react";
import {
  listLocalHistoryItems,
  saveLocalHistoryItem,
  type LocalHistoryItem
} from "@/lib/history/local-history";
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

type GenerationImage = {
  asset_id: string;
  url: string;
  format: string;
};

type GenerationResult = {
  task_id: string;
  images: GenerationImage[];
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    estimated_cost: string;
  };
  duration_ms: number;
  request_id: string;
  upstream_request_id?: string;
};

type ApiGenerationResponse = {
  data?: Omit<GenerationResult, "request_id" | "upstream_request_id">;
  request_id?: string;
  upstream_request_id?: string;
  error?: {
    code: string;
    message: string;
    details?: { field?: string };
  };
};

type CreatorMode = "text" | "image";
type MaskMode = "paint" | "restore";
type ImageTaskStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "canceled";
type CreatorTaskStatus = ImageTaskStatus | "submitting";

type ImageTaskSnapshot = {
  id: string;
  type: "generation" | "edit";
  status: ImageTaskStatus;
  prompt: string;
  images: GenerationImage[];
  usage?: GenerationResult["usage"];
  upstream_request_id?: string;
  error?: {
    code: string;
    message?: string;
  };
  duration_ms?: number;
  updated_at?: string;
};

type CurrentTask = Omit<Partial<ImageTaskSnapshot>, "status"> & {
  status: CreatorTaskStatus;
  type?: "generation" | "edit";
  prompt?: string;
};

type ApiTaskResponse = {
  data?: ImageTaskSnapshot;
  request_id?: string;
  upstream_request_id?: string;
  error?: {
    code: string;
    message: string;
    details?: { field?: string };
  };
};

type LibraryAssetItem = {
  asset_id: string;
  task_id: string;
  type: "generation" | "edit";
  prompt: string;
  params: ImageGenerationParams;
  url: string;
  thumbnail_url: string;
  format: string;
  usage?: GenerationResult["usage"];
  duration_ms?: number;
  created_at: string;
  favorite: boolean;
  tags: string[];
};

type ApiLibraryResponse = {
  data?: {
    items: LibraryAssetItem[];
    next_cursor: string | null;
  };
  request_id?: string;
  error?: {
    code: string;
    message: string;
  };
};

type ApiLibraryPatchResponse = {
  data?: LibraryAssetItem;
  request_id?: string;
  error?: {
    code: string;
    message: string;
  };
};

type TemplateFieldValue = string | boolean;
type TemplateFieldValues = Record<string, TemplateFieldValue>;

const taskStatusLabels: Record<CreatorTaskStatus, string> = {
  submitting: "提交中",
  queued: "排队中",
  running: "运行中",
  succeeded: "已完成",
  failed: "失败",
  canceled: "已取消"
};

const taskTypeLabels: Record<NonNullable<CurrentTask["type"]>, string> = {
  generation: "文生图",
  edit: "图生图"
};
const maskCanvasSize = 512;
const defaultTemplateId = "tpl_ecommerce_main";

export default function CreatorWorkspace() {
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
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [partialImages, setPartialImages] = useState<GenerationImage[]>([]);
  const [historyItems, setHistoryItems] = useState<LocalHistoryItem[]>([]);
  const [libraryItems, setLibraryItems] = useState<LibraryAssetItem[]>([]);
  const [libraryStatus, setLibraryStatus] = useState<
    "idle" | "loading" | "loaded" | "unavailable"
  >("idle");
  const [libraryFavoriteOnly, setLibraryFavoriteOnly] = useState(false);
  const [libraryTagFilter, setLibraryTagFilter] = useState("");
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [maskEnabled, setMaskEnabled] = useState(false);
  const [maskMode, setMaskMode] = useState<MaskMode>("paint");
  const [maskBrushSize, setMaskBrushSize] = useState(48);
  const [currentTask, setCurrentTask] = useState<CurrentTask | null>(null);
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

  useEffect(() => {
    void listLocalHistoryItems()
      .then(setHistoryItems)
      .catch(() => setHistoryItems([]));
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
        const imageResponse = await fetch(asset.thumbnail_url);
        const blob = await imageResponse.blob();
        const extension = asset.format === "jpeg" ? "jpg" : asset.format;
        const reference = new File([blob], `${asset.asset_id}.${extension}`, {
          type:
            blob.type ||
            (asset.format === "jpeg" || asset.format === "jpg"
              ? "image/jpeg"
              : `image/${asset.format}`)
        });

        if (!active) {
          return;
        }

        setReferenceImage(reference);
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
        mode === "image" && referenceImage
          ? {
              method: "POST",
              body: buildEditFormData(requestParams, referenceImage, maskFile)
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
    setResult(nextResult);

    const firstImage = nextResult.images[0];
    if (!firstImage) {
      return;
    }

    const createdAt = new Date().toISOString();
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
      requestId: nextResult.request_id,
      durationMs: nextResult.duration_ms,
      totalTokens: nextResult.usage.total_tokens,
      createdAt
    };

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

  function formatApiError(body: ApiGenerationResponse) {
    const message = body.error?.message ?? "生成失败，请稍后重试。";
    const requestIds = [
      body.request_id ? `request_id: ${body.request_id}` : "",
      body.upstream_request_id
        ? `upstream_request_id: ${body.upstream_request_id}`
        : ""
    ].filter(Boolean);

    if (requestIds.length === 0) {
      return message;
    }

    return `${message}（${requestIds.join(" · ")}）`;
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

  function formatTaskError(body: ApiTaskResponse) {
    const message = body.error?.message ?? "任务操作失败，请稍后重试。";
    const requestIds = [
      body.request_id ? `request_id: ${body.request_id}` : "",
      body.upstream_request_id
        ? `upstream_request_id: ${body.upstream_request_id}`
        : ""
    ].filter(Boolean);

    return requestIds.length > 0
      ? `${message}（${requestIds.join(" · ")}）`
      : message;
  }

  function isImageTaskSnapshot(value: ImageTaskSnapshot) {
    return Boolean(value.id && value.status && taskStatusLabels[value.status]);
  }

  function canCancelTask(task: CurrentTask) {
    return Boolean(
      task.id && (task.status === "queued" || task.status === "running")
    );
  }

  function canRetryTask(task: CurrentTask) {
    return task.status === "failed" || task.status === "canceled";
  }

  function parseSseBlock(block: string) {
    const lines = block.split(/\r?\n/);
    const data: string[] = [];
    let event = "";

    for (const line of lines) {
      if (line.startsWith("event:")) {
        event = line.slice("event:".length).trim();
      }

      if (line.startsWith("data:")) {
        data.push(line.slice("data:".length).trim());
      }
    }

    return {
      event,
      data: data.join("\n")
    };
  }

  function parseJsonRecord(input: string) {
    try {
      const parsed = JSON.parse(input);

      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  function parseGenerationImage(input: Record<string, unknown> | null) {
    const assetId = readString(input, "asset_id");
    const url = readString(input, "url");
    const format = readString(input, "format");

    if (!assetId || !url || !format) {
      return null;
    }

    return {
      asset_id: assetId,
      url,
      format
    };
  }

  function parseGenerationImages(input: Record<string, unknown> | null) {
    const images = input?.images;

    if (!Array.isArray(images)) {
      return [];
    }

    return images
      .map((image) => (isRecord(image) ? parseGenerationImage(image) : null))
      .filter((image): image is GenerationImage => image !== null);
  }

  function parseUsage(input: Record<string, unknown> | null) {
    const usage = isRecord(input?.usage) ? input.usage : {};

    return {
      input_tokens: readNumber(usage, "input_tokens") ?? 0,
      output_tokens: readNumber(usage, "output_tokens") ?? 0,
      total_tokens: readNumber(usage, "total_tokens") ?? 0,
      estimated_cost: readString(usage, "estimated_cost") ?? "0.0000"
    };
  }

  function readString(input: Record<string, unknown> | null, key: string) {
    const value = input?.[key];

    return typeof value === "string" ? value : undefined;
  }

  function readNumber(input: Record<string, unknown> | null, key: string) {
    const value = input?.[key];

    return typeof value === "number" ? value : undefined;
  }

  function isRecord(input: unknown): input is Record<string, unknown> {
    return typeof input === "object" && input !== null && !Array.isArray(input);
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

  function buildEditFormData(
    params: ImageGenerationParams,
    image: File,
    mask?: File
  ) {
    const formData = new FormData();
    formData.set("image", image);

    if (mask) {
      formData.set("mask", mask);
    }

    Object.entries(params).forEach(([key, value]) => {
      if (key === "output_compression" && value === null) {
        return;
      }

      if (value !== undefined && value !== null) {
        formData.set(key, String(value));
      }
    });

    return formData;
  }

  function handleReferenceInput(event: ChangeEvent<HTMLInputElement>) {
    selectReferenceImage(event.target.files?.[0]);
  }

  function handleReferenceDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    selectReferenceImage(event.dataTransfer.files[0]);
  }

  function handleReferencePaste(event: ClipboardEvent<HTMLDivElement>) {
    const image = Array.from(event.clipboardData.files).find((file) =>
      file.type.startsWith("image/")
    );

    selectReferenceImage(image);
  }

  function selectReferenceImage(file: File | undefined) {
    if (!file) {
      return;
    }

    setReferenceImage(file);
    setMaskEnabled(
      Boolean(
        commercialTemplates.find((template) => template.id === selectedTemplateId)
          ?.requiresMask
      )
    );
    setErrorMessage("");
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
      const response = await fetch(image.url);
      const blob = await response.blob();
      const reference = new File([blob], `${image.asset_id}.${image.format}`, {
        type: blob.type || mimeTypeForFormat(image.format)
      });

      setReferenceImage(reference);
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

  async function handleLibraryContinueEdit(item: LibraryAssetItem) {
    try {
      const response = await fetch(item.thumbnail_url);
      const blob = await response.blob();
      const reference = new File([blob], libraryReferenceName(item), {
        type: blob.type || mimeTypeForFormat(item.format)
      });

      setReferenceImage(reference);
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
      const response = await fetch(item.thumbnailUrl);
      const blob = await response.blob();
      const format = item.params.output_format;
      const reference = new File([blob], historyReferenceName(item), {
        type: blob.type || mimeTypeForFormat(format)
      });

      setReferenceImage(reference);
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

  function mimeTypeForFormat(format: string) {
    if (format === "jpeg" || format === "jpg") {
      return "image/jpeg";
    }

    return `image/${format}`;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand" aria-label="PsyPic">
          <div className="brand-mark">P</div>
          <div>
            <div className="brand-title">PsyPic</div>
            <div className="brand-subtitle">商业创作台</div>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="icon-button" type="button" title="历史">
            <History size={17} aria-hidden="true" />
          </button>
          <Link className="icon-button" href="/settings" title="设置">
            <Settings size={17} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <div className="creator-grid">
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
                    onChange={handleReferenceInput}
                    type="file"
                  />
                  <ImagePlus size={18} aria-hidden="true" />
                  <span>
                    <strong>参考图</strong>
                    <span>{referenceImage ? referenceImage.name : "点击、拖拽或粘贴一张图片"}</span>
                  </span>
                </label>
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

            <div className="field">
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

            <div className="result-stage" aria-label="结果区">
              {result ? (
                <div className="result-grid">
                  {result.images.map((image) => (
                    <article className="result-card" key={image.asset_id}>
                      <img alt="生成结果" src={image.url} />
                      <div className="result-card-body">
                        <strong>{image.asset_id}</strong>
                        <p>{result.request_id}</p>
                        <p>{result.usage.total_tokens} tokens</p>
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
                        <Link
                          className="secondary-button"
                          href={`/library/${item.asset_id}`}
                        >
                          <ExternalLink size={16} aria-hidden="true" />
                          详情
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {historyItems.length === 0 && libraryItems.length === 0 ? (
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
  );
}

function createTemplateFieldValues(
  template: CommercialTemplate | undefined,
  seedText: string
): TemplateFieldValues {
  if (!template) {
    return {};
  }

  return Object.fromEntries(
    template.fields.map((field) => [
      field.key,
      field.defaultValue ?? (field.required ? seedText : "")
    ])
  ) as TemplateFieldValues;
}

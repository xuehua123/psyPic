"use client";

/**
 * LegacyCreatorWorkspace —— Phase 4 之前的旧版三栏 fallback。
 *
 * 当 process.env.NEXT_PUBLIC_PSYPIC_LEGACY_CREATOR === "1" 时启用，
 * 否则走 chat-studio 新版（CreatorWorkspace 主壳的 useCodexChatStudio
 * 控制流）。
 *
 * 抽取自 components/creator/CreatorWorkspace.tsx 原 L1683-2691 的
 * legacy main JSX 整段（UI 重构 Phase 4 第 19 刀，Phase 4 收尾）。
 *
 * 数据来源: 全部走 useCreatorStudio() —— Phase 4 第 10-18 刀建立
 * 的 91 字段 Context（含第 19 刀新加 10 字段：currentTask/
 * cancelCurrentTask/refreshTaskStatus/partialImages/versionNodes/
 * activeVersionNode/selectedTemplateId/galleryImages/galleryRequestId/
 * galleryTotalTokens）。
 *
 * 内部 inline:
 * - qualityOptions / maskCanvasSize 两个 const（也在主壳保留 module
 *   级 const 给 useEffect 用）
 * - renderTemplateField 函数（与 TemplatesSection 内部那份独立，
 *   两边都是只复制不共享，等下次大重构合并）
 *
 * 直接 import: 18 个 lucide icon + Link + react CSSProperties + 7 个
 * lib helper + BatchWorkflowPanel（已抽组件）。
 */

import Link from "next/link";
import { type CSSProperties } from "react";
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

import BatchWorkflowPanel from "@/components/creator/BatchWorkflowPanel";
import { useCreatorStudio } from "@/components/creator/studio/CreatorStudioContext";
import {
  canCancelTask,
  canRetryTask,
  taskStatusLabels,
  taskTypeLabels
} from "@/lib/creator/task-status";
import {
  formatVersionNodeTime,
  summarizeNodeParams
} from "@/lib/creator/version-graph";
import { commercialSizePresets } from "@/lib/templates/commercial-size-presets";
import {
  commercialTemplates,
  type CommercialTemplate
} from "@/lib/templates/commercial-templates";
import {
  GENERATION_SIZE_OPTIONS,
  type ImageGenerationParams
} from "@/lib/validation/image-params";

const qualityOptions = [
  { label: "自动", value: "auto" },
  { label: "标准", value: "medium" },
  { label: "高质", value: "high" }
] as const;

const maskCanvasSize = 512;

export default function LegacyCreatorWorkspace() {
  const {
    mode,
    setMode,
    selectedCommercialSizeId,
    selectCommercialSize,
    size,
    setSize,
    quality,
    setQuality,
    outputFormat,
    setOutputFormat,
    n,
    setN,
    streamEnabled,
    setStreamEnabled,
    partialImageCount,
    setPartialImageCount,
    advancedOpen,
    setAdvancedOpen,
    outputCompression,
    setOutputCompression,
    moderation,
    setModeration,
    handleReferenceInput,
    handleReferenceDrop,
    handleReferencePaste,
    removeReferenceImage,
    referenceImages,
    referencePreviews,
    referenceImage,
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
    prompt,
    setPrompt,
    isAssistingPrompt,
    isGenerating,
    errorMessage,
    optimizePrompt,
    saveCurrentPromptFavorite,
    submitGeneration,
    copyPrompt,
    currentTask,
    cancelCurrentTask,
    refreshTaskStatus,
    partialImages,
    mvpTemplates,
    selectedTemplate,
    selectCommercialTemplate,
    applySelectedTemplate,
    templateFieldValues,
    updateTemplateFieldValue,
    selectedTemplateId,
    galleryImages,
    galleryRequestId,
    galleryTotalTokens,
    handleResultAsReference,
    versionNodes,
    activeNodeId,
    activeVersionNode,
    forkParentId,
    returnToVersionNode,
    restoreVersionNodeParams,
    startVersionFork,
    libraryStatus,
    loadServerLibrary,
    libraryFavoriteOnly,
    setLibraryFavoriteOnly,
    libraryTagFilter,
    setLibraryTagFilter,
    promptFavorites,
    applyPromptFavorite,
    libraryItems,
    handleLibraryContinueEdit,
    toggleLibraryFavorite,
    publishAssetId,
    setPublishAssetId,
    publishingAssetId,
    publishMessages,
    defaultCommunityTitle,
    publishLibraryItem,
    historyItems,
    handleHistoryContinueEdit
  } = useCreatorStudio();

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

  return (
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
                {GENERATION_SIZE_OPTIONS.map((sizeOption) => (
                  <option key={sizeOption} value={sizeOption}>
                    {sizeOption === "auto" ? "自动" : sizeOption}
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
  );
}

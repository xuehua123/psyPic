"use client";

/**
 * ReferenceSection —— Inspector 第二个 section "参考图与遮罩"，仅在
 * mode === "image" 时渲染。包含两层结构：
 * - reference-dropzone：input/drag/drop/paste 上传 + reference list
 *   + 移除单项
 * - mask-editor：可选嵌套 section，仅在 referenceImage 存在时渲染。
 *   包含 toggle、画笔模式（涂抹/还原）segmented、画笔大小 range、
 *   清空 / 反选按钮 + 实际 canvas
 *
 * 抽取自 components/creator/CreatorWorkspace.tsx 原 L1590-1728 的
 * `{mode === "image" ? <section>...</section> : null}` 整段（UI
 * 重构 Phase 4 第 16 刀）。
 *
 * 数据来源: 全部走 useCreatorStudio() —— 第 16 刀扩 19 字段，本组件
 * 一并消费（4 个 reference input handler + 6 个 mask stroke/操作
 * handler + 4 个 mask state setter + ref）。
 *
 * 设计：mask-editor 暂时 inline 在本组件（不再走原计划第 17 刀
 * 进一步分离）—— 因为 mask-editor 强依赖 referenceImage 条件，独立
 * 组件后又要 prop drilling 或重复 Context 消费，价值不大。
 */

import { Brush, Eraser, FlipHorizontal, ImagePlus, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useCreatorStudio } from "@/components/creator/studio/CreatorStudioContext";

const maskCanvasSize = 512;

export default function ReferenceSection() {
  const {
    mode,
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
    stopMaskStroke
  } = useCreatorStudio();

  if (mode !== "image") {
    return null;
  }

  return (
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
          <Input
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
            <Checkbox
              aria-label="遮罩编辑"
              checked={maskEnabled}
              onCheckedChange={(checked) => setMaskEnabled(checked === true)}
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
                  <Slider
                    aria-label="画笔大小"
                    max={120}
                    min={8}
                    onValueChange={(values) =>
                      setMaskBrushSize(values[0] ?? 0)
                    }
                    value={[maskBrushSize]}
                  />
                </label>
                <Button
                  variant="secondary"
                  onClick={resetMaskCanvas}
                  type="button"
                >
                  <RotateCcw size={16} aria-hidden="true" />
                  清空遮罩
                </Button>
                <Button
                  variant="secondary"
                  onClick={invertMaskCanvas}
                  type="button"
                >
                  <FlipHorizontal size={16} aria-hidden="true" />
                  反选遮罩
                </Button>
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
  );
}

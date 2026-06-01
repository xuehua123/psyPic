"use client";

import type { GenerationImage } from "@/lib/creator/types";

/**
 * 流式生成的中间预览条。
 *
 * 当后端通过 SSE 推送 partial_image_b64 增量时，CreatorWorkspace
 * 把它们累积到 partialImages，再交给本条带渲染。来自原 CreatorWorkspace.tsx
 * L1880-1895（4116 行单文件巨兽拆分计划的第二刀）。
 *
 * 当前实现保留原视觉，后续 commit 会按 plan linear-stirring-acorn 视觉
 * 系统统一时再调 token / className。
 */
type PartialPreviewStripProps = {
  partialImages: GenerationImage[];
};

export default function PartialPreviewStrip({
  partialImages
}: PartialPreviewStripProps) {
  if (partialImages.length === 0) {
    return null;
  }

  return (
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
  );
}

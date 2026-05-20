/**
 * Board Mode · Cut 4.1 (plan slug 2026-05-20-board-mode-cut4-plan).
 *
 * 把 Konva Stage 扁平化导出成 PNG。这是 Board → /api/images/edits 链路的
 * 第一刀：仅做"取出 dataURL 和 Blob"的纯函数 helper。
 *
 * 约束（来自 plan §3 Cut 4.1）：
 * - 不引入新依赖（用 Konva 自带的 Stage.toDataURL）。
 * - 不持久化产物（持久化是 Cut 5）。
 * - 不接 Composer / 不调 /api/images/edits（投递路径在 4.3 / 4.4）。
 * - excludeKinds（mask 等）不在本刀 API 里 —— mask layer 还没渲染，
 *   想按 BoardLayer.kind 过滤需要 BoardDocument，超出 helper 边界。
 *   Cut 5 接 mask 时再扩展。
 *
 * 默认会临时隐藏画布上的 helper layer（背景纯色、网格），让导出图只含
 * 用户内容。导出完成（含 toDataURL 抛错的情况）后立刻还原 visible 状态，
 * 不破坏当前 UI。
 */

import type Konva from "konva";

export type BoardExportResult = {
  /** 完整的 data URL，形如 `data:image/png;base64,...`，可直接放进 <img>。 */
  dataUrl: string;
  /** 与 dataUrl 等价的 Blob，方便塞进 FormData / `URL.createObjectURL`。 */
  blob: Blob;
  /** 导出像素宽度（已乘 pixelRatio）。 */
  width: number;
  /** 导出像素高度（已乘 pixelRatio）。 */
  height: number;
};

export type BoardExportOptions = {
  /** Konva pixelRatio。默认 1；2 适合给 AI 编辑做高分参考。 */
  pixelRatio?: 1 | 2;
  /** 输出 mime；目前只支持 "image/png"，保留参数为 Cut 5 留扩展余地。 */
  mimeType?: "image/png";
  /**
   * 导出前临时隐藏的 Konva Layer 名字。默认 helper layer
   * （`board-background`、`board-grid`）。传空数组即"什么都不隐藏"。
   */
  excludeLayerNames?: string[];
};

const DEFAULT_EXCLUDE_LAYER_NAMES = ["board-background", "board-grid"];
const DEFAULT_PIXEL_RATIO = 1;
const DEFAULT_MIME_TYPE = "image/png";

export function exportBoardToPng(
  stage: Konva.Stage,
  opts: BoardExportOptions = {}
): BoardExportResult {
  const pixelRatio = opts.pixelRatio ?? DEFAULT_PIXEL_RATIO;
  const mimeType = opts.mimeType ?? DEFAULT_MIME_TYPE;
  const excludeNames = opts.excludeLayerNames ?? DEFAULT_EXCLUDE_LAYER_NAMES;

  // 隐藏 helper layer，记录原 visible 以便事后还原。Konva.Layer.visible()
  // 是 getter/setter 同名函数，传参为 set，无参为 get。
  const layers = stage.getLayers();
  const restoreFns: Array<() => void> = [];
  for (const layer of layers) {
    if (!excludeNames.includes(layer.name())) continue;
    const previous = layer.visible();
    if (previous === false) continue; // 已经隐藏，无需还原
    layer.visible(false);
    restoreFns.push(() => {
      layer.visible(previous);
    });
  }

  let dataUrl: string;
  try {
    dataUrl = stage.toDataURL({ mimeType, pixelRatio });
  } finally {
    // 即使 toDataURL 抛错（典型：cross-origin canvas tainted）也必须还原，
    // 否则用户画布会留下隐藏的背景层。
    for (const fn of restoreFns) {
      fn();
    }
  }

  const blob = dataUrlToBlob(dataUrl);
  const width = Math.round(stage.width() * pixelRatio);
  const height = Math.round(stage.height() * pixelRatio);

  return { dataUrl, blob, width, height };
}

/**
 * 把 `data:<mime>;base64,<...>` / `data:<mime>,<urlencoded>` 转成 Blob。
 * 不依赖 fetch —— Konva 输出的 data URL 在 Node / jsdom / 浏览器里都能
 * 同步解析，避免给 Cut 4.1 引入异步签名。
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const commaIndex = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || commaIndex < 0) {
    throw new Error("exportBoardToPng: invalid data URL from Konva.Stage");
  }
  const header = dataUrl.slice(5, commaIndex); // 跳过 `data:`
  const payload = dataUrl.slice(commaIndex + 1);
  const isBase64 = header.endsWith(";base64");
  const mime = isBase64
    ? header.slice(0, header.length - ";base64".length) || "application/octet-stream"
    : header || "application/octet-stream";

  if (isBase64) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  }
  return new Blob([decodeURIComponent(payload)], { type: mime });
}

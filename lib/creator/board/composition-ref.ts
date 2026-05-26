import type { BoardDocument } from "./types";

/**
 * Board Mode · Cut 4.3 (plan slug 2026-05-20-board-mode-cut4-plan).
 *
 * 用户在 Board Mode 点「作为参考图编辑」后，前端把这次导出的全部上下文
 * 收进一个 BoardCompositionRef，放在 CreatorWorkspace 的本地 state 里：
 *
 *   - 4.3 (本刀)：仅注入 Composer reference 槽 + 切回 transcript tab，
 *     存 BoardCompositionRef。
 *   - 4.4：Composer 提交时若检测到 BoardCompositionRef 存在，
 *     才把 board_document_id / board_export_asset_id / board_snapshot
 *     注入 generation context（plan 2026-05-20 §2 非破坏铁律）。
 *
 * 普通 transcript reference 路径没有 BoardCompositionRef，因此不发这些字段。
 */

export type BoardCompositionRef = {
  /** 当前 BoardDocument 的稳定标识；reducer document.id 为空时上层补稳定 client id。 */
  boardDocumentId: string;
  /** Cut 4.2 的 client temp id，格式 `board-export-${ts}-${rand4}`。Cut 5 升级为持久化 asset id。 */
  boardExportAssetId: string;
  /** 导出当时的 BoardDocument 快照（深拷贝，避免后续编辑画布时改写历史记录）。 */
  boardSnapshot: BoardDocument;
  /** 扁平化导出图本身。 */
  export: {
    blob: Blob;
    dataUrl: string;
    width: number;
    height: number;
    pixelRatio: 1 | 2;
  };
};

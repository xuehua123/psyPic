/**
 * Board Mode · Cut 3 commit 3 (plan slug board-mode-final).
 *
 * 共享 Library → Board 的 HTML5 DataTransfer 协议，让 BoardStage 和
 * LibrarySection 不需要互相 import：BoardStage 不该在生产 bundle 里被
 * LibrarySection 拉进来（react-konva 是 client-only / dynamic），所以
 * 这层协议放在零依赖的 lib 文件里。
 */

export const LIBRARY_ASSET_DRAG_MIME = "application/x-psypic-asset";

export type LibraryAssetDragPayload = {
  assetId: string;
  url: string;
  name?: string;
};

export function libraryAssetDragPayload(
  asset: { asset_id: string; url: string; prompt?: string }
): LibraryAssetDragPayload {
  return {
    assetId: asset.asset_id,
    url: asset.url,
    name:
      asset.prompt && asset.prompt.length > 0 ? asset.prompt : asset.asset_id
  };
}

export function setLibraryAssetDragData(
  dataTransfer: DataTransfer,
  payload: LibraryAssetDragPayload
) {
  dataTransfer.effectAllowed = "copy";
  dataTransfer.setData(LIBRARY_ASSET_DRAG_MIME, JSON.stringify(payload));
}

export function readLibraryAssetDragData(
  dataTransfer: DataTransfer
): LibraryAssetDragPayload | null {
  const raw = dataTransfer.getData(LIBRARY_ASSET_DRAG_MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LibraryAssetDragPayload>;
    if (!parsed.assetId || !parsed.url) return null;
    return {
      assetId: parsed.assetId,
      url: parsed.url,
      name: parsed.name
    };
  } catch {
    return null;
  }
}

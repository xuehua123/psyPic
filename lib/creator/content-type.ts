/**
 * 图片格式 / MIME / 跨域抓取参考图。
 */

export function mimeTypeForFormat(format: string): string {
  if (format === "jpeg" || format === "jpg") {
    return "image/jpeg";
  }

  return `image/${format}`;
}

export function normalizeContentType(
  contentType: string | null | undefined
): string {
  return (contentType ?? "").split(";")[0].trim().toLowerCase();
}

export async function fetchReferenceImageFile(input: {
  url: string;
  fileName: string;
  fallbackType: string;
}): Promise<File> {
  const response = await fetch(input.url);
  const responseType = normalizeContentType(response.headers.get("content-type"));

  if (!response.ok || (responseType && !responseType.startsWith("image/"))) {
    throw new Error("reference_image_fetch_failed");
  }

  const blob = await response.blob();
  const blobType = normalizeContentType(blob.type);
  const imageType = blobType || responseType;

  if (!imageType.startsWith("image/")) {
    throw new Error("reference_image_fetch_failed");
  }

  return new File([blob], input.fileName, {
    type: imageType || input.fallbackType
  });
}

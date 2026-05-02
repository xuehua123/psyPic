/**
 * 图生图 API 的 multipart/form-data 构造。纯函数。
 */

import type { ImageGenerationParams } from "@/lib/validation/image-params";

export function buildEditFormData(
  params: ImageGenerationParams,
  images: File[],
  mask?: File
): FormData {
  const formData = new FormData();
  images.forEach((image) => formData.append("image", image));

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

const allowedMimeTypes = ["image/png", "image/jpeg", "image/webp"] as const;
const allowedExtensions = ["png", "jpg", "jpeg", "webp"] as const;
const defaultMaxImageUploadMb = 10;

type ReferenceImageFormat = "png" | "jpeg" | "webp";
type ImageUploadField = "image" | "mask";

type UploadErrorCode = "unsupported_media_type" | "payload_too_large";

type UploadError = {
  code: UploadErrorCode;
  message: string;
  field: ImageUploadField;
};

export type ReferenceImageUploadResult =
  | {
      success: true;
      data: {
        file: File;
        format: ReferenceImageFormat;
      };
    }
  | {
      success: false;
      error: UploadError;
    };

export async function validateReferenceImageUpload(
  file: File
): Promise<ReferenceImageUploadResult> {
  return validateImageUpload(file, {
    field: "image",
    formats: ["png", "jpeg", "webp"],
    unsupportedMessage: "仅支持 PNG、JPEG 或 WebP 图片"
  });
}

export async function validateMaskImageUpload(
  file: File
): Promise<ReferenceImageUploadResult> {
  return validateImageUpload(file, {
    field: "mask",
    formats: ["png"],
    unsupportedMessage: "遮罩仅支持 PNG 图片"
  });
}

async function validateImageUpload(
  file: File,
  options: {
    field: ImageUploadField;
    formats: ReferenceImageFormat[];
    unsupportedMessage: string;
  }
): Promise<ReferenceImageUploadResult> {
  const maxBytes = Number(process.env.MAX_IMAGE_UPLOAD_MB ?? defaultMaxImageUploadMb) *
    1024 *
    1024;

  if (file.size > maxBytes) {
    return uploadError(
      options.field,
      "payload_too_large",
      `图片不能超过 ${Math.round(maxBytes / 1024 / 1024)}MB`
    );
  }

  const mimeType = normalizeMimeType(file.type);
  const extension = getExtension(file.name);
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const detectedFormat = detectImageFormat(header);

  if (
    !mimeType ||
    !isAllowedExtension(extension, options.formats) ||
    detectedFormat === null ||
    !options.formats.includes(detectedFormat) ||
    !mimeMatchesFormat(mimeType, detectedFormat) ||
    !extensionMatchesFormat(extension, detectedFormat)
  ) {
    return uploadError(
      options.field,
      "unsupported_media_type",
      options.unsupportedMessage
    );
  }

  return {
    success: true,
    data: {
      file,
      format: detectedFormat
    }
  };
}

function uploadError(
  field: ImageUploadField,
  code: UploadErrorCode,
  message: string
) {
  return {
    success: false,
    error: {
      code,
      message,
      field
    }
  } as const;
}

function normalizeMimeType(value: string) {
  return allowedMimeTypes.find((mimeType) => mimeType === value.toLowerCase()) ?? null;
}

function getExtension(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase();

  if (!extension) {
    return null;
  }

  return extension;
}

function isAllowedExtension(
  extension: string | null,
  formats: ReferenceImageFormat[]
): extension is (typeof allowedExtensions)[number] {
  return (
    extension !== null &&
    allowedExtensions.includes(extension as (typeof allowedExtensions)[number]) &&
    formats.some((format) => extensionMatchesFormat(extension, format))
  );
}

function detectImageFormat(header: Uint8Array): ReferenceImageFormat | null {
  if (
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4e &&
    header[3] === 0x47 &&
    header[4] === 0x0d &&
    header[5] === 0x0a &&
    header[6] === 0x1a &&
    header[7] === 0x0a
  ) {
    return "png";
  }

  if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return "jpeg";
  }

  if (
    header[0] === 0x52 &&
    header[1] === 0x49 &&
    header[2] === 0x46 &&
    header[3] === 0x46 &&
    header[8] === 0x57 &&
    header[9] === 0x45 &&
    header[10] === 0x42 &&
    header[11] === 0x50
  ) {
    return "webp";
  }

  return null;
}

function mimeMatchesFormat(
  mimeType: (typeof allowedMimeTypes)[number],
  format: ReferenceImageFormat
) {
  if (format === "jpeg") {
    return mimeType === "image/jpeg";
  }

  return mimeType === `image/${format}`;
}

function extensionMatchesFormat(extension: string, format: ReferenceImageFormat) {
  if (format === "jpeg") {
    return extension === "jpg" || extension === "jpeg";
  }

  return extension === format;
}

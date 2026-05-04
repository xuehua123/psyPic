const allowedMimeTypes = ["image/png", "image/jpeg", "image/webp"] as const;
const allowedExtensions = ["png", "jpg", "jpeg", "webp"] as const;
const defaultMaxImageUploadMb = 20;

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
        width?: number;
        height?: number;
      };
    }
  | {
      success: false;
      error: UploadError;
    };

export async function validateReferenceImageUpload(
  file: File,
  options?: { maxUploadMb?: number }
): Promise<ReferenceImageUploadResult> {
  return validateImageUpload(file, {
    field: "image",
    formats: ["png", "jpeg", "webp"],
    unsupportedMessage: "仅支持 PNG、JPEG 或 WebP 图片",
    maxUploadMb: options?.maxUploadMb
  });
}

export async function validateMaskImageUpload(
  file: File,
  options?: { maxUploadMb?: number }
): Promise<ReferenceImageUploadResult> {
  return validateImageUpload(file, {
    field: "mask",
    formats: ["png"],
    unsupportedMessage: "遮罩仅支持 PNG 图片",
    maxUploadMb: options?.maxUploadMb
  });
}

async function validateImageUpload(
  file: File,
  options: {
    field: ImageUploadField;
    formats: ReferenceImageFormat[];
    unsupportedMessage: string;
    maxUploadMb?: number;
  }
): Promise<ReferenceImageUploadResult> {
  const maxUploadMb =
    options.maxUploadMb ??
    Number(process.env.MAX_IMAGE_UPLOAD_MB ?? defaultMaxImageUploadMb);
  const maxBytes = maxUploadMb *
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
  const header = new Uint8Array(await file.slice(0, 64 * 1024).arrayBuffer());
  const detectedFormat = detectImageFormat(header);
  const dimensions = detectedFormat
    ? detectImageDimensions(header, detectedFormat)
    : null;

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
      format: detectedFormat,
      ...(dimensions ?? {})
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

function detectImageDimensions(
  header: Uint8Array,
  format: ReferenceImageFormat
) {
  if (format === "png") {
    return detectPngDimensions(header);
  }

  if (format === "jpeg") {
    return detectJpegDimensions(header);
  }

  return detectWebpDimensions(header);
}

function detectPngDimensions(header: Uint8Array) {
  if (
    header.length < 24 ||
    header[12] !== 0x49 ||
    header[13] !== 0x48 ||
    header[14] !== 0x44 ||
    header[15] !== 0x52
  ) {
    return null;
  }

  return {
    width: readUint32BE(header, 16),
    height: readUint32BE(header, 20)
  };
}

function detectJpegDimensions(header: Uint8Array) {
  let offset = 2;

  while (offset + 9 < header.length) {
    if (header[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = header[offset + 1];
    const length = readUint16BE(header, offset + 2);

    if (length < 2) {
      return null;
    }

    if (isJpegStartOfFrame(marker)) {
      return {
        height: readUint16BE(header, offset + 5),
        width: readUint16BE(header, offset + 7)
      };
    }

    offset += 2 + length;
  }

  return null;
}

function detectWebpDimensions(header: Uint8Array) {
  if (
    header.length < 30 ||
    header[0] !== 0x52 ||
    header[1] !== 0x49 ||
    header[2] !== 0x46 ||
    header[3] !== 0x46 ||
    header[8] !== 0x57 ||
    header[9] !== 0x45 ||
    header[10] !== 0x42 ||
    header[11] !== 0x50
  ) {
    return null;
  }

  const chunkType = String.fromCharCode(
    header[12],
    header[13],
    header[14],
    header[15]
  );

  if (chunkType === "VP8X") {
    return {
      width: 1 + readUint24LE(header, 24),
      height: 1 + readUint24LE(header, 27)
    };
  }

  if (chunkType === "VP8 " && header.length >= 30) {
    return {
      width: readUint16LE(header, 26) & 0x3fff,
      height: readUint16LE(header, 28) & 0x3fff
    };
  }

  if (chunkType === "VP8L" && header.length >= 25 && header[20] === 0x2f) {
    const bits =
      header[21] |
      (header[22] << 8) |
      (header[23] << 16) |
      (header[24] << 24);

    return {
      width: 1 + (bits & 0x3fff),
      height: 1 + ((bits >> 14) & 0x3fff)
    };
  }

  return null;
}

function isJpegStartOfFrame(marker: number) {
  return (
    marker >= 0xc0 &&
    marker <= 0xcf &&
    marker !== 0xc4 &&
    marker !== 0xc8 &&
    marker !== 0xcc
  );
}

function readUint16BE(bytes: Uint8Array, offset: number) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint16LE(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint24LE(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readUint32BE(bytes: Uint8Array, offset: number) {
  return (
    (bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0;
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

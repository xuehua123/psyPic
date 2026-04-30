import { describe, expect, it } from "vitest";
import { validateReferenceImageUpload } from "@/lib/validation/upload";

const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function imageFile(input: {
  name: string;
  type: string;
  bytes?: Uint8Array;
}) {
  const bytes = input.bytes ?? pngBytes;
  const blobPart = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;

  return new File([blobPart], input.name, { type: input.type });
}

describe("reference image upload validation", () => {
  it("accepts a real PNG reference image", async () => {
    const result = await validateReferenceImageUpload(
      imageFile({ name: "product.png", type: "image/png" })
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("expected valid upload");
    }

    expect(result.data.format).toBe("png");
    expect(result.data.file).toBeInstanceOf(File);
  });

  it("rejects files whose MIME, extension, or file header is not an image", async () => {
    await expect(
      validateReferenceImageUpload(
        imageFile({
          name: "product.txt",
          type: "text/plain",
          bytes: new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f])
        })
      )
    ).resolves.toMatchObject({
      success: false,
      error: {
        code: "unsupported_media_type",
        field: "image"
      }
    });
  });

  it("rejects images over the configured max size", async () => {
    const tooLarge = new Uint8Array(11 * 1024 * 1024);
    tooLarge.set(pngBytes, 0);

    await expect(
      validateReferenceImageUpload(
        imageFile({
          name: "large.png",
          type: "image/png",
          bytes: tooLarge
        })
      )
    ).resolves.toMatchObject({
      success: false,
      error: {
        code: "payload_too_large",
        field: "image"
      }
    });
  });
});

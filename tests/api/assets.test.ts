import { describe, expect, it } from "vitest";
import { GET as getAsset } from "@/app/api/assets/[assetId]/route";
import { POST as exchangeImportCode } from "@/app/api/import/exchange/route";
import { getSession, resetDevStore } from "@/server/services/dev-store";
import {
  createTempAssetFromBase64,
  resetTempAssetStore
} from "@/server/services/temp-asset-service";

async function bindSession() {
  const response = await exchangeImportCode(
    new Request("http://localhost/api/import/exchange", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ import_code: "valid_one_time_code" })
    })
  );
  const cookie = response.headers.get("set-cookie")?.split(";")[0] ?? "";
  const sessionId = cookie.replace("psypic_session=", "");
  const session = getSession(sessionId);

  if (!session) {
    throw new Error("expected test session");
  }

  return { cookie, session };
}

describe("GET /api/assets/{assetId}", () => {
  it("returns generated image bytes for the owning session", async () => {
    resetDevStore();
    await resetTempAssetStore();
    const { cookie, session } = await bindSession();
    const asset = await createTempAssetFromBase64({
      userId: session.user_id,
      taskId: "task_123",
      b64Json: Buffer.from("image-bytes").toString("base64"),
      format: "png"
    });

    const response = await getAsset(
      new Request(`http://localhost/api/assets/${asset.id}`, {
        headers: { cookie }
      }),
      { params: Promise.resolve({ assetId: asset.id }) }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("image-bytes");
  });

  it("rejects unauthenticated asset access", async () => {
    await resetTempAssetStore();
    const asset = await createTempAssetFromBase64({
      userId: "user_owner",
      taskId: "task_123",
      b64Json: Buffer.from("image-bytes").toString("base64"),
      format: "png"
    });

    const response = await getAsset(
      new Request(`http://localhost/api/assets/${asset.id}`),
      { params: Promise.resolve({ assetId: asset.id }) }
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("unauthorized");
  });
});

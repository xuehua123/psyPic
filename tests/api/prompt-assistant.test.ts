import { describe, expect, it } from "vitest";
import { POST as assistPrompt } from "@/app/api/prompts/assist/route";

describe("POST /api/prompts/assist", () => {
  it("returns an optimized prompt for commercial creation", async () => {
    const response = await assistPrompt(
      new Request("http://localhost/api/prompts/assist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "透明香水瓶，适合电商主图，高级灰背景",
          mode: "text",
          template_id: "tpl_ecommerce_main"
        })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.optimized_prompt).toContain(
      "Create a high-quality commercial image."
    );
    expect(body.data.optimized_prompt).toContain("透明香水瓶");
    expect(body.data.sections).toEqual(
      expect.arrayContaining(["Scene", "Subject", "Constraints", "Output"])
    );
  });

  it("rejects empty prompts", async () => {
    const response = await assistPrompt(
      new Request("http://localhost/api/prompts/assist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "   ",
          mode: "text"
        })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatchObject({
      code: "invalid_parameter",
      details: { field: "prompt" }
    });
  });
});

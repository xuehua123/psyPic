import { describe, expect, it } from "vitest";
import { GET as listTemplates } from "@/app/api/templates/route";
import { POST as renderTemplatePrompt } from "@/app/api/templates/render-prompt/route";

describe("Templates API", () => {
  it("lists commercial templates with scene filtering and limit", async () => {
    const response = await listTemplates(
      new Request("http://localhost/api/templates?scene=ecommerce&limit=30")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0]).toMatchObject({
      id: "tpl_ecommerce_main",
      name: "电商主图",
      scene: "ecommerce",
      requires_image: false,
      default_params: {
        size: "1024x1024",
        quality: "medium",
        output_format: "png"
      }
    });
    expect(body.data.items[0].fields[0]).toMatchObject({
      key: "product_type",
      label: "产品类型",
      type: "text",
      required: true
    });
    expect(body.data.next_cursor).toBeNull();
    expect(JSON.stringify(body)).not.toContain("promptTemplate");
  });

  it("paginates the full template list", async () => {
    const response = await listTemplates(
      new Request("http://localhost/api/templates?limit=2")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.items.map((item: { id: string }) => item.id)).toEqual([
      "tpl_ecommerce_main",
      "tpl_product_background"
    ]);
    expect(body.data.next_cursor).toBe("tpl_product_background");
  });

  it("renders a commercial prompt from structured fields", async () => {
    const response = await renderTemplatePrompt(
      new Request("http://localhost/api/templates/render-prompt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          template_id: "tpl_ad_banner",
          fields: {
            campaign_theme: "新品上市",
            product_type: "透明玻璃香水瓶",
            visual_style: "高端极简",
            space_for_text: "右侧留白",
            platform: "网站横幅"
          }
        })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.prompt).toContain(
      "Create a commercial advertising banner visual."
    );
    expect(body.data.prompt).toContain("透明玻璃香水瓶");
    expect(body.data.prompt).not.toMatch(/\{[a-z_]+\}/);
    expect(body.data.params).toMatchObject({
      model: "gpt-image-2",
      size: "1536x1024",
      quality: "medium",
      n: 1,
      output_format: "png",
      background: "auto",
      moderation: "auto"
    });
  });

  it("rejects rendering when required template fields are empty", async () => {
    const response = await renderTemplatePrompt(
      new Request("http://localhost/api/templates/render-prompt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          template_id: "tpl_ecommerce_main",
          fields: {
            product_type: "   "
          }
        })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatchObject({
      code: "invalid_parameter",
      details: { field: "product_type" }
    });
  });

  it("rejects unknown templates", async () => {
    const response = await renderTemplatePrompt(
      new Request("http://localhost/api/templates/render-prompt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          template_id: "tpl_missing",
          fields: {}
        })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("not_found");
  });
});

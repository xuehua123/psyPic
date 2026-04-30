import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import CommunityWorkDetailPage from "@/components/community/CommunityWorkDetailPage";

describe("CommunityWorkDetailPage", () => {
  it("renders a community work detail with privacy-aware fields", () => {
    render(
      <CommunityWorkDetailPage
        work={{
          work_id: "work_detail_123",
          title: "高级灰香水主图",
          scene: "ecommerce",
          tags: ["电商主图"],
          image_url: "/api/assets/asset_detail_123",
          thumbnail_url: "/api/assets/asset_detail_123",
          same_generation_available: true,
          prompt: "Create a premium product photo.",
          created_at: "2026-05-01T00:00:00.000Z"
        }}
      />
    );

    expect(screen.getByRole("img", { name: "高级灰香水主图" })).toHaveAttribute(
      "src",
      "/api/assets/asset_detail_123"
    );
    expect(screen.getByText("Create a premium product photo.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回社区" })).toHaveAttribute(
      "href",
      "/community"
    );
  });

  it("renders an unavailable state when the work cannot be viewed", () => {
    render(<CommunityWorkDetailPage work={null} />);

    expect(screen.getByRole("alert")).toHaveTextContent("作品不存在");
  });

  it("loads a same-generation draft without exposing hidden fields", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            draft: {
              prompt: "按公开标签生成相似商业图片。",
              params: {
                size: "1024x1024",
                quality: "medium"
              }
            }
          },
          request_id: "psypic_req_same_123"
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchSpy);

    render(
      <CommunityWorkDetailPage
        work={{
          work_id: "work_same_123",
          title: "高级灰香水主图",
          scene: "ecommerce",
          tags: ["电商主图"],
          image_url: "/api/assets/asset_detail_123",
          thumbnail_url: "/api/assets/asset_detail_123",
          same_generation_available: true,
          created_at: "2026-05-01T00:00:00.000Z"
        }}
      />
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "生成同款草稿" }));

    expect(await screen.findByText("按公开标签生成相似商业图片。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "套用到创作台" })).toHaveAttribute(
      "href",
      "/?same_work=work_same_123"
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/community/works/work_same_123/same",
      { method: "POST" }
    );
  });
});

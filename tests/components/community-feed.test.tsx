import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import CommunityFeedPage from "@/components/community/CommunityFeedPage";

describe("CommunityFeedPage", () => {
  it("renders public works with scene, tags and detail links", () => {
    render(
      <CommunityFeedPage
        works={[
          {
            work_id: "work_feed_123",
            title: "高级灰香水主图",
            scene: "ecommerce",
            tags: ["电商主图", "香水"],
            image_url: "/api/assets/asset_feed_123",
            thumbnail_url: "/api/assets/asset_feed_123",
            same_generation_available: true,
            like_count: 3,
            favorite_count: 1,
            liked: false,
            favorited: true,
            featured: true,
            created_at: "2026-05-01T00:00:00.000Z"
          }
        ]}
      />
    );

    expect(screen.getByText("高级灰香水主图")).toBeInTheDocument();
    expect(screen.getByText("ecommerce")).toBeInTheDocument();
    expect(screen.getByText("电商主图")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "高级灰香水主图" })).toHaveAttribute(
      "src",
      "/api/assets/asset_feed_123"
    );
    expect(screen.getByRole("link", { name: "查看作品" })).toHaveAttribute(
      "href",
      "/community/works/work_feed_123"
    );
    expect(screen.getByText("精选")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "点赞 3" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "已收藏 1" })).toBeInTheDocument();
  });

  it("renders an empty state when there are no public works", () => {
    render(<CommunityFeedPage works={[]} />);

    expect(screen.getByText("暂无公开作品")).toBeInTheDocument();
  });

  it("updates like state from the feed card", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            like_count: 4,
            liked: true
          }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchSpy);

    render(
      <CommunityFeedPage
        works={[
          {
            work_id: "work_feed_like",
            title: "互动作品",
            scene: "ecommerce",
            tags: ["互动"],
            image_url: "/api/assets/asset_feed_like",
            thumbnail_url: "/api/assets/asset_feed_like",
            same_generation_available: false,
            like_count: 3,
            favorite_count: 0,
            liked: false,
            favorited: false,
            featured: false,
            created_at: "2026-05-01T00:00:00.000Z"
          }
        ]}
      />
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "点赞 3" }));

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/community/works/work_feed_like/like",
      { method: "POST" }
    );
    expect(await screen.findByRole("button", { name: "已点赞 4" })).toBeInTheDocument();
  });
});

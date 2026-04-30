import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
  });

  it("renders an empty state when there are no public works", () => {
    render(<CommunityFeedPage works={[]} />);

    expect(screen.getByText("暂无公开作品")).toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LibraryAssetDetailPage from "@/components/library/LibraryAssetDetailPage";

describe("LibraryAssetDetailPage", () => {
  it("loads and renders a library asset detail with edit and download actions", async () => {
    render(
      <LibraryAssetDetailPage
        item={{
          asset_id: "asset_detail_123",
          task_id: "task_detail_123",
          type: "generation",
          prompt: "Create a premium detail product photo.",
          params: {
            prompt: "Create a premium detail product photo.",
            model: "gpt-image-2",
            size: "1024x1024",
            quality: "medium",
            n: 1,
            output_format: "png",
            output_compression: null,
            background: "auto",
            moderation: "auto"
          },
          url: "/api/assets/asset_detail_123",
          thumbnail_url: "/api/assets/asset_detail_123",
          format: "png",
          usage: {
            input_tokens: 10,
            output_tokens: 20,
            total_tokens: 30,
            estimated_cost: "0.0000"
          },
          duration_ms: 1200,
          created_at: "2026-05-01T00:00:00.000Z",
          favorite: true,
          tags: ["电商主图"]
        }}
      />
    );

    expect(screen.getByText("asset_detail_123")).toBeInTheDocument();
    expect(screen.getByText("Create a premium detail product photo.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "下载" })).toHaveAttribute(
      "href",
      "/api/assets/asset_detail_123"
    );
    expect(screen.getByRole("link", { name: "继续编辑" })).toHaveAttribute(
      "href",
      "/?reference_asset=asset_detail_123"
    );
  });

  it("renders an error state without waiting for client fetch", () => {
    render(<LibraryAssetDetailPage item={null} errorMessage="素材不存在。" />);

    expect(screen.getByRole("alert")).toHaveTextContent("素材不存在。");
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AdminDashboardPage from "@/components/admin/AdminDashboardPage";

describe("AdminDashboardPage", () => {
  it("renders usage, runtime controls and report queue", () => {
    render(
      <AdminDashboardPage
        auditLogs={[]}
        reports={[
          {
            report_id: "report_123",
            work_id: "work_123",
            reason: "privacy",
            details: "疑似公开隐私素材",
            status: "open",
            created_at: "2026-05-01T00:00:00.000Z",
            work: {
              work_id: "work_123",
              title: "高级灰香水主图",
              review_status: "approved",
              visibility: "public",
              featured: false
            }
          }
        ]}
        runtimeSettings={{
          max_n: 4,
          max_upload_mb: 20,
          max_size_tier: "2K",
          allow_moderation_low: false,
          community_enabled: true,
          public_publish_enabled: true,
          stream_enabled: true
        }}
        usage={{
          task_count: 3,
          image_count: 5,
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
          estimated_cost: "0.4200"
        }}
      />
    );

    expect(screen.getByRole("heading", { name: "管理端" })).toBeInTheDocument();
    expect(screen.getByText("生成任务")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByLabelText("最大生成数量")).toHaveValue(4);
    expect(screen.getByLabelText("允许公开发布")).toBeChecked();
    expect(screen.getByText("高级灰香水主图")).toBeInTheDocument();
    expect(screen.getByText("疑似公开隐私素材")).toBeInTheDocument();
  });

  it("saves runtime settings through the admin API", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: true } }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchSpy);

    render(
      <AdminDashboardPage
        auditLogs={[]}
        reports={[]}
        runtimeSettings={{
          max_n: 4,
          max_upload_mb: 20,
          max_size_tier: "2K",
          allow_moderation_low: false,
          community_enabled: true,
          public_publish_enabled: true,
          stream_enabled: true
        }}
        usage={{
          task_count: 0,
          image_count: 0,
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
          estimated_cost: "0.0000"
        }}
      />
    );

    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("最大生成数量"));
    await user.type(screen.getByLabelText("最大生成数量"), "2");
    await user.click(screen.getByRole("button", { name: "保存运行时配置" }));

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/admin/runtime-settings",
      expect.objectContaining({
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: expect.stringContaining('"max_n":2')
      })
    );
  });
});

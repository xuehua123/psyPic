import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import CreatorWorkspace from "@/components/creator/CreatorWorkspace";

describe("CreatorWorkspace", () => {
  it("renders the v0.1 creator shell as the first screen", () => {
    render(<CreatorWorkspace />);

    expect(screen.getByTestId("left-parameter-panel")).toBeInTheDocument();
    expect(screen.getByTestId("center-workspace")).toBeInTheDocument();
    expect(screen.getByTestId("right-history-panel")).toBeInTheDocument();
    expect(screen.getByTestId("commercial-template-list")).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Prompt" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /生成图片/ })
    ).toBeInTheDocument();
    expect(screen.queryByText(/营销首页|hero/i)).not.toBeInTheDocument();
  });

  it("keeps advanced parameters collapsed by default", () => {
    render(<CreatorWorkspace />);

    expect(
      screen.getByRole("button", { name: /高级参数/ })
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Moderation")).not.toBeInTheDocument();
  });

  it("provides a mobile bottom parameter panel entry", () => {
    render(<CreatorWorkspace />);

    expect(
      screen.getByRole("button", { name: "打开参数面板" })
    ).toBeInTheDocument();
  });

  it("submits text-to-image requests and renders result metadata", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              task_id: "task_123",
              images: [
                {
                  asset_id: "asset_123",
                  url: "/api/assets/asset_123",
                  format: "png"
                }
              ],
              usage: {
                input_tokens: 10,
                output_tokens: 20,
                total_tokens: 30,
                estimated_cost: "0.0000"
              },
              duration_ms: 1200
            },
            request_id: "psypic_req_123",
            upstream_request_id: "upstream_req_123"
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
    );
    vi.stubGlobal("fetch", fetchSpy);

    render(<CreatorWorkspace />);

    const user = userEvent.setup();
    await user.selectOptions(
      screen.getByLabelText("商业尺寸"),
      "ad_banner_landscape"
    );
    await user.type(
      screen.getByRole("textbox", { name: "Prompt" }),
      "Create a premium product photo."
    );
    await user.click(screen.getByRole("button", { name: /生成图片/ }));

    expect(await screen.findByText("asset_123")).toBeInTheDocument();
    expect(screen.getAllByText("psypic_req_123").length).toBeGreaterThanOrEqual(
      1
    );
    expect(screen.getAllByText(/30 tokens/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("link", { name: "下载" })).toHaveAttribute(
      "href",
      "/api/assets/asset_123"
    );
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body as string).size).toBe(
      "1536x1024"
    );
  });

  it("loads and displays the server task status after generation", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        generationResponse({
          taskId: "task_status_123",
          assetId: "asset_status_123",
          requestId: "psypic_req_status_123"
        })
      )
      .mockResolvedValueOnce(
        taskResponse({
          taskId: "task_status_123",
          status: "succeeded",
          requestId: "psypic_req_task_status_123"
        })
      );
    vi.stubGlobal("fetch", fetchSpy);

    render(<CreatorWorkspace />);

    const user = userEvent.setup();
    await user.type(
      screen.getByRole("textbox", { name: "Prompt" }),
      "Create a premium product photo."
    );
    await user.click(screen.getByRole("button", { name: /生成图片/ }));

    const taskStatus = await screen.findByRole("status", {
      name: "任务状态"
    });
    expect(taskStatus).toHaveTextContent("task_status_123");
    expect(taskStatus).toHaveTextContent("已完成");
    expect(fetchSpy).toHaveBeenCalledWith("/api/tasks/task_status_123", {
      method: "GET"
    });
  });

  it("cancels a running task from the task status panel", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        generationResponse({
          taskId: "task_running_123",
          assetId: "asset_running_123",
          requestId: "psypic_req_running_123"
        })
      )
      .mockResolvedValueOnce(
        taskResponse({
          taskId: "task_running_123",
          status: "running",
          requestId: "psypic_req_task_running_123"
        })
      )
      .mockResolvedValueOnce(
        taskResponse({
          taskId: "task_running_123",
          status: "canceled",
          requestId: "psypic_req_task_canceled_123"
        })
      );
    vi.stubGlobal("fetch", fetchSpy);

    render(<CreatorWorkspace />);

    const user = userEvent.setup();
    await user.type(
      screen.getByRole("textbox", { name: "Prompt" }),
      "Create a premium product photo."
    );
    await user.click(screen.getByRole("button", { name: /生成图片/ }));
    await user.click(await screen.findByRole("button", { name: "取消任务" }));

    expect(await screen.findByText("已取消")).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledWith("/api/tasks/task_running_123", {
      method: "POST"
    });
  });

  it("retries a canceled task from the task status panel", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        generationResponse({
          taskId: "task_retry_original",
          assetId: "asset_retry_original",
          requestId: "psypic_req_retry_original"
        })
      )
      .mockResolvedValueOnce(
        taskResponse({
          taskId: "task_retry_original",
          status: "running",
          requestId: "psypic_req_task_retry_running"
        })
      )
      .mockResolvedValueOnce(
        taskResponse({
          taskId: "task_retry_original",
          status: "canceled",
          requestId: "psypic_req_task_retry_canceled"
        })
      )
      .mockResolvedValueOnce(
        generationResponse({
          taskId: "task_retry_next",
          assetId: "asset_retry_next",
          requestId: "psypic_req_retry_next"
        })
      )
      .mockResolvedValueOnce(
        taskResponse({
          taskId: "task_retry_next",
          status: "succeeded",
          requestId: "psypic_req_task_retry_next"
        })
      );
    vi.stubGlobal("fetch", fetchSpy);

    render(<CreatorWorkspace />);

    const user = userEvent.setup();
    await user.type(
      screen.getByRole("textbox", { name: "Prompt" }),
      "Create a premium product photo."
    );
    await user.click(screen.getByRole("button", { name: /生成图片/ }));
    await user.click(await screen.findByRole("button", { name: "取消任务" }));
    await user.click(await screen.findByRole("button", { name: "重新生成" }));

    expect((await screen.findAllByText("task_retry_next")).length).toBeGreaterThan(
      0
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      4,
      "/api/images/generations",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("streams partial previews and the completed image from the creator", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      streamResponse([
        {
          event: "task_started",
          data: {
            task_id: "task_stream_123",
            status: "running",
            request_id: "psypic_req_stream_123",
            upstream_request_id: "upstream_stream_123"
          }
        },
        {
          event: "partial_image",
          data: {
            task_id: "task_stream_123",
            index: 0,
            asset_id: "asset_partial_123",
            url: "/api/assets/asset_partial_123",
            format: "png"
          }
        },
        {
          event: "completed",
          data: {
            task_id: "task_stream_123",
            images: [
              {
                asset_id: "asset_stream_final_123",
                url: "/api/assets/asset_stream_final_123",
                format: "png"
              }
            ],
            usage: {
              input_tokens: 10,
              output_tokens: 20,
              total_tokens: 30,
              estimated_cost: "0.0000"
            },
            duration_ms: 1300
          }
        }
      ])
    );
    vi.stubGlobal("fetch", fetchSpy);

    render(<CreatorWorkspace />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name: "流式预览" }));
    await user.type(
      screen.getByRole("textbox", { name: "Prompt" }),
      "Create a premium product photo."
    );
    await user.click(screen.getByRole("button", { name: /生成图片/ }));

    expect(await screen.findByText("asset_partial_123")).toBeInTheDocument();
    expect(await screen.findByText("asset_stream_final_123")).toBeInTheDocument();
    expect((await screen.findAllByText("task_stream_123")).length).toBeGreaterThan(
      0
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/images/generations/stream",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"stream":true')
      })
    );
  });

  it("renders commercial template prompts into the workspace", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            task_id: "task_social_123",
            images: [
              {
                asset_id: "asset_social_123",
                url: "/api/assets/asset_social_123",
                format: "png"
              }
            ],
            usage: {
              input_tokens: 10,
              output_tokens: 20,
              total_tokens: 30,
              estimated_cost: "0.0000"
            },
            duration_ms: 1200
          },
          request_id: "psypic_req_social_123"
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchSpy);

    render(<CreatorWorkspace />);

    const user = userEvent.setup();
    await user.type(
      screen.getByRole("textbox", { name: "Prompt" }),
      "AI 生图社区"
    );
    await user.click(screen.getByRole("button", { name: /社媒封面/ }));
    await user.click(screen.getByRole("button", { name: /生成图片/ }));

    const requestBody = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(requestBody.size).toBe("1024x1536");
    expect(requestBody.prompt).toContain("Create a social media cover image");
    expect(requestBody.prompt).toContain("AI 生图社区");
  });

  it("surfaces readable API errors with request ids", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "rate_limited",
              message: "Sub2API 请求被限流或额度不足，请检查 Key 额度与频率限制。"
            },
            request_id: "psypic_req_rate_123",
            upstream_request_id: "upstream_rate_123"
          }),
          { status: 429, headers: { "content-type": "application/json" } }
        )
      )
    );

    render(<CreatorWorkspace />);

    const user = userEvent.setup();
    await user.type(
      screen.getByRole("textbox", { name: "Prompt" }),
      "Create a premium product photo."
    );
    await user.click(screen.getByRole("button", { name: /生成图片/ }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("额度不足");
    expect(alert).toHaveTextContent("psypic_req_rate_123");
    expect(alert).toHaveTextContent("upstream_rate_123");
  });

  it("submits image-to-image requests with one selected reference image", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            task_id: "task_edit_123",
            images: [
              {
                asset_id: "asset_edit_123",
                url: "/api/assets/asset_edit_123",
                format: "png"
              }
            ],
            usage: {
              input_tokens: 15,
              output_tokens: 25,
              total_tokens: 40,
              estimated_cost: "0.0000"
            },
            duration_ms: 1500
          },
          request_id: "psypic_req_edit_123",
          upstream_request_id: "upstream_edit_req_123"
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchSpy);

    render(<CreatorWorkspace />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "图生图" }));
    const reference = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      "product.png",
      { type: "image/png" }
    );
    await user.upload(screen.getByLabelText("参考图"), reference);
    await user.type(
      screen.getByRole("textbox", { name: "Prompt" }),
      "Replace the background with a premium studio scene."
    );
    await user.click(screen.getByRole("button", { name: /生成图片/ }));

    expect(await screen.findByText("asset_edit_123")).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/images/edits",
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData)
      })
    );
    const body = fetchSpy.mock.calls[0][1].body as FormData;
    expect(body.get("image")).toBe(reference);
    expect(body.get("prompt")).toBe(
      "Replace the background with a premium studio scene."
    );
    expect(screen.getByText("product.png")).toBeInTheDocument();
  });

  it("accepts a pasted reference image in image-to-image mode", async () => {
    render(<CreatorWorkspace />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "图生图" }));
    const reference = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      "pasted.png",
      { type: "image/png" }
    );

    fireEvent.paste(screen.getByTestId("reference-dropzone"), {
      clipboardData: {
        files: [reference]
      }
    });

    expect(screen.getByText("pasted.png")).toBeInTheDocument();
  });

  it("turns a generated result into the next reference image", async () => {
    const imageBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
    ]);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                task_id: "task_123",
                images: [
                  {
                    asset_id: "asset_123",
                    url: "/api/assets/asset_123",
                    format: "png"
                  }
                ],
                usage: {
                  input_tokens: 10,
                  output_tokens: 20,
                  total_tokens: 30,
                  estimated_cost: "0.0000"
                },
                duration_ms: 1200
              },
              request_id: "psypic_req_123"
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        )
        .mockResolvedValueOnce(
          taskResponse({
            taskId: "task_123",
            status: "succeeded",
            requestId: "psypic_req_task_123"
          })
        )
        .mockResolvedValueOnce(
          new Response(imageBytes, {
            status: 200,
            headers: { "content-type": "image/png" }
          })
        )
    );

    render(<CreatorWorkspace />);

    const user = userEvent.setup();
    await user.type(
      screen.getByRole("textbox", { name: "Prompt" }),
      "Create a premium product photo."
    );
    await user.click(screen.getByRole("button", { name: /生成图片/ }));
    await user.click(await screen.findByRole("button", { name: "作为参考图" }));

    expect(screen.getByText("asset_123.png")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "图生图" })).toHaveClass("active");
  });

  it("continues editing from a local history result", async () => {
    const imageBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
    ]);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                task_id: "task_history_123",
                images: [
                  {
                    asset_id: "asset_history_123",
                    url: "/api/assets/asset_history_123",
                    format: "png"
                  }
                ],
                usage: {
                  input_tokens: 10,
                  output_tokens: 20,
                  total_tokens: 30,
                  estimated_cost: "0.0000"
                },
                duration_ms: 1200
              },
              request_id: "psypic_req_history_123"
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        )
        .mockResolvedValueOnce(
          taskResponse({
            taskId: "task_history_123",
            status: "succeeded",
            requestId: "psypic_req_task_history_123"
          })
        )
        .mockResolvedValueOnce(
          new Response(imageBytes, {
            status: 200,
            headers: { "content-type": "image/png" }
          })
        )
    );

    render(<CreatorWorkspace />);

    const user = userEvent.setup();
    await user.type(
      screen.getByRole("textbox", { name: "Prompt" }),
      "Create a premium product photo."
    );
    await user.click(screen.getByRole("button", { name: /生成图片/ }));
    await user.click(await screen.findByRole("button", { name: "继续编辑" }));

    expect(screen.getByRole("button", { name: "图生图" })).toHaveClass("active");
    expect(screen.getByText("asset_history_123.png")).toBeInTheDocument();
  });
});

function generationResponse(input: {
  taskId: string;
  assetId: string;
  requestId: string;
}) {
  return new Response(
    JSON.stringify({
      data: {
        task_id: input.taskId,
        images: [
          {
            asset_id: input.assetId,
            url: `/api/assets/${input.assetId}`,
            format: "png"
          }
        ],
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          estimated_cost: "0.0000"
        },
        duration_ms: 1200
      },
      request_id: input.requestId
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

function taskResponse(input: {
  taskId: string;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  requestId: string;
}) {
  return new Response(
    JSON.stringify({
      data: {
        id: input.taskId,
        type: "generation",
        status: input.status,
        prompt: "Create a premium product photo.",
        params: {
          model: "gpt-image-2",
          size: "1024x1024",
          quality: "medium",
          n: 1,
          output_format: "png",
          output_compression: null,
          background: "auto",
          moderation: "auto"
        },
        images: [],
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          estimated_cost: "0.0000"
        },
        duration_ms: 1200,
        created_at: "2026-05-01T00:00:00.000Z",
        updated_at: "2026-05-01T00:00:01.000Z"
      },
      request_id: input.requestId
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

function streamResponse(
  events: Array<{ event: string; data: Record<string, unknown> }>
) {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      for (const event of events) {
        controller.enqueue(
          encoder.encode(
            `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`
          )
        );
      }

      controller.close();
    }
  });

  return new Response(stream, {
    status: 200,
    headers: { "content-type": "text/event-stream" }
  });
}

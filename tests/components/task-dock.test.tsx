import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import TaskDockSection from "@/components/creator/studio/TaskDockSection";
import * as useCreatorStudioModule from "@/components/creator/studio/CreatorStudioContext";
import * as useJobRuntimeEventsModule from "@/lib/creator/use-job-runtime-events";

vi.mock("@/components/creator/studio/CreatorStudioContext", () => ({
  useCreatorStudio: vi.fn()
}));

vi.mock("@/lib/creator/use-job-runtime-events", () => ({
  useJobRuntimeEvents: vi.fn()
}));

describe("TaskDockSection", () => {
  const mockUseCreatorStudio = vi.mocked(useCreatorStudioModule.useCreatorStudio);
  const mockUseJobRuntimeEvents = vi.mocked(useJobRuntimeEventsModule.useJobRuntimeEvents);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows empty state when no active task or node", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCreatorStudio.mockReturnValue({ activeNodeId: null } as any);
    mockUseJobRuntimeEvents.mockReturnValue({
      events: [],
      isLoading: false,
      error: null,
      mode: "ready",
      refresh: vi.fn()
    });

    render(<TaskDockSection activeTaskId={null} />);

    expect(screen.getByText("无活动任务")).toBeInTheDocument();
  });

  it("prioritizes activeTaskId over activeNodeId", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCreatorStudio.mockReturnValue({ activeNodeId: "node_1" } as any);
    mockUseJobRuntimeEvents.mockReturnValue({
      events: [],
      isLoading: false,
      error: null,
      mode: "ready",
      refresh: vi.fn()
    });

    render(<TaskDockSection activeTaskId="task_2" />);

    expect(mockUseJobRuntimeEvents).toHaveBeenCalledWith({
      taskId: "task_2",
      versionNodeId: null
    });
    expect(screen.getByText("任务日志 (当前)")).toBeInTheDocument();
  });

  it("uses activeNodeId if activeTaskId is missing", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCreatorStudio.mockReturnValue({ activeNodeId: "node_1" } as any);
    mockUseJobRuntimeEvents.mockReturnValue({
      events: [],
      isLoading: false,
      error: null,
      mode: "ready",
      refresh: vi.fn()
    });

    render(<TaskDockSection />);

    expect(mockUseJobRuntimeEvents).toHaveBeenCalledWith({
      taskId: null,
      versionNodeId: "node_1"
    });
    expect(screen.getByText("任务日志 (历史)")).toBeInTheDocument();
  });

  it("renders different event types", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCreatorStudio.mockReturnValue({ activeNodeId: "node_1" } as any);
    mockUseJobRuntimeEvents.mockReturnValue({
      events: [
        { id: "1", type: "queued", created_at: "2024-01-01T00:00:00Z" },
        { id: "2", type: "running", created_at: "2024-01-01T00:00:01Z" },
        { id: "3", type: "partial_image", created_at: "2024-01-01T00:00:02Z" },
        { id: "4", type: "succeeded", created_at: "2024-01-01T00:00:03Z" }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any,
      isLoading: false,
      error: null,
      mode: "ready",
      refresh: vi.fn()
    });

    render(<TaskDockSection />);

    expect(screen.getByTestId("event-item-queued")).toBeInTheDocument();
    expect(screen.getByText("排队中")).toBeInTheDocument();
    expect(screen.getByTestId("event-item-running")).toBeInTheDocument();
    expect(screen.getByText("运行中")).toBeInTheDocument();
    expect(screen.getByTestId("event-item-partial_image")).toBeInTheDocument();
    expect(screen.getByText("生成预览图")).toBeInTheDocument();
    expect(screen.getByTestId("event-item-succeeded")).toBeInTheDocument();
    expect(screen.getByText("生成成功")).toBeInTheDocument();
  });

  it("handles auth_error mode", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCreatorStudio.mockReturnValue({ activeNodeId: "node_1" } as any);
    mockUseJobRuntimeEvents.mockReturnValue({
      events: [],
      isLoading: false,
      error: { code: "unauthorized", message: "" },
      mode: "auth_error",
      refresh: vi.fn()
    });

    render(<TaskDockSection />);

    expect(screen.getByText("请登录后查看任务日志")).toBeInTheDocument();
  });

  it("handles fallback mode", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCreatorStudio.mockReturnValue({ activeNodeId: "node_1" } as any);
    mockUseJobRuntimeEvents.mockReturnValue({
      events: [],
      isLoading: false,
      error: { code: "network_error", message: "" },
      mode: "fallback",
      refresh: vi.fn()
    });

    render(<TaskDockSection />);

    expect(screen.getByText("无法连接服务器，暂时无法查看日志")).toBeInTheDocument();
  });
});

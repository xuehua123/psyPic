import { render, screen, renderHook, waitFor } from "@testing-library/react";
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
        { id: "4", type: "succeeded", created_at: "2024-01-01T00:00:03Z" },
        { id: "5", type: "failed", created_at: "2024-01-01T00:00:04Z" },
        { id: "6", type: "canceled", created_at: "2024-01-01T00:00:05Z" },
        { id: "7", type: "timed_out", created_at: "2024-01-01T00:00:06Z" }
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
    expect(screen.getByTestId("event-item-failed")).toBeInTheDocument();
    expect(screen.getByText("生成失败")).toBeInTheDocument();
    expect(screen.getByTestId("event-item-canceled")).toBeInTheDocument();
    expect(screen.getByText("已取消")).toBeInTheDocument();
    expect(screen.getByTestId("event-item-timed_out")).toBeInTheDocument();
    expect(screen.getByText("超时")).toBeInTheDocument();
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

  it("handles loading mode with empty events", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCreatorStudio.mockReturnValue({ activeNodeId: "node_1" } as any);
    mockUseJobRuntimeEvents.mockReturnValue({
      events: [],
      isLoading: true,
      error: null,
      mode: "loading",
      refresh: vi.fn()
    });

    render(<TaskDockSection />);

    expect(screen.getByText("加载中...")).toBeInTheDocument();
  });

  it("polls while activeTaskStatus is not terminal", () => {
    vi.useFakeTimers();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCreatorStudio.mockReturnValue({ activeNodeId: null } as any);
    const mockRefresh = vi.fn();
    mockUseJobRuntimeEvents.mockReturnValue({
      events: [],
      isLoading: false,
      error: null,
      mode: "ready",
      refresh: mockRefresh
    });

    const { unmount } = render(<TaskDockSection activeTaskId="task_1" activeTaskStatus="running" />);

    vi.advanceTimersByTime(2000);
    expect(mockRefresh).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2000);
    expect(mockRefresh).toHaveBeenCalledTimes(2);

    unmount();
    vi.useRealTimers();
  });

  it("does final refresh when activeTaskStatus becomes terminal, then stops polling", () => {
    vi.useFakeTimers();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCreatorStudio.mockReturnValue({ activeNodeId: null } as any);
    const mockRefresh = vi.fn();
    mockUseJobRuntimeEvents.mockReturnValue({
      events: [],
      isLoading: false,
      error: null,
      mode: "ready",
      refresh: mockRefresh
    });

    const { rerender, unmount } = render(<TaskDockSection activeTaskId="task_1" activeTaskStatus="running" />);

    vi.advanceTimersByTime(2000);
    expect(mockRefresh).toHaveBeenCalledTimes(1);

    rerender(<TaskDockSection activeTaskId="task_1" activeTaskStatus="succeeded" />);

    // One final refresh should be called immediately because status changed to terminal
    expect(mockRefresh).toHaveBeenCalledTimes(2);

    // Polling should stop
    vi.advanceTimersByTime(4000);
    expect(mockRefresh).toHaveBeenCalledTimes(2);

    unmount();
    vi.useRealTimers();
  });

  it("retries terminal task log fetch after a transient error", () => {
    vi.useFakeTimers();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseCreatorStudio.mockReturnValue({ activeNodeId: null } as any);
    const mockRefresh = vi.fn();
    mockUseJobRuntimeEvents.mockReturnValue({
      events: [],
      isLoading: false,
      error: null,
      mode: "ready",
      refresh: mockRefresh
    });

    const { rerender, unmount } = render(
      <TaskDockSection activeTaskId="task_1" activeTaskStatus="running" />
    );

    rerender(<TaskDockSection activeTaskId="task_1" activeTaskStatus="succeeded" />);
    expect(mockRefresh).toHaveBeenCalledTimes(1);

    mockUseJobRuntimeEvents.mockReturnValue({
      events: [],
      isLoading: false,
      error: { code: "http_500", message: "请求失败" },
      mode: "error",
      refresh: mockRefresh
    });
    rerender(<TaskDockSection activeTaskId="task_1" activeTaskStatus="succeeded" />);

    vi.advanceTimersByTime(1000);
    expect(mockRefresh).toHaveBeenCalledTimes(2);

    unmount();
    vi.useRealTimers();
  });

  it("target 清空后旧请求不能覆盖空状态 (stale request guard)", async () => {
    const actualModule = await vi.importActual<typeof import("@/lib/creator/use-job-runtime-events")>("@/lib/creator/use-job-runtime-events");
    const { useJobRuntimeEvents: actualUseJobRuntimeEvents } = actualModule;
    
    const workbenchApi = await import("@/lib/creator/workbench-api");
    const spy = vi.spyOn(workbenchApi, "listJobRuntimeEvents").mockImplementation(async () => {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({
            success: true,
            data: { items: [{ id: "delayed", type: "succeeded", created_at: "" }], next_cursor: null }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any);
        }, 100);
      });
    });

    const { result, rerender } = renderHook((props: Parameters<typeof actualUseJobRuntimeEvents>[0]) => actualUseJobRuntimeEvents(props), {
      initialProps: { taskId: "task_1", versionNodeId: null, autoFetch: true } as Parameters<typeof actualUseJobRuntimeEvents>[0]
    });

    // We quickly clear the target before the fetch resolves
    rerender({ taskId: null, versionNodeId: null, autoFetch: true });

    // The state should be empty
    expect(result.current.events).toEqual([]);

    // Wait for the delayed fetch to complete
    await waitFor(() => new Promise(r => setTimeout(r, 150)));

    // Ensure the old fetch didn't overwrite the empty state
    expect(result.current.events).toEqual([]);

    spy.mockRestore();
  });
});

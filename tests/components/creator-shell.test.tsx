import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import CreatorWorkspace from "@/components/creator/CreatorWorkspace";
import { useSession } from "@/components/auth/SessionProvider";
import * as boardExportModule from "@/lib/creator/board/board-export";
import {
  libraryAssetDragPayload,
  setLibraryAssetDragData
} from "@/lib/creator/board/library-drag";
import { useWorkbench } from "@/lib/creator/use-workbench";

const LONG_CREATOR_FLOW_TIMEOUT_MS = 10_000;

// useWorkbench 默认返回 fallback 模式，避免内部 fetch 干扰测试中的 fetchSpy mock chain
vi.mock("@/lib/creator/use-workbench", () => ({
  useWorkbench: vi.fn().mockReturnValue({
    mode: "fallback",
    serverProjects: [],
    rawServerProjects: [],
    retryAfter: undefined,
    createProject: vi.fn().mockResolvedValue(null),
    renameProject: vi.fn().mockResolvedValue(false),
    deleteProject: vi.fn().mockResolvedValue(false),
    refresh: vi.fn().mockResolvedValue(undefined),
    syncState: { status: "synced", pendingCount: 0, conflicts: [], lastSyncTime: null, retryAfter: null },
    flushSync: vi.fn().mockResolvedValue(undefined),
    dismissSyncConflict: vi.fn()
  })
}));

vi.mock("@/lib/creator/use-version-nodes", () => ({
  useVersionNodes: vi.fn().mockReturnValue({
    nodes: [],
    isLoading: false,
    refresh: vi.fn().mockResolvedValue(undefined),
    refreshForSession: vi.fn().mockResolvedValue(undefined)
  })
}));

// mock useJobRuntimeEvents to avoid consuming fetchSpy mock chain
vi.mock("@/lib/creator/use-job-runtime-events", () => ({
  useJobRuntimeEvents: () => ({
    events: [],
    isLoading: false,
    error: null,
    mode: "ready",
    refresh: vi.fn()
  })
}));

// getSession mock：阻止 SessionProvider 在 mount 时发起真实 fetch，避免消耗测试 fetchSpy chain
vi.mock("@/lib/client/session-api", () => ({
  getSession: vi.fn().mockResolvedValue({
    success: true,
    data: {
      authenticated: false,
      user: null,
      binding: null,
      limits: null,
      features: null
    },
    requestId: "mock_session"
  })
}));

// mock useSession to avoid requiring SessionProvider wrapper inside AppShell
vi.mock("@/components/auth/SessionProvider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/auth/SessionProvider")>();
  return {
    ...actual,
    SessionProvider: ({ children }: { children: ReactNode }) => children,
    useSession: vi.fn().mockReturnValue({
      state: {
        status: "loaded",
        data: {
          authenticated: true,
          user: { id: "user-1", email: "test@example.com", display_name: "Test User", role: "user", last_login_at: "2026-05-11T00:00:00Z" },
          binding: { id: "binding-1", base_url: "https://api.openai.com", default_model: "gpt-4", enabled_models: ["gpt-4"] },
          limits: null,
          features: null
        }
      },
      refreshSession: vi.fn()
    })
  };
});

describe("CreatorWorkspace", () => {
  it("renders the v0.1 creator shell as the first screen", () => {
    render(<CreatorWorkspace />);

    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "工作台" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: "灵感社区" })).toHaveAttribute(
      "href",
      "/community"
    );
    expect(screen.getByRole("link", { name: "设置" })).toHaveAttribute(
      "href",
      "/settings"
    );
    expect(screen.getByTestId("chat-studio-shell")).toBeInTheDocument();
    expect(screen.getByTestId("chat-transcript")).toBeInTheDocument();
    expect(screen.getByTestId("left-parameter-panel")).toBeInTheDocument();
    expect(screen.getByTestId("center-workspace")).toBeInTheDocument();
    expect(screen.getByTestId("right-history-panel")).toBeInTheDocument();
    // 模板入口在 Composer 顶部 quickpick chip（plan slug
    // quiet-glittering-prism · Cut 11+12 起，TemplatesSection 已从 inspector 移除）
    expect(
      screen.getByTestId("quickpick-template-trigger")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Prompt" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /生成图片/ })
    ).toBeInTheDocument();
    expect(screen.queryByText(/营销首页|hero/i)).not.toBeInTheDocument();
  });

  it("keeps the sidebar focused on studio context instead of site navigation", () => {
    render(<CreatorWorkspace />);

    expect(screen.getByRole("button", { name: "新建对话" })).toBeInTheDocument();
    // 平铺折叠卡 sidebar：卡 header 的 aria-label = `${title} · 已折叠/展开`；
    // 用 ` · ` 锚点把 header 和「+ 新对话」按钮区分开。
    expect(
      screen.getByRole("button", { name: /社媒内容项目 ·/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /广告投放项目 ·/ })
    ).toBeInTheDocument();
    expect(screen.queryByText(/^对话$/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "设置" })).toHaveLength(1);
    expect(screen.queryByRole("link", { name: "社区" })).not.toBeInTheDocument();
  });

  it("toggles between transcript and board view via the creator view tabs (plan slug board-mode-final · Cut 2)", async () => {
    const user = userEvent.setup();
    render(<CreatorWorkspace />);

    const transcriptTab = screen.getByTestId("creator-view-tab-transcript");
    const boardTab = screen.getByTestId("creator-view-tab-board");
    const boardPanel = screen.getByTestId("creator-view-board");

    // 默认在 transcript tab。board panel 通过 forceMount 留在 DOM 里
    // （让 BoardProvider state 在 tab 切换时不丢，Cut 3 起需要），
    // 但 data-state=inactive 配合 data-[state=inactive]:hidden 隐藏。
    expect(transcriptTab).toHaveAttribute("data-state", "active");
    expect(boardTab).toHaveAttribute("data-state", "inactive");
    expect(boardPanel).toHaveAttribute("data-state", "inactive");
    expect(screen.getByTestId("chat-transcript")).toBeInTheDocument();
    // forceMount + hidden：board-mode 已挂载（state 持久），但视觉隐藏
    expect(screen.getByTestId("board-mode")).toBeInTheDocument();

    // 点 board tab → 切到 active
    await user.click(boardTab);
    expect(boardTab).toHaveAttribute("data-state", "active");
    expect(transcriptTab).toHaveAttribute("data-state", "inactive");
    expect(boardPanel).toHaveAttribute("data-state", "active");

    // 点回 transcript → board panel 退回 inactive，但 BoardMode 仍挂载
    await user.click(transcriptTab);
    expect(transcriptTab).toHaveAttribute("data-state", "active");
    expect(boardPanel).toHaveAttribute("data-state", "inactive");
    expect(screen.getByTestId("board-mode")).toBeInTheDocument();
  });

  it("injects a board export PNG into the composer reference slot and switches back to transcript (Cut 4.3)", async () => {
    const user = userEvent.setup();

    // mock exportBoardToPng：不依赖真实 canvas，返回固定的 dataUrl + Blob，
    // 让 BoardModeInner.handleExport 走完成功分支。
    const fakeBlob = new Blob([new Uint8Array([0, 1, 2, 3])], {
      type: "image/png"
    });
    const exportSpy = vi
      .spyOn(boardExportModule, "exportBoardToPng")
      .mockReturnValue({
        dataUrl: "data:image/png;base64,AAECAw==",
        blob: fakeBlob,
        width: 1280,
        height: 960
      });

    try {
      render(<CreatorWorkspace />);

      // 1. 切到 Board tab
      const boardTab = screen.getByTestId("creator-view-tab-board");
      const transcriptTab = screen.getByTestId("creator-view-tab-transcript");
      await user.click(boardTab);
      await waitFor(() => {
        expect(screen.getByTestId("board-stage")).toBeInTheDocument();
      });

      // 2. 起步 reference 槽为空 + composer-reference-row 不渲染
      expect(
        screen.queryByTestId("composer-reference-row")
      ).not.toBeInTheDocument();

      // 3. drop 一张图让 export 按钮 enable（复用 LibrarySection 拖图协议）
      const stage = screen.getByTestId("board-stage");
      const dataTransfer = createDataTransferStub();
      setLibraryAssetDragData(
        dataTransfer,
        libraryAssetDragPayload({
          asset_id: "asset_cut43",
          url: "https://example.com/cut43.png",
          prompt: "cut 4.3"
        })
      );
      fireEvent.dragOver(stage, { dataTransfer });
      fireEvent.drop(stage, { dataTransfer, clientX: 80, clientY: 80 });

      const exportButton = await screen.findByTestId(
        "board-export-as-reference"
      );
      await waitFor(() => {
        expect(exportButton).not.toBeDisabled();
      });

      // 4. 点击「作为参考图编辑」
      await user.click(exportButton);

      // 5. exportBoardToPng 被调用
      await waitFor(() => {
        expect(exportSpy).toHaveBeenCalledTimes(1);
      });

      // 6. 切回 transcript（CreatorWorkspace setView("transcript")）
      await waitFor(() => {
        expect(transcriptTab).toHaveAttribute("data-state", "active");
        expect(boardTab).toHaveAttribute("data-state", "inactive");
      });

      // 7. Composer reference 槽显示 board export PNG。文件名 = boardExportAssetId.png
      const referenceRow = await screen.findByTestId("composer-reference-row");
      expect(referenceRow).toBeInTheDocument();
      // BoardExportPanel 的 success state 也带 boardExportAssetId，链路一致
      const successAssetId = screen.getByTestId("board-export-asset-id")
        .textContent ?? "";
      expect(successAssetId).toMatch(/^board-export-\d+-[a-z0-9]{4}$/);

      // referenceRow 里应该出现刚才生成的 board PNG（缩略图 alt / src 含 blob URL）
      const composerImg = within(referenceRow).queryByRole("img");
      expect(composerImg).not.toBeNull();
    } finally {
      exportSpy.mockRestore();
    }
  });

  it("submits board export references with board context once and clears it after success (Cut 4.4)", async () => {
    const user = userEvent.setup();
    const fakeBlob = new Blob([new Uint8Array([4, 5, 6, 7])], {
      type: "image/png"
    });
    const exportSpy = vi
      .spyOn(boardExportModule, "exportBoardToPng")
      .mockReturnValue({
        dataUrl: "data:image/png;base64,BAUGBw==",
        blob: fakeBlob,
        width: 1280,
        height: 960
      });
    const fetchSpy = vi.fn().mockResolvedValue(
      generationResponse({
        taskId: "task_board_cut44",
        assetId: "asset_board_cut44",
        requestId: "psypic_req_board_cut44"
      })
    );
    vi.stubGlobal("fetch", fetchSpy);
    vi.mocked(useWorkbench).mockReturnValue({
      mode: "server",
      serverProjects: [],
      rawServerProjects: [
        {
          id: "commercial",
          user_id: "user-1",
          title: "Commercial",
          sort_order: 0,
          collapsed: false,
          active_session_id: "sess_board_cut44",
          created_at: "2026-05-20T00:00:00.000Z",
          updated_at: "2026-05-20T00:00:00.000Z",
          deleted_at: null
        }
      ],
      retryAfter: undefined,
      createProject: vi.fn().mockResolvedValue(null),
      renameProject: vi.fn().mockResolvedValue(false),
      deleteProject: vi.fn().mockResolvedValue(false),
      refresh: vi.fn().mockResolvedValue(undefined),
      syncState: {
        status: "synced",
        pendingCount: 0,
        conflicts: [],
        lastSyncTime: null,
        retryAfter: null
      },
      flushSync: vi.fn().mockResolvedValue(undefined),
      dismissSyncConflict: vi.fn()
    });

    try {
      render(<CreatorWorkspace />);

      await user.click(screen.getByTestId("creator-view-tab-board"));
      await waitFor(() => {
        expect(screen.getByTestId("board-stage")).toBeInTheDocument();
      });

      const stage = screen.getByTestId("board-stage");
      const dataTransfer = createDataTransferStub();
      setLibraryAssetDragData(
        dataTransfer,
        libraryAssetDragPayload({
          asset_id: "asset_cut44",
          url: "https://example.com/cut44.png",
          prompt: "cut 4.4"
        })
      );
      fireEvent.dragOver(stage, { dataTransfer });
      fireEvent.drop(stage, { dataTransfer, clientX: 80, clientY: 80 });

      const exportButton = await screen.findByTestId(
        "board-export-as-reference"
      );
      await waitFor(() => {
        expect(exportButton).not.toBeDisabled();
      });
      await user.click(exportButton);

      const boardExportAssetId = (
        await screen.findByTestId("board-export-asset-id")
      ).textContent ?? "";
      await user.type(
        screen.getByRole("textbox", { name: "Prompt" }),
        "Refine the board composition."
      );
      await user.click(screen.getByRole("button", { name: /生成图片/ }));

      const editCalls = () =>
        fetchSpy.mock.calls.filter(([url]) => url === "/api/images/edits");
      await waitFor(() => {
        expect(editCalls()).toHaveLength(1);
      });
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /生成图片/ })
        ).not.toBeDisabled();
      });

      const firstBody = editCalls()[0][1].body as FormData;
      expect(firstBody.get("board_export_asset_id")).toBe(boardExportAssetId);
      expect(firstBody.get("board_document_id")).toMatch(
        /^board-doc-\d+-[a-z0-9]{4}$/
      );
      const boardSnapshot = JSON.parse(
        String(firstBody.get("board_snapshot"))
      ) as { layers: Array<{ kind: string; assetId?: string }> };
      expect(boardSnapshot.layers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: "image", assetId: "asset_cut44" })
        ])
      );

      await user.click(screen.getByRole("button", { name: /生成图片/ }));
      await waitFor(() => {
        expect(editCalls()).toHaveLength(2);
      });

      const secondBody = editCalls()[1][1].body as FormData;
      expect(secondBody.has("board_document_id")).toBe(false);
      expect(secondBody.has("board_export_asset_id")).toBe(false);
      expect(secondBody.has("board_snapshot")).toBe(false);
    } finally {
      exportSpy.mockRestore();
      vi.mocked(useWorkbench).mockReturnValue({
        mode: "fallback",
        serverProjects: [],
        rawServerProjects: [],
        retryAfter: undefined,
        createProject: vi.fn().mockResolvedValue(null),
        renameProject: vi.fn().mockResolvedValue(false),
        deleteProject: vi.fn().mockResolvedValue(false),
        refresh: vi.fn().mockResolvedValue(undefined),
        syncState: {
          status: "synced",
          pendingCount: 0,
          conflicts: [],
          lastSyncTime: null,
          retryAfter: null
        },
        flushSync: vi.fn().mockResolvedValue(undefined),
        dismissSyncConflict: vi.fn()
      });
    }
  });

  it("keeps the AdvancedParamsDrawer closed by default (plan slug quiet-glittering-prism · Cut 11)", () => {
    render(<CreatorWorkspace />);

    // QuickPickRow 顶部「⚙ 高级」chip 始终存在，但 drawer 默认关闭
    expect(
      screen.getByTestId("quickpick-advanced-trigger")
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("advanced-params-drawer")
    ).not.toBeInTheDocument();
    // ParamsSection 已删，inspector 不再有 Moderation label
    expect(screen.queryByLabelText("Moderation")).not.toBeInTheDocument();
  });

  it("provides a mobile bottom parameter panel entry", () => {
    render(<CreatorWorkspace />);

    expect(
      screen.getByRole("button", { name: "打开参数面板" })
    ).toBeInTheDocument();
  });

  it("opens the inspector bottom sheet when 打开参数面板 is clicked", async () => {
    const user = userEvent.setup();
    render(<CreatorWorkspace />);

    // 默认底部抽屉关闭，title 不可见
    expect(
      screen.queryByRole("dialog", { name: "参数与素材" })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "打开参数面板" }));

    expect(
      await screen.findByRole("dialog", { name: "参数与素材" })
    ).toBeInTheDocument();
  });

  it("opens the project sidebar drawer when the mobile hamburger is clicked", async () => {
    const user = userEvent.setup();
    render(<CreatorWorkspace />);

    expect(
      screen.queryByRole("dialog", { name: "项目 / 对话" })
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "打开项目侧边栏" })
    );

    expect(
      await screen.findByRole("dialog", { name: "项目 / 对话" })
    ).toBeInTheDocument();
  });

  it("switches projects and branch conversations from the sidebar", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        generationResponse({
          taskId: "task_switchable_123",
          assetId: "asset_switchable_123",
          requestId: "psypic_req_switchable_123"
        })
      )
      .mockResolvedValueOnce(
        taskResponse({
          taskId: "task_switchable_123",
          status: "succeeded",
          requestId: "psypic_req_task_switchable_123"
        })
      );
    vi.stubGlobal("fetch", fetchSpy);

    render(<CreatorWorkspace />);

    const user = userEvent.setup();

    // 平铺折叠卡 sidebar（plan slug clever-swimming-pumpkin）下：
    // - 默认 active=commercial，「社区同款草稿」(id=same) 卡折叠
    // - 点 same card header 仅 toggle 展开（不切 active）
    // - 切 active 要点卡内「全部对话」row（同时调
    //   onSelectProject + onSelectConversation('all')）
    const sameHeader = screen.getByTestId("project-card-header-same");
    await user.click(sameHeader);
    // 折叠展开后能看到「全部对话」row
    const sameAllRow = await screen.findByTestId("conversation-row-all-same");
    await user.click(sameAllRow);

    // active 切到 same 后：same card 上 data-active="true"，commercial
    // 失活；项目名继续在 sidebar 可见。
    expect(screen.getByTestId("project-card-same")).toHaveAttribute(
      "data-active",
      "true"
    );
    expect(screen.getByTestId("project-card-commercial")).toHaveAttribute(
      "data-active",
      "false"
    );

    // 切回 commercial：点 commercial 卡的「全部对话」row
    // （commercial 默认就展开，因为它是 active 之后被切走的；user toggle
    // 优先策略下它仍展开 —— 但保险起见先确保展开）
    const commercialCard = screen.getByTestId("project-card-commercial");
    if (commercialCard.getAttribute("data-collapsed") === "true") {
      await user.click(screen.getByTestId("project-card-header-commercial"));
    }
    await user.click(
      screen.getByTestId("conversation-row-all-commercial")
    );
    expect(screen.getByTestId("project-card-commercial")).toHaveAttribute(
      "data-active",
      "true"
    );

    await user.type(
      screen.getByRole("textbox", { name: "Prompt" }),
      "Switchable conversation prompt."
    );
    await user.click(screen.getByRole("button", { name: /生成图片/ }));

    expect(
      (await screen.findAllByText("asset_switchable_123")).length
    ).toBeGreaterThan(0);
    const branchConversation = await screen.findByRole("button", {
      // 新副标题文案：「{branchLabel} · {count} 个节点 · {time}」
      name: /主线.*1 个节点/
    });
    await user.click(branchConversation);

    expect(branchConversation).toHaveAttribute("aria-pressed", "true");

    // 「全部对话」row 现在每张卡一份；用 scoped testid 取 commercial 的
    const commercialAllRow = screen.getByTestId(
      "conversation-row-all-commercial"
    );
    await user.click(commercialAllRow);

    expect(commercialAllRow).toHaveAttribute("aria-pressed", "true");
  });

  it("forks a session into the same project via 分叉到同一工作树", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        generationResponse({
          taskId: "task_fork_1",
          assetId: "asset_fork_1",
          requestId: "psypic_req_fork_1"
        })
      )
      .mockResolvedValueOnce(
        taskResponse({
          taskId: "task_fork_1",
          status: "succeeded",
          requestId: "psypic_req_task_fork_1"
        })
      );
    vi.stubGlobal("fetch", fetchSpy);

    render(<CreatorWorkspace />);
    const user = userEvent.setup();

    // 先生成一条 session 作为 fork 的源（commercial 项目）
    await user.type(
      screen.getByRole("textbox", { name: "Prompt" }),
      "Original session prompt."
    );
    await user.click(screen.getByRole("button", { name: /生成图片/ }));
    expect((await screen.findAllByText("asset_fork_1")).length).toBeGreaterThan(0);

    // 此时 commercial 卡下有一条 branch session row；通过 dropdown 菜单
    // 触发 fork-same
    const kebabs = await screen.findAllByTestId("session-row-menu-button");
    await user.click(kebabs[0]);
    await user.click(await screen.findByTestId("session-menu-fork-same"));

    // 验证：ChatHeader / VersionStream 显示「分叉中 / 分叉生成中」pill
    expect(screen.getAllByText(/分叉/).length).toBeGreaterThan(0);

    // Sidebar toast：「已分叉...」
    const region = await screen.findByTestId("sidebar-toast-region");
    expect(
      within(region).getByText(/已分叉.*Composer/)
    ).toBeInTheDocument();
  });

  it("derives a session into a new project via 派生到新工作树", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        generationResponse({
          taskId: "task_derive_1",
          assetId: "asset_derive_1",
          requestId: "psypic_req_derive_1"
        })
      )
      .mockResolvedValueOnce(
        taskResponse({
          taskId: "task_derive_1",
          status: "succeeded",
          requestId: "psypic_req_task_derive_1"
        })
      );
    vi.stubGlobal("fetch", fetchSpy);

    render(<CreatorWorkspace />);
    const user = userEvent.setup();

    // 生成一条 session 作为 derive 的源
    await user.type(
      screen.getByRole("textbox", { name: "Prompt" }),
      "Source for derive."
    );
    await user.click(screen.getByRole("button", { name: /生成图片/ }));
    expect((await screen.findAllByText("asset_derive_1")).length).toBeGreaterThan(0);

    // 打开菜单 → 点「派生到新工作树」
    const kebabs = await screen.findAllByTestId("session-row-menu-button");
    await user.click(kebabs[0]);
    await user.click(await screen.findByTestId("session-menu-fork-new"));

    // jsdom 无 IndexedDB，createProject 返回 null 走 fallback 分支：
    // - 仍清掉 forkParentId（不留分叉上下文）
    // - 切 activeConversationId="new"
    // - 填回 latestNode 的 prompt → Composer textarea value
    // - toast「已派生到新项目...」
    const region = await screen.findByTestId("sidebar-toast-region");
    expect(
      within(region).getByText(/已派生到新项目/)
    ).toBeInTheDocument();

    // Composer textarea 已回填源 prompt
    expect(
      screen.getByRole("textbox", { name: "Prompt" })
    ).toHaveValue("Source for derive.");
  });

  it("loads server library assets and toggles favorite metadata", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        libraryResponse({
          assetId: "asset_library_123",
          taskId: "task_library_123",
          favorite: false,
          tags: ["电商主图"]
        })
      )
      .mockResolvedValueOnce(
        libraryPatchResponse({
          assetId: "asset_library_123",
          taskId: "task_library_123",
          favorite: true,
          tags: ["电商主图"]
        })
      );
    vi.stubGlobal("fetch", fetchSpy);

    render(<CreatorWorkspace />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "同步素材库" }));

    expect(
      (await screen.findAllByText("asset_library_123")).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("电商主图").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("link", { name: "详情" })).toHaveAttribute(
      "href",
      "/library/asset_library_123"
    );

    await user.click(screen.getByRole("button", { name: "收藏素材" }));

    expect(await screen.findByRole("button", { name: "取消收藏" })).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenNthCalledWith(1, "/api/library?limit=30", {
      method: "GET"
    });
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      "/api/library/asset_library_123",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          favorite: true,
          tags: ["电商主图"]
        })
      })
    );
  });

  it("publishes a server library asset to the community with privacy defaults", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        libraryResponse({
          assetId: "asset_publish_123",
          taskId: "task_publish_123",
          favorite: false,
          tags: ["电商主图"]
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              work_id: "work_publish_123",
              task_id: "task_publish_123",
              asset_id: "asset_publish_123",
              visibility: "unlisted",
              title: "社区展示作品"
            },
            request_id: "psypic_req_publish_123"
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchSpy);

    render(<CreatorWorkspace />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "同步素材库" }));
    expect(
      (await screen.findAllByText("asset_publish_123")).length
    ).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "发布作品" }));
    await user.clear(screen.getByLabelText("作品标题"));
    await user.type(screen.getByLabelText("作品标题"), "社区展示作品");
    await user.click(screen.getByLabelText("可见性"));
    await user.click(screen.getByRole("option", { name: "链接可见" }));
    await user.click(screen.getByRole("button", { name: "确认发布" }));

    expect(await screen.findByText(/已发布：work_publish_123/)).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      "/api/community/works",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          task_id: "task_publish_123",
          asset_id: "asset_publish_123",
          visibility: "unlisted",
          title: "社区展示作品",
          scene: "general",
          tags: ["电商主图"],
          disclose_prompt: false,
          disclose_params: false,
          disclose_reference_images: false,
          allow_same_generation: true,
          allow_reference_reuse: false,
          public_confirmed: false
        })
      })
    );
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
    // 切换到广告 Banner 尺寸 —— quickpick-size-trigger 打开 dropdown 后选项
    // （plan slug quiet-glittering-prism · Cut 14：商业尺寸已移到 QuickPickRow）
    await user.click(screen.getByTestId("quickpick-size-trigger"));
    await user.click(screen.getByTestId("quickpick-size-ad_banner_wide"));
    await user.type(
      screen.getByRole("textbox", { name: "Prompt" }),
      "Create a premium product photo."
    );
    await user.click(screen.getByRole("button", { name: /生成图片/ }));

    expect((await screen.findAllByText("asset_123")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("psypic_req_123").length).toBeGreaterThanOrEqual(
      1
    );
    expect(screen.getAllByText(/30 tokens/).length).toBeGreaterThanOrEqual(1);
    expect(
      screen
        .getAllByRole("link", { name: "下载" })
        .some((link) => link.getAttribute("href") === "/api/assets/asset_123")
    ).toBe(true);
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
    // 先输入 prompt 再开 drawer —— 否则 Sheet portal 会 inert main content
    // 让 prompt textbox 暂时不可访问（plan slug quiet-glittering-prism · Cut 14）
    await user.type(
      screen.getByRole("textbox", { name: "Prompt" }),
      "Create a premium product photo."
    );
    // 启用流式预览 —— 在 AdvancedParamsDrawer 内
    await user.click(screen.getByTestId("quickpick-advanced-trigger"));
    await user.click(
      await screen.findByTestId("advanced-stream-checkbox")
    );
    await user.click(screen.getByTestId("advanced-close"));
    await user.click(screen.getByRole("button", { name: /生成图片/ }));

    expect(
      (await screen.findAllByText("asset_partial_123")).length
    ).toBeGreaterThan(0);
    expect(
      (await screen.findAllByText("asset_stream_final_123")).length
    ).toBeGreaterThan(0);
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
    // 模板入口现在是 Composer 顶部 quickpick-template-trigger（plan slug
    // quiet-glittering-prism · Cut 14）—— 点开 TemplatePickerDialog 选模板
    await user.click(screen.getByTestId("quickpick-template-trigger"));
    await user.click(await screen.findByTestId("template-card-tpl_social_cover"));
    await user.click(screen.getByRole("button", { name: /生成图片/ }));

    const requestBody = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(requestBody.size).toBe("1024x1536");
    expect(requestBody.prompt).toContain("Create a social media cover image");
    expect(requestBody.prompt).toContain("AI 生图社区");
  });

  it("applies a commercial template to the prompt with default field values (plan slug quiet-glittering-prism · Cut 14)", async () => {
    render(<CreatorWorkspace />);

    const user = userEvent.setup();
    // 新 IA：点 quickpick-template-trigger → TemplatePickerDialog → 点模板卡。
    // 选中即 apply 默认字段值（不再有「应用模板」中间步骤），随后用户可在
    // prompt 输入框直接微调全文。
    await user.click(screen.getByTestId("quickpick-template-trigger"));
    await user.click(await screen.findByTestId("template-card-tpl_ad_banner"));

    const promptBox = screen.getByRole("textbox", {
      name: "Prompt"
    }) as HTMLTextAreaElement;

    // 模板的 promptTemplate 渲染后包含核心关键词
    expect(promptBox.value).toContain(
      "Create a commercial advertising banner visual"
    );
    // 默认字段值（campaign_theme = "新品上市"）也被渲染
    expect(promptBox.value).toContain("新品上市");
  });

  it("optimizes a Chinese prompt from the creator workspace", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              optimized_prompt:
                "Create a high-quality commercial image.\n\nSubject: AI 生图社区小红书封面。\nConstraints: Avoid fake typography.",
              sections: ["Scene", "Subject", "Constraints", "Output"],
              preservation_notes: []
            },
            request_id: "psypic_req_prompt_assist"
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );

    render(<CreatorWorkspace />);
    await screen.findByTestId("board-stage");

    const user = userEvent.setup();
    await user.type(
      screen.getByRole("textbox", { name: "Prompt" }),
      "AI 生图社区小红书封面"
    );
    await user.click(screen.getByRole("button", { name: "优化 Prompt" }));

    const promptBox = (await screen.findByRole("textbox", {
      name: "Prompt"
    })) as HTMLTextAreaElement;

    expect(promptBox.value).toContain("Create a high-quality commercial image.");
  });

  it("saves and reapplies a prompt favorite", async () => {
    render(<CreatorWorkspace />);

    const user = userEvent.setup();
    const promptBox = screen.getByRole("textbox", {
      name: "Prompt"
    }) as HTMLTextAreaElement;

    await user.type(promptBox, "Create a premium perfume product photo.");
    await user.click(screen.getByRole("button", { name: "收藏 Prompt" }));

    expect(
      (await screen.findAllByText("Create a premium perfume product photo."))
        .length
    ).toBeGreaterThan(1);

    await user.clear(promptBox);
    await user.click(screen.getByRole("button", { name: "套用 Prompt" }));

    expect(promptBox.value).toBe("Create a premium perfume product photo.");
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

    expect(
      (await screen.findAllByText("asset_edit_123")).length
    ).toBeGreaterThan(0);
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
    expect(body.has("board_document_id")).toBe(false);
    expect(body.has("board_export_asset_id")).toBe(false);
    expect(body.has("board_snapshot")).toBe(false);
    expect(screen.getByText("product.png")).toBeInTheDocument();
  });

  it("submits image-to-image requests with multiple selected reference images", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            task_id: "task_multi_ref_123",
            images: [
              {
                asset_id: "asset_multi_ref_123",
                url: "/api/assets/asset_multi_ref_123",
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
          request_id: "psypic_req_multi_ref_123"
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchSpy);

    render(<CreatorWorkspace />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "图生图" }));
    const first = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      "front.png",
      { type: "image/png" }
    );
    const second = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      "side.png",
      { type: "image/png" }
    );
    await user.upload(screen.getByLabelText("参考图"), [first, second]);
    await user.type(
      screen.getByRole("textbox", { name: "Prompt" }),
      "Keep all reference angles consistent."
    );
    await user.click(screen.getByRole("button", { name: /生成图片/ }));

    expect(
      (await screen.findAllByText("asset_multi_ref_123")).length
    ).toBeGreaterThan(0);
    const body = fetchSpy.mock.calls[0][1].body as FormData;
    expect(body.getAll("image")).toEqual([first, second]);
    expect(screen.getByText("front.png")).toBeInTheDocument();
    expect(screen.getByText("side.png")).toBeInTheDocument();
  });

  it("submits image-to-image requests with a generated PNG mask", async () => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    const canvasContext = {
      beginPath: vi.fn(),
      arc: vi.fn(),
      clearRect: vi.fn(),
      fill: vi.fn(),
      fillRect: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(16) })),
      putImageData: vi.fn(),
      fillStyle: "",
      globalCompositeOperation: "source-over"
    };
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: () => canvasContext
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
      configurable: true,
      value(callback: BlobCallback) {
        callback(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], {
          type: "image/png"
        }));
      }
    });
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            task_id: "task_mask_123",
            images: [
              {
                asset_id: "asset_mask_123",
                url: "/api/assets/asset_mask_123",
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
          request_id: "psypic_req_mask_123"
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchSpy);

    try {
      render(<CreatorWorkspace />);

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "图生图" }));
      const reference = new File(
        [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
        "product.png",
        { type: "image/png" }
      );
      await user.upload(screen.getByLabelText("参考图"), reference);
      await user.click(screen.getByRole("checkbox", { name: "遮罩编辑" }));
      expect(screen.getByLabelText("遮罩画布")).toBeInTheDocument();
      await user.type(
        screen.getByRole("textbox", { name: "Prompt" }),
        "Replace only the brushed area."
      );
      await user.click(screen.getByRole("button", { name: /生成图片/ }));

      expect(
        (await screen.findAllByText("asset_mask_123")).length
      ).toBeGreaterThan(0);
      const body = fetchSpy.mock.calls[0][1].body as FormData;
      expect(body.get("image")).toBe(reference);
      expect(body.get("mask")).toBeInstanceOf(File);
      expect((body.get("mask") as File).type).toBe("image/png");
    } finally {
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        configurable: true,
        value: originalGetContext
      });
      Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
        configurable: true,
        value: originalToBlob
      });
    }
  });

  it("selects the mask local edit template and enables mask editing", async () => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: () => ({
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        fillStyle: "",
        globalCompositeOperation: "source-over"
      })
    });

    try {
      render(<CreatorWorkspace />);

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "图生图" }));
      await user.upload(
        screen.getByLabelText("参考图"),
        new File(
          [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
          "product.png",
          { type: "image/png" }
        )
      );
      // 模板入口已上提到 Composer 的 + 模板 chip，点 trigger 打开
      // TemplatePickerDialog 后再点局部编辑卡（plan slug
      // quiet-glittering-prism · Cut 14）。
      await user.click(screen.getByTestId("quickpick-template-trigger"));
      await user.click(
        await screen.findByTestId("template-card-tpl_mask_local_edit")
      );

      expect(screen.getByRole("checkbox", { name: "遮罩编辑" })).toBeChecked();
      expect(
        (screen.getByRole("textbox", { name: "Prompt" }) as HTMLTextAreaElement)
          .value
      ).toContain("Edit only the masked area");
    } finally {
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        configurable: true,
        value: originalGetContext
      });
    }
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

  it("loads a library reference asset from the URL query", async () => {
    window.history.pushState({}, "", "/?reference_asset=asset_query_123");
    const imageBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
    ]);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          libraryPatchResponse({
            assetId: "asset_query_123",
            taskId: "task_query_123",
            favorite: false,
            tags: []
          })
        )
        .mockResolvedValueOnce(
          new Response(imageBytes, {
            status: 200,
            headers: { "content-type": "image/png" }
          })
        )
    );

    try {
      render(<CreatorWorkspace />);

      expect(await screen.findByText("asset_query_123.png")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "图生图" })).toHaveClass("active");
    } finally {
      window.history.pushState({}, "", "/");
    }
  });

  it("loads a same-generation draft from the URL query", async () => {
    window.history.pushState({}, "", "/?same_work=work_same_query_123");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              draft: {
                prompt: "按社区作品生成同款商业图片。",
                params: {
                  prompt: "",
                  model: "gpt-image-2",
                  size: "1536x1024",
                  quality: "medium",
                  n: 1,
                  output_format: "png",
                  output_compression: null,
                  background: "auto",
                  moderation: "auto"
                }
              }
            },
            request_id: "psypic_req_same_query"
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );

    try {
      render(<CreatorWorkspace />);
      const promptBox = (await screen.findByRole("textbox", {
        name: "Prompt"
      })) as HTMLTextAreaElement;

      expect(promptBox.value).toBe("按社区作品生成同款商业图片。");
      expect(fetch).toHaveBeenCalledWith(
        "/api/community/works/work_same_query_123/same",
        { method: "POST" }
      );
      // size 显示位置改成 quickpick-size-trigger（plan slug
      // quiet-glittering-prism · Cut 14）。trigger 显示业务标签 + 比例，
      // 不含原始 size 字符串；用 aspect 标签 "横版 16:9" 断言覆盖正确性。
      expect(screen.getByTestId("quickpick-size-trigger")).toHaveTextContent(
        "横版 16:9"
      );
    } finally {
      window.history.pushState({}, "", "/");
    }
  });

  it("continues editing from a local history result", async () => {
    const createObjectUrl = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:history-reference");
    const revokeObjectUrl = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
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
    // Composer 缩略图条 + Inspector ReferenceSection 都会渲染同一张参考图
    // （plan slug calm-squishing-globe · Cut 3 起 Composer 也展示缩略图）—— 用
    // getAllByRole 取所有匹配并验证全部 src 一致
    const referenceImgs = screen.getAllByRole("img", {
      name: "参考图 asset_history_123.png"
    });
    expect(referenceImgs.length).toBeGreaterThanOrEqual(1);
    referenceImgs.forEach((img) =>
      expect(img).toHaveAttribute("src", "blob:history-reference")
    );
    expect(createObjectUrl).toHaveBeenCalledWith(expect.any(File));
    createObjectUrl.mockRestore();
    revokeObjectUrl.mockRestore();
  });

  it("does not treat a failed history image fetch as a reference image", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                task_id: "task_history_missing",
                images: [
                  {
                    asset_id: "asset_history_missing",
                    url: "/api/assets/asset_history_missing",
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
              request_id: "psypic_req_history_missing"
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        )
        .mockResolvedValueOnce(
          taskResponse({
            taskId: "task_history_missing",
            status: "succeeded",
            requestId: "psypic_req_task_history_missing"
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: { code: "not_found" } }), {
            status: 404,
            headers: { "content-type": "application/json" }
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

    expect(await screen.findByText("无法读取历史结果作为参考图。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "文生图" })).toHaveClass("active");
    expect(screen.queryByText("asset_history_missing.png")).not.toBeInTheDocument();
  });

  it("shows a version stream and restores params from a previous node", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          generationResponse({
            taskId: "task_version_a",
            assetId: "asset_version_a",
            requestId: "psypic_req_version_a"
          })
        )
        .mockResolvedValueOnce(
          taskResponse({
            taskId: "task_version_a",
            status: "succeeded",
            requestId: "psypic_req_task_version_a"
          })
        )
        .mockResolvedValueOnce(
          generationResponse({
            taskId: "task_version_b",
            assetId: "asset_version_b",
            requestId: "psypic_req_version_b"
          })
        )
        .mockResolvedValueOnce(
          taskResponse({
            taskId: "task_version_b",
            status: "succeeded",
            requestId: "psypic_req_task_version_b"
          })
        )
    );

    render(<CreatorWorkspace />);

    const user = userEvent.setup();
    const promptBox = screen.getByRole("textbox", { name: "Prompt" });
    await user.type(promptBox, "Create a square hero product photo.");
    await user.click(screen.getByRole("button", { name: /生成图片/ }));

    expect(await screen.findByTestId("version-stream")).toBeInTheDocument();
    expect(
      screen.getAllByText("Create a square hero product photo.").length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("1024x1024 · medium · 1 张 · png").length
    ).toBeGreaterThan(0);

    await user.click(screen.getByTestId("quickpick-template-trigger"));
    await user.click(await screen.findByTestId("template-card-tpl_ad_banner"));
    expect(screen.getByTestId("quickpick-size-trigger")).toHaveTextContent(
      "横版 16:9"
    );
    await user.clear(promptBox);
    await user.type(promptBox, "Create a wide banner product photo.");
    await user.click(screen.getByRole("button", { name: /生成图片/ }));

    expect(
      (await screen.findAllByText("Create a wide banner product photo.")).length
    ).toBeGreaterThan(0);
    await user.click(
      screen.getByRole("button", {
        name: "恢复参数 Create a square hero product photo."
      })
    );

    expect((promptBox as HTMLTextAreaElement).value).toBe(
      "Create a square hero product photo."
    );
    expect(screen.getByTestId("quickpick-size-trigger")).toHaveTextContent(
      "方图 1:1"
    );
  }, LONG_CREATOR_FLOW_TIMEOUT_MS);

  it("creates a non-destructive branch from an older version", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          generationResponse({
            taskId: "task_branch_a",
            assetId: "asset_branch_a",
            requestId: "psypic_req_branch_a"
          })
        )
        .mockResolvedValueOnce(
          taskResponse({
            taskId: "task_branch_a",
            status: "succeeded",
            requestId: "psypic_req_task_branch_a"
          })
        )
        .mockResolvedValueOnce(
          generationResponse({
            taskId: "task_branch_b",
            assetId: "asset_branch_b",
            requestId: "psypic_req_branch_b"
          })
        )
        .mockResolvedValueOnce(
          taskResponse({
            taskId: "task_branch_b",
            status: "succeeded",
            requestId: "psypic_req_task_branch_b"
          })
        )
        .mockResolvedValueOnce(
          generationResponse({
            taskId: "task_branch_c",
            assetId: "asset_branch_c",
            requestId: "psypic_req_branch_c"
          })
        )
        .mockResolvedValueOnce(
          taskResponse({
            taskId: "task_branch_c",
            status: "succeeded",
            requestId: "psypic_req_task_branch_c"
          })
        )
    );

    render(<CreatorWorkspace />);

    const user = userEvent.setup();
    const promptBox = screen.getByRole("textbox", { name: "Prompt" });
    await user.type(promptBox, "Root commercial concept.");
    await user.click(screen.getByRole("button", { name: /生成图片/ }));
    expect(await screen.findByTestId("version-stream")).toBeInTheDocument();
    expect(screen.getAllByText("Root commercial concept.").length).toBeGreaterThan(0);

    await user.clear(promptBox);
    await user.type(promptBox, "Mainline refinement.");
    await user.click(screen.getByRole("button", { name: /生成图片/ }));
    expect(
      (await screen.findAllByText("Mainline refinement.")).length
    ).toBeGreaterThan(0);

    await user.click(
      screen.getByRole("button", { name: "从此分叉 Root commercial concept." })
    );
    await user.clear(promptBox);
    await user.type(promptBox, "Alternative branch concept.");
    await user.click(screen.getByRole("button", { name: /生成图片/ }));

    expect(
      (await screen.findAllByText("Alternative branch concept.")).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Mainline refinement.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("分支 2").length).toBeGreaterThan(0);
    expect(screen.getByTestId("branch-map")).toBeInTheDocument();
  }, LONG_CREATOR_FLOW_TIMEOUT_MS);

  it("shows login path when not authenticated", async () => {
    // mock useSession locally
    vi.mocked(useSession).mockReturnValue({
      state: { status: "loaded", data: { authenticated: false, binding: null, user: null, limits: null, features: null } },
      refreshSession: vi.fn()
    });

    render(<CreatorWorkspace />);
    // The chat empty state should show login prompt
    expect(screen.getAllByText(/未登录/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /登录/ }).length).toBeGreaterThan(0);
  });

  it("shows manual key path when authenticated but unbound", async () => {
    vi.mocked(useSession).mockReturnValue({
      state: { status: "loaded", data: { authenticated: true, binding: null, user: null, limits: null, features: null } },
      refreshSession: vi.fn()
    });

    render(<CreatorWorkspace />);
    expect(screen.getByText(/缺少 API Key/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "前往设置" })).toBeInTheDocument();
  });

  it("shows offline fallback notice when in fallback mode", async () => {
    // reset session mock to authenticated and bound
    vi.mocked(useSession).mockReturnValue({
      state: {
        status: "loaded",
        data: {
          authenticated: true,
          user: { id: "user-1", email: "test@example.com", display_name: "Test User", role: "user", last_login_at: "2026-05-11T00:00:00Z" },
          binding: { id: "binding-1", base_url: "https://api.openai.com", default_model: "gpt-4", enabled_models: ["gpt-4"] },
          limits: null,
          features: null
        }
      },
      refreshSession: vi.fn()
    });
    
    // mock useWorkbench to return fallback
    vi.mocked(useWorkbench).mockReturnValue({
      mode: "fallback",
      serverProjects: [],
      rawServerProjects: [],
      retryAfter: new Date().toISOString(),
      createProject: vi.fn(),
      renameProject: vi.fn(),
      deleteProject: vi.fn(),
      refresh: vi.fn(),
      syncState: { status: "offline", pendingCount: 0, conflicts: [], lastSyncTime: null, retryAfter: null },
      flushSync: vi.fn(),
      dismissSyncConflict: vi.fn()
    });

    // default session mock is authenticated
    render(<CreatorWorkspace />);
    expect(screen.getByText(/本地离线模式：云端同步不可用/i)).toBeInTheDocument();
    expect(screen.getByText(/\(请稍后重试\)/i)).toBeInTheDocument();
  });
});

function createDataTransferStub(): DataTransfer {
  // Cut 4.3：复用 board-mode.test.tsx 的 stub 形态。jsdom 没有完整
  // DataTransfer，最小集合够覆盖 readLibraryAssetDragData 的解析路径。
  const store = new Map<string, string>();
  return {
    get types() {
      return Array.from(store.keys());
    },
    setData(type: string, value: string) {
      store.set(type, value);
    },
    getData(type: string) {
      return store.get(type) ?? "";
    },
    clearData() {
      store.clear();
    },
    effectAllowed: "uninitialized",
    dropEffect: "none"
  } as unknown as DataTransfer;
}

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

function libraryResponse(input: {
  assetId: string;
  taskId: string;
  favorite: boolean;
  tags: string[];
}) {
  return new Response(
    JSON.stringify({
      data: {
        items: [
          {
            asset_id: input.assetId,
            task_id: input.taskId,
            type: "generation",
            prompt: "Create a premium library product photo.",
            params: {
              prompt: "Create a premium library product photo.",
              model: "gpt-image-2",
              size: "1024x1024",
              quality: "medium",
              n: 1,
              output_format: "png",
              output_compression: null,
              background: "auto",
              moderation: "auto"
            },
            url: `/api/assets/${input.assetId}`,
            thumbnail_url: `/api/assets/${input.assetId}`,
            format: "png",
            usage: {
              input_tokens: 10,
              output_tokens: 20,
              total_tokens: 30,
              estimated_cost: "0.0000"
            },
            duration_ms: 1200,
            created_at: "2026-05-01T00:00:00.000Z",
            favorite: input.favorite,
            tags: input.tags
          }
        ],
        next_cursor: null
      },
      request_id: "psypic_req_library_123"
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

function libraryPatchResponse(input: {
  assetId: string;
  taskId: string;
  favorite: boolean;
  tags: string[];
}) {
  return new Response(
    JSON.stringify({
      data: {
        asset_id: input.assetId,
        task_id: input.taskId,
        type: "generation",
        prompt: "Create a premium library product photo.",
        params: {
          prompt: "Create a premium library product photo.",
          model: "gpt-image-2",
          size: "1024x1024",
          quality: "medium",
          n: 1,
          output_format: "png",
          output_compression: null,
          background: "auto",
          moderation: "auto"
        },
        url: `/api/assets/${input.assetId}`,
        thumbnail_url: `/api/assets/${input.assetId}`,
        format: "png",
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          estimated_cost: "0.0000"
        },
        duration_ms: 1200,
        created_at: "2026-05-01T00:00:00.000Z",
        favorite: input.favorite,
        tags: input.tags
      },
      request_id: "psypic_req_library_patch_123"
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

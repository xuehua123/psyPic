import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import Composer from "@/components/creator/studio/Composer";
import {
  CreatorStudioProvider,
  type CreatorStudioContextValue
} from "@/components/creator/studio/CreatorStudioContext";

/**
 * Composer prompt input upgrade（plan slug calm-squishing-globe · Cut 5）：
 * 集成测试覆盖 Cut 1-4 的 UI 行为。
 *
 * - mock CreatorStudioProvider，只填 Composer 实际消费的 ~20 字段（其余
 *   noop / fixture），不依赖 CreatorWorkspace 的真实 selectReferenceImages
 *   wiring。`selectReferenceImages` 的"追加 + 8 张 + 自动切 mode"逻辑由
 *   CreatorWorkspace 持有，端到端验证留给 e2e；本文件聚焦 Composer 表
 *   现层。
 */

function noop() {}
async function asyncNoop() {}

type ProviderOverrides = Partial<CreatorStudioContextValue>;

function MockProvider({
  children,
  overrides
}: {
  children: ReactNode;
  overrides?: ProviderOverrides;
}) {
  const [prompt, setPrompt] = useState("");
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const value: CreatorStudioContextValue = {
    activeNodeId: null,
    returnToVersionNode: noop,
    restoreVersionNodeParams: noop,
    startVersionFork: noop,

    submitGeneration: asyncNoop,
    copyPrompt: asyncNoop,
    handleResultAsReference: asyncNoop,

    prompt,
    setPrompt,
    mode: "text",
    size: "1024x1024",
    quality: "medium",
    outputFormat: "png",
    n: 1,
    streamEnabled: false,
    forkParentId: null,
    errorMessage: "",
    isAssistingPrompt: false,
    isGenerating: false,
    optimizePrompt: asyncNoop,
    saveCurrentPromptFavorite: asyncNoop,

    setMode: noop,
    setSize: noop,
    setQuality: noop,
    setOutputFormat: noop,
    setN: noop,
    setStreamEnabled: noop,
    partialImageCount: 0,
    setPartialImageCount: noop,
    advancedOpen: false,
    setAdvancedOpen: noop,
    outputCompression: "",
    setOutputCompression: noop,
    moderation: "auto",
    setModeration: noop,
    background: "auto",
    setBackground: noop,
    inputFidelity: "low",
    setInputFidelity: noop,
    style: "photography",
    setStyle: noop,
    selectedCommercialSizeId: "",
    selectCommercialSize: noop,

    referenceImages: [],
    referencePreviews: [],
    referenceImage: null,
    handleReferenceInput: noop,
    handleReferenceDrop: noop,
    handleReferencePaste: noop,
    removeReferenceImage: noop,
    maskEnabled: false,
    setMaskEnabled: noop,
    maskMode: "paint",
    setMaskMode: noop,
    maskBrushSize: 24,
    setMaskBrushSize: noop,
    maskCanvasRef,
    resetMaskCanvas: noop,
    invertMaskCanvas: noop,
    startMaskStroke: noop,
    continueMaskStroke: noop,
    stopMaskStroke: noop,

    mvpTemplates: [],
    selectedTemplate: undefined,
    templateFieldValues: {},
    updateTemplateFieldValue: noop,
    selectCommercialTemplate: noop,
    applySelectedTemplate: noop,

    libraryItems: [],
    libraryStatus: "idle",
    libraryFavoriteOnly: false,
    setLibraryFavoriteOnly: noop,
    libraryTagFilter: "",
    setLibraryTagFilter: noop,
    promptFavorites: [],
    historyItems: [],
    publishAssetId: null,
    setPublishAssetId: noop,
    publishingAssetId: null,
    publishMessages: {},
    loadServerLibrary: asyncNoop,
    applyPromptFavorite: noop,
    handleLibraryContinueEdit: asyncNoop,
    toggleLibraryFavorite: asyncNoop,
    publishLibraryItem: asyncNoop,
    handleHistoryContinueEdit: asyncNoop,
    defaultCommunityTitle: () => "",

    ...overrides
  };
  return <CreatorStudioProvider value={value}>{children}</CreatorStudioProvider>;
}

function makeFile(name: string): File {
  return new File(["fake"], name, { type: "image/png" });
}

function makeReferenceImages(count: number): File[] {
  return Array.from({ length: count }, (_, i) => makeFile(`ref-${i}.png`));
}

function makePreviews(count: number): { name: string; url: string }[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `ref-${i}.png`,
    url: `blob:fake-${i}`
  }));
}

describe("Composer prompt input upgrade", () => {
  it("缩略图条只在 referenceImages.length > 0 时渲染", () => {
    const { rerender } = render(
      <MockProvider>
        <Composer />
      </MockProvider>
    );
    expect(
      screen.queryByTestId("composer-reference-row")
    ).not.toBeInTheDocument();

    rerender(
      <MockProvider
        overrides={{
          referenceImages: makeReferenceImages(2),
          referencePreviews: makePreviews(2),
          referenceImage: makeFile("ref-0.png")
        }}
      >
        <Composer />
      </MockProvider>
    );
    const row = screen.getByTestId("composer-reference-row");
    expect(row).toBeInTheDocument();
    expect(within(row).getAllByRole("img")).toHaveLength(2);
  });

  it("「再添加」按钮在 < 8 张时显示，到达 8 张时隐藏", () => {
    const { rerender } = render(
      <MockProvider
        overrides={{
          referenceImages: makeReferenceImages(7),
          referencePreviews: makePreviews(7),
          referenceImage: makeFile("ref-0.png")
        }}
      >
        <Composer />
      </MockProvider>
    );
    expect(screen.getByTestId("composer-reference-add")).toBeInTheDocument();

    rerender(
      <MockProvider
        overrides={{
          referenceImages: makeReferenceImages(8),
          referencePreviews: makePreviews(8),
          referenceImage: makeFile("ref-0.png")
        }}
      >
        <Composer />
      </MockProvider>
    );
    expect(
      screen.queryByTestId("composer-reference-add")
    ).not.toBeInTheDocument();
  });

  it("点单张 X 触发 removeReferenceImage(index)", async () => {
    const removeReferenceImage = vi.fn();
    const user = userEvent.setup();
    render(
      <MockProvider
        overrides={{
          referenceImages: makeReferenceImages(3),
          referencePreviews: makePreviews(3),
          referenceImage: makeFile("ref-0.png"),
          removeReferenceImage
        }}
      >
        <Composer />
      </MockProvider>
    );
    await user.click(
      screen.getByRole("button", { name: "移除参考图 ref-1.png" })
    );
    expect(removeReferenceImage).toHaveBeenCalledWith(1);
  });

  it("Composer 容器拖图触发 handleReferenceDrop（aria-label 描述拖入数）", () => {
    const handleReferenceDrop = vi.fn();
    render(
      <MockProvider overrides={{ handleReferenceDrop }}>
        <Composer />
      </MockProvider>
    );
    const composer = screen.getByTestId("prompt-composer");
    // jsdom DragEvent 不支持完整 dataTransfer 接口；用直接派发 drop 事件验证 wiring
    const dropEvent = new Event("drop", { bubbles: true, cancelable: true });
    composer.dispatchEvent(dropEvent);
    expect(handleReferenceDrop).toHaveBeenCalledTimes(1);
  });

  it("Composer 顶部渲染 QuickPickRow（plan slug quiet-glittering-prism · Cut 10）", () => {
    render(
      <MockProvider
        overrides={{
          mode: "image",
          referenceImages: makeReferenceImages(1),
          referencePreviews: makePreviews(1),
          referenceImage: makeFile("ref-0.png")
        }}
      >
        <Composer />
      </MockProvider>
    );
    expect(screen.getByTestId("quickpick-row")).toBeInTheDocument();
    expect(
      screen.getByTestId("quickpick-template-trigger")
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("quickpick-advanced-trigger")
    ).toBeInTheDocument();
  });

  it("点「展开编辑器」按钮打开 PromptExpandedDialog", async () => {
    const user = userEvent.setup();
    render(
      <MockProvider>
        <Composer />
      </MockProvider>
    );
    expect(
      screen.queryByTestId("prompt-expanded-dialog")
    ).not.toBeInTheDocument();
    await user.click(screen.getByTestId("composer-expand-trigger"));
    expect(
      await screen.findByTestId("prompt-expanded-dialog")
    ).toBeInTheDocument();
    // Dialog 内的 textarea 用 testid 唯一定位（避免和 Composer textarea 撞 role）
    expect(
      screen.getByTestId("prompt-expanded-textarea")
    ).toBeInTheDocument();
  });

  it("Modal 编辑后保存写回 prompt", async () => {
    const user = userEvent.setup();
    render(
      <MockProvider>
        <Composer />
      </MockProvider>
    );
    await user.click(screen.getByTestId("composer-expand-trigger"));
    const dialogTextarea = await screen.findByTestId(
      "prompt-expanded-textarea"
    );
    await user.type(dialogTextarea, "long商业 prompt");
    await user.click(screen.getByTestId("prompt-expanded-submit"));
    // Modal 关闭
    expect(
      screen.queryByTestId("prompt-expanded-dialog")
    ).not.toBeInTheDocument();
    // Composer textarea 接管 prompt state，反映新值
    expect(screen.getByRole("textbox", { name: "Prompt" })).toHaveValue(
      "long商业 prompt"
    );
  });

  it("Modal 编辑后取消不写回 prompt", async () => {
    const user = userEvent.setup();
    render(
      <MockProvider>
        <Composer />
      </MockProvider>
    );
    // 先在 Composer textarea 输入初始值
    await user.type(
      screen.getByRole("textbox", { name: "Prompt" }),
      "初始值"
    );

    await user.click(screen.getByTestId("composer-expand-trigger"));
    const dialogTextarea = await screen.findByTestId(
      "prompt-expanded-textarea"
    );
    await user.clear(dialogTextarea);
    await user.type(dialogTextarea, "改了但不保存");
    await user.click(screen.getByRole("button", { name: "取消" }));

    expect(
      screen.queryByTestId("prompt-expanded-dialog")
    ).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Prompt" })).toHaveValue(
      "初始值"
    );
  });

  it("「添加图」按钮始终可见（即使 0 张参考图），点击触发 file picker", async () => {
    const handleReferenceInput = vi.fn();
    render(
      <MockProvider overrides={{ handleReferenceInput }}>
        <Composer />
      </MockProvider>
    );
    const trigger = screen.getByTestId("composer-upload-trigger");
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent("添加图");
    expect(trigger).not.toBeDisabled();

    // 点击 trigger 应通过 ref 调起 hidden file input 的 click —— 验证两者
    // 都在 DOM 里，并模拟 input change 事件触发 handleReferenceInput
    const hiddenInput = screen.getByTestId(
      "composer-upload-input"
    ) as HTMLInputElement;
    expect(hiddenInput).toBeInTheDocument();
    expect(hiddenInput).toHaveAttribute("type", "file");

    // 模拟选文件：直接派发 change 事件（jsdom 下 click() 不会真弹原生 picker）
    const file = makeFile("upload.png");
    Object.defineProperty(hiddenInput, "files", {
      configurable: true,
      value: [file]
    });
    hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
    expect(handleReferenceInput).toHaveBeenCalledTimes(1);
  });

  it("「添加图」按钮在到达 8 张上限时 disabled 并显示「已达 8 张上限」", () => {
    render(
      <MockProvider
        overrides={{
          referenceImages: makeReferenceImages(8),
          referencePreviews: makePreviews(8),
          referenceImage: makeFile("ref-0.png")
        }}
      >
        <Composer />
      </MockProvider>
    );
    const trigger = screen.getByTestId("composer-upload-trigger");
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveTextContent("已达 8 张上限");
  });
});

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { vi } from "vitest";

// react-konva 在 jsdom 下没有 canvas，全量 mock 成普通 div：
// - Konva 节点的 `name` prop 通过 mock 转成 `data-testid`，让 smoke test
//   能直接 getByTestId(name) 断言背景 / 网格 / 空层 anchor 是否被渲染。
// - 子节点正常 children 渲染，3 列布局测试可以验证 Stage 嵌套结构。
// - Konva 事件 prop（onClick / onTap / onDragEnd / onTransformEnd 等）
//   保留为 React 事件 handler。Konva 真实运行时事件签名是 KonvaEventObject<E>，
//   测试里只需要触发 dispatch 并断言 reducer 状态，不依赖 e.target.x() 等真实
//   Konva node 接口。
vi.mock("react-konva", () => {
  type Props = {
    name?: string;
    children?: React.ReactNode;
    [key: string]: unknown;
  };
  const KONVA_EVENT_PROPS = new Set([
    "onClick",
    "onTap",
    "onDragStart",
    "onDragMove",
    "onDragEnd",
    "onTransformStart",
    "onTransform",
    "onTransformEnd",
    "onMouseDown",
    "onMouseMove",
    "onMouseUp",
    "onMouseEnter",
    "onMouseLeave",
    "onTouchStart",
    "onTouchMove",
    "onTouchEnd",
    "onDblClick",
    "onDblTap"
  ]);
  const make = (kind: string) => {
    const C = ({
      name,
      children,
      ref,
      ...rest
    }: Props & { ref?: React.Ref<unknown> }) => {
      const attrs: Record<string, unknown> = { "data-konva-kind": kind };
      // Cut 4.1: forward `ref` so callers like BoardStage can grab a DOM
      // stand-in for Konva.Stage in jsdom. React 19 accepts `ref` as a
      // regular prop on function components, so passing it through to
      // React.createElement attaches the callback ref to the underlying
      // <div>. Existing components type-guard against missing Konva
      // methods (e.g. `transformer.nodes` not being a function on a div),
      // so callers that previously got `null` and now receive a div keep
      // the same no-op behaviour in tests.
      if (ref !== undefined) attrs.ref = ref;
      if (name) attrs["data-testid"] = name;
      for (const [key, value] of Object.entries(rest)) {
        if (KONVA_EVENT_PROPS.has(key) && typeof value === "function") {
          attrs[key] = value;
        } else if (key.startsWith("data-") || key === "role") {
          attrs[key] = value;
        } else if (key === "points" && Array.isArray(value)) {
          attrs["data-konva-points"] = (value as number[]).join(",");
        }
      }
      return React.createElement("div", attrs, children);
    };
    C.displayName = `Konva${kind}Mock`;
    return C;
  };
  return {
    Stage: make("Stage"),
    Layer: make("Layer"),
    Group: make("Group"),
    Rect: make("Rect"),
    Line: make("Line"),
    Circle: make("Circle"),
    Image: make("Image"),
    Text: make("Text"),
    Transformer: make("Transformer"),
    Path: make("Path")
  };
});

// Radix UI primitives (Select / Dialog / Popover / Checkbox ...) call into
// pointer-capture, scroll, and ResizeObserver APIs that jsdom does not
// implement. Polyfill them so component tests that mount Radix-based shadcn
// primitives (Select dropdown, Checkbox indicator, etc.) can run.
if (typeof Element !== "undefined") {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// jsdom 不实现 window.matchMedia；ThemeProvider 用它判 prefers-color-scheme，
// 不 polyfill 会让任何渲染了 ThemeProvider 的测试在 readSystemTheme() 处挂掉。
if (typeof window !== "undefined" && typeof window.matchMedia === "undefined") {
  type Listener = (event: MediaQueryListEvent) => void;
  window.matchMedia = (query: string): MediaQueryList => {
    const listeners = new Set<Listener>();
    return {
      matches: false,
      media: query,
      onchange: null,
      addEventListener: (_event: string, listener: Listener) => listeners.add(listener),
      removeEventListener: (_event: string, listener: Listener) => listeners.delete(listener),
      addListener: (listener: Listener) => listeners.add(listener),
      removeListener: (listener: Listener) => listeners.delete(listener),
      dispatchEvent: () => false
    } as unknown as MediaQueryList;
  };
}

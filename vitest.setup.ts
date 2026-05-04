import "@testing-library/jest-dom/vitest";

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

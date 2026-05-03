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

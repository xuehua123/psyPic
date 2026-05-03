import "@testing-library/jest-dom/vitest";

// Radix UI primitives (Select / Dialog / Popover ...) call into pointer-capture
// and scroll APIs that jsdom does not implement. Polyfill them so component
// tests that open Radix popovers (e.g. shadcn Select dropdown) can find their
// portal'd content.
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

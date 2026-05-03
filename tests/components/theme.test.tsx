import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  THEME_STORAGE_KEY,
  ThemeNoFlashScript,
  ThemeProvider,
  useTheme
} from "@/components/theme/ThemeProvider";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

function ThemeProbe() {
  const { theme, resolvedTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
    </div>
  );
}

describe("ThemeProvider + ThemeToggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "";
  });

  afterEach(() => {
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "";
  });

  it("默认初始化为 system + 亮色（无 localStorage、无 prefers-color-scheme: dark）", () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(screen.getByTestId("theme")).toHaveTextContent("system");
    expect(screen.getByTestId("resolved")).toHaveTextContent("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("从 localStorage 恢复持久化的暗色偏好，写到 documentElement", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("ThemeToggle 点击循环切换 light → dark → system → light", async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <ThemeProbe />
        <ThemeToggle />
      </ThemeProvider>
    );

    expect(screen.getByTestId("theme")).toHaveTextContent("light");

    const toggle = screen.getByRole("button", { name: /主题/ });

    await user.click(toggle);
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");

    await user.click(toggle);
    expect(screen.getByTestId("theme")).toHaveTextContent("system");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");

    await user.click(toggle);
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("useTheme 在没有 ThemeProvider 包裹时返回 noop 默认值，不抛错", () => {
    // 直接渲染 ThemeProbe，不包 ThemeProvider
    render(<ThemeProbe />);
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    expect(screen.getByTestId("resolved")).toHaveTextContent("light");
  });

  it("ThemeNoFlashScript 注入同步初始化脚本字符串", () => {
    const { container } = render(<ThemeNoFlashScript />);
    const script = container.querySelector("script");
    expect(script).not.toBeNull();
    const code = script?.innerHTML ?? "";
    expect(code).toContain(THEME_STORAGE_KEY);
    expect(code).toContain("classList");
    expect(code).toContain("colorScheme");
  });

  it("setTheme 静默处理 localStorage 写入失败（disabled storage 场景）", async () => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("QuotaExceededError");
    };

    const user = userEvent.setup();
    try {
      render(
        <ThemeProvider>
          <ThemeProbe />
          <ThemeToggle />
        </ThemeProvider>
      );

      const toggle = screen.getByRole("button", { name: /主题/ });
      // 不应该 throw
      await act(async () => {
        await user.click(toggle);
      });

      // theme state 仍然更新
      expect(screen.getByTestId("theme")).not.toHaveTextContent("system");
    } finally {
      Storage.prototype.setItem = originalSetItem;
    }
  });
});

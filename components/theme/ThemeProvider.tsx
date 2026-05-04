"use client";

import { ThemeProvider as NextThemeProvider, useTheme as useNextTheme } from "next-themes";
import type { ReactNode } from "react";

/**
 * Phase 6 暗色模式（next-themes 迁移版）：
 * - `light` / `dark` 显式选择
 * - `system` 跟随 OS prefers-color-scheme
 *
 * 由 `next-themes` 提供 SSR 安全 + 抗 FOUC + 持久化能力，本文件保持
 * 同样的 export 形态（ThemeProvider / useTheme / Theme / ResolvedTheme /
 * THEME_STORAGE_KEY），供 ThemeToggle 与测试在迁移前后无感知。
 *
 * 关键约束：
 * - `attribute="class"`：切 <html class="dark">，与 globals.css `.dark { ... }`
 *   token block 直接对应，不变更样式入口。
 * - `storageKey="psypic-theme"`：与历史 localStorage key 兼容，老用户偏好不丢。
 * - `enableSystem` + `defaultTheme="system"`：保留三态语义。
 * - `useTheme()` 包了一层兼容 wrapper：
 *   ① 把 next-themes 的可空字段（mount 前 / Provider 外）规整为非空
 *      `{ theme: "light", resolvedTheme: "light", setTheme: noop }`，让独立
 *      预览组件 / vitest 用例不受 Provider 缺失影响。
 *   ② setTheme 类型收敛为 `(next: Theme) => void`，调用方无需关心
 *      next-themes 的 `string | undefined` 联合类型。
 */
export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "psypic-theme";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (next: Theme) => void;
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="system"
      disableTransitionOnChange
      enableSystem
      storageKey={THEME_STORAGE_KEY}
      themes={["light", "dark"]}
    >
      {children}
    </NextThemeProvider>
  );
}

function normalizeTheme(value: string | undefined): Theme {
  if (value === "light" || value === "dark" || value === "system") return value;
  return "light";
}

function normalizeResolved(value: string | undefined): ResolvedTheme {
  return value === "dark" ? "dark" : "light";
}

export function useTheme(): ThemeContextValue {
  const next = useNextTheme();
  return {
    theme: normalizeTheme(next.theme),
    resolvedTheme: normalizeResolved(next.resolvedTheme),
    setTheme: (value: Theme) => {
      // next-themes 的 setTheme 在 Provider 外是 noop，可直接转发
      next.setTheme(value);
    }
  };
}

"use client";

import { Monitor, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useTheme, type Theme } from "./ThemeProvider";

const THEME_ORDER: Theme[] = ["light", "dark", "system"];

const ICON_BY_THEME = {
  light: Sun,
  dark: Moon,
  system: Monitor
} as const;

const LABEL_BY_THEME: Record<Theme, string> = {
  light: "亮色",
  dark: "暗色",
  system: "跟随系统"
};

/**
 * 三态循环切换按钮（亮色 → 暗色 → 跟随系统 → 亮色 …）。
 * 图标显示当前主题语义；hover/aria 提示下一态。
 *
 * 放在 AppTopNav UtilityNav 区，与「设置 / 管理台」并列。
 */
export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const Icon = ICON_BY_THEME[theme];
  const currentLabel =
    theme === "system" ? `跟随系统（当前${resolvedTheme === "dark" ? "暗" : "亮"}）` : LABEL_BY_THEME[theme];
  const nextTheme = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];
  const ariaLabel = `主题：${currentLabel}，点击切换到${LABEL_BY_THEME[nextTheme]}`;

  return (
    <Button
      aria-label={ariaLabel}
      className="size-9 text-muted-foreground hover:text-foreground"
      onClick={() => setTheme(nextTheme)}
      size="icon"
      title={ariaLabel}
      type="button"
      variant="ghost"
    >
      <Icon aria-hidden className="size-[15px]" />
    </Button>
  );
}

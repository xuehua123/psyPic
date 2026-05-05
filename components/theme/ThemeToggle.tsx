"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

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
 *
 * SSR 注意：next-themes 在 mount 前 `theme` 取自服务端默认（normalize 后为
 * "light"），mount 后才从 localStorage / prefers-color-scheme 读到真实值。
 * 直接消费会触发 hydration mismatch（服务端 Sun + "亮色"，客户端 Moon +
 * "暗色"）。因此用 `mounted` flag 做 guard：mount 前稳定渲染 light 占位，
 * mount 后再切到真实主题图标 / aria-label。
 */
export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // mount guard：刻意在 effect 里同步 setState 翻 mounted flag，让首次
  // SSR / hydrate paint 走稳定 fallback（避免 hydration mismatch），
  // mount 完成后才切到真实 theme。这是 next-themes 等 SSR-safe 持久化
  // hook 的标准模式，cascading render 一次开销可接受 —— 比错误的 hydrate
  // 重建整树代价低。
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const displayTheme: Theme = mounted ? theme : "light";
  const Icon = ICON_BY_THEME[displayTheme];
  const currentLabel =
    displayTheme === "system"
      ? `跟随系统（当前${resolvedTheme === "dark" ? "暗" : "亮"}）`
      : LABEL_BY_THEME[displayTheme];
  const nextTheme = THEME_ORDER[(THEME_ORDER.indexOf(displayTheme) + 1) % THEME_ORDER.length];
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

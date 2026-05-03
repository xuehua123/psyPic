"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from "react";

/**
 * Phase 6 暗色模式：
 * - `light` / `dark` 显式选择
 * - `system` 跟随 OS prefers-color-scheme
 *
 * SSR 安全策略：
 * - 服务端始终渲染为「无 .dark 类」初始态（state = "system" + resolved = "light"）
 * - app/layout.tsx 的 <ThemeNoFlashScript /> 在 hydrate 前同步把 localStorage 状态
 *   写到 <html class="dark"> + colorScheme，避免 FOUC
 * - 客户端 mount 后 useEffect 从 localStorage 读真实状态并同步 React state，
 *   DOM .dark 类已就位 → 用户感知不到「闪一下」
 */
export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (next: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const THEME_STORAGE_KEY = "psypic-theme";

function readSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  // mount: 从 localStorage 读取持久化偏好
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    if (stored === "light" || stored === "dark" || stored === "system") {
      setThemeState(stored);
    }
  }, []);

  // theme 变化时：算 resolvedTheme + 写到 documentElement
  useEffect(() => {
    const next: ResolvedTheme = theme === "system" ? readSystemTheme() : theme;
    setResolvedTheme(next);
    applyTheme(next);

    if (theme !== "system") return;
    if (typeof window === "undefined") return;
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const onChange = () => {
      const sys = readSystemTheme();
      setResolvedTheme(sys);
      applyTheme(sys);
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        /* localStorage 可能被 disabled，静默忽略 */
      }
    }
    setThemeState(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme 必须在 <ThemeProvider> 内调用");
  }
  return ctx;
}

/**
 * 在 <head> 顶部 inline 注入：在 React hydrate 之前同步把
 * <html class="dark"> + colorScheme 设好，避免暗色用户首次进入时白屏一闪。
 */
export function ThemeNoFlashScript() {
  const code = `(function(){try{var k='${THEME_STORAGE_KEY}';var t=localStorage.getItem(k);if(t!=='light'&&t!=='dark'&&t!=='system')t='system';var r=t==='system'?(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;var c=document.documentElement.classList;if(r==='dark')c.add('dark');else c.remove('dark');document.documentElement.style.colorScheme=r;}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} suppressHydrationWarning />;
}

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
 * - 服务端始终渲染为「无 .dark 类、theme="system"、resolvedTheme="light"」初始态
 * - app/layout.tsx 的 <ThemeNoFlashScript /> 在 React hydrate 前 inline 注入脚本，
 *   同步把 localStorage 状态写到 <html class="dark"> + colorScheme，避免 FOUC
 * - 客户端 mount 后第一个 effect 从 localStorage + matchMedia 读真实状态，
 *   后续渲染保持 React state 与 DOM 一致
 * - 用 `hydrated` flag 让 DOM apply effect 只在 hydrate 之后跑，避免与
 *   no-flash script 抢 documentElement.className
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
  const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
  return mq?.matches ? "dark" : "light";
}

function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    /* localStorage 可能被 disabled，静默退回 default */
  }
  return "system";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>("light");
  const [hydrated, setHydrated] = useState(false);

  // mount：从外部源（localStorage + matchMedia）同步进 React state
  // 这是 React 文档推荐的 SSR-safe 「hydrate from external store」标准模式：
  // 服务端 useState 给 default → 客户端 mount 后 effect 同步真实值。
  // react-hooks/set-state-in-effect 规则对此模式过于严格，此处显式豁免。
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setThemeState(readStoredTheme());
    setSystemTheme(readSystemTheme());
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // 订阅 OS prefers-color-scheme 变化；setState 只在 change handler 里
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const onChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // resolvedTheme 同步 derived，不用 state，不用 effect
  const resolvedTheme: ResolvedTheme = theme === "system" ? systemTheme : theme;

  // 把 resolvedTheme 写到 documentElement.classList + style.colorScheme
  // hydrated 之前不动 DOM，让 no-flash script 的初始 class 留着
  useEffect(() => {
    if (!hydrated) return;
    applyTheme(resolvedTheme);
  }, [hydrated, resolvedTheme]);

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
    // 测试环境或独立预览组件可能没有 <ThemeProvider> 包裹；
    // 返回 noop 默认值（亮色 + setTheme 静默丢弃），避免抛错让组件树挂掉。
    return {
      theme: "light",
      resolvedTheme: "light",
      setTheme: () => {}
    };
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

"use client";

import * as React from "react";
import { CheckCircle2Icon, InfoIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * 极简 sidebar 内 toast —— 项目无 sonner，自写一条。
 *
 * 用法：在 ProjectSidebar 顶层包 `<SidebarToastProvider>`，子组件用
 *  `useSidebarToast()` 触发；2.5s 自动消失。
 *
 * 不全局 mount —— 故意只在 sidebar 范围内可用，避免和未来正式 toast
 * 系统冲突。
 */

type ToastVariant = "info" | "success";

type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type SidebarToastContextValue = {
  show: (message: string, variant?: ToastVariant) => void;
};

const SidebarToastContext = React.createContext<SidebarToastContextValue | null>(
  null
);

const TOAST_DURATION_MS = 2500;

let toastIdSeed = 0;

export function SidebarToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const timersRef = React.useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const dismiss = React.useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const show = React.useCallback<SidebarToastContextValue["show"]>(
    (message, variant = "info") => {
      toastIdSeed += 1;
      const id = toastIdSeed;
      setToasts((current) => [...current, { id, message, variant }]);
      const timer = setTimeout(() => dismiss(id), TOAST_DURATION_MS);
      timersRef.current.set(id, timer);
    },
    [dismiss]
  );

  // 卸载时清掉所有定时器
  React.useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const value = React.useMemo<SidebarToastContextValue>(() => ({ show }), [show]);

  return (
    <SidebarToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2"
        data-testid="sidebar-toast-region"
      >
        {toasts.map((toast) => {
          const Icon = toast.variant === "success" ? CheckCircle2Icon : InfoIcon;
          return (
            <div
              className={cn(
                "pointer-events-auto flex min-w-[220px] max-w-[420px] items-center gap-2 rounded-md border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md",
                "animate-in fade-in-0 slide-in-from-bottom-2"
              )}
              data-testid="sidebar-toast"
              data-variant={toast.variant}
              key={toast.id}
              role="status"
            >
              <Icon
                aria-hidden="true"
                className={cn(
                  "size-4 shrink-0",
                  toast.variant === "success" ? "text-accent" : "text-muted-foreground"
                )}
              />
              <span className="leading-snug">{toast.message}</span>
            </div>
          );
        })}
      </div>
    </SidebarToastContext.Provider>
  );
}

export function useSidebarToast(): SidebarToastContextValue {
  const ctx = React.useContext(SidebarToastContext);
  if (!ctx) {
    // 不抛 —— 测试或 storybook 之外的场景能优雅降级
    return {
      show: (message) => {
        if (typeof console !== "undefined") {
          console.info(`[sidebar-toast fallback] ${message}`);
        }
      }
    };
  }
  return ctx;
}

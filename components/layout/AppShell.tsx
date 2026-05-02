"use client";

import type { ReactNode } from "react";

import AppTopNav from "@/components/layout/AppTopNav";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: ReactNode;
  currentPath: string;
  showAdminLink?: boolean;
  bodyClassName?: string;
};

/**
 * 全站统一产品壳：顶栏 + body。
 * 顶栏粘性、悬浮、低对比；body 内容自管。
 */
export default function AppShell({
  children,
  currentPath,
  showAdminLink = false,
  bodyClassName
}: AppShellProps) {
  return (
    <div
      className="flex h-dvh min-h-dvh flex-col overflow-hidden bg-background text-foreground"
      data-testid="app-shell"
    >
      <AppTopNav currentPath={currentPath} showAdminLink={showAdminLink} />
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden",
          bodyClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}

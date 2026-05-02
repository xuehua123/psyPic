"use client";

import Link from "next/link";
import { Compass, LayoutDashboard, Settings, Shield } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import { cn } from "@/lib/utils";

type AppTopNavProps = {
  currentPath: string;
  showAdminLink?: boolean;
};

type IconType = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

type NavItem = {
  href: string;
  label: string;
  icon: IconType;
};

/**
 * 主导航：仅放产品系统级页面。
 * 与 docs/superpowers/specs/2026-05-02-psypic-ui-system-design.md 严格对齐：
 * - "主导航仅放工作台 + 灵感社区"
 * - 项目/对话/分支/参数/模板/素材/历史/批量 等都属于工作台内部能力，不进主导航
 */
const primaryLinks: NavItem[] = [
  { href: "/", label: "工作台", icon: LayoutDashboard },
  { href: "/community", label: "灵感社区", icon: Compass }
];

export default function AppTopNav({
  currentPath,
  showAdminLink = false
}: AppTopNavProps) {
  return (
    <header
      aria-label="产品导航"
      className="sticky top-0 z-40 flex h-14 shrink-0 items-center border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70"
    >
      <div className="mx-auto flex h-full w-full max-w-[1480px] items-center justify-between gap-6 px-5">
        <Brand />
        <PrimaryNav currentPath={currentPath} />
        <UtilityNav currentPath={currentPath} showAdminLink={showAdminLink} />
      </div>
    </header>
  );
}

function Brand() {
  return (
    <Link
      aria-label="PsyPic 商业创作系统"
      className="group flex min-w-0 items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      href="/"
    >
      <span
        aria-hidden
        className="grid size-8 place-items-center rounded-md bg-accent text-[13px] font-bold text-accent-foreground shadow-[inset_0_-1px_0_rgba(0,0,0,0.18)]"
      >
        P
      </span>
      <span className="hidden flex-col leading-tight md:flex">
        <strong className="text-[15px] font-semibold tracking-tight text-foreground">
          PsyPic
        </strong>
        <span className="text-[11px] text-muted-foreground">商业创作系统</span>
      </span>
    </Link>
  );
}

function PrimaryNav({ currentPath }: { currentPath: string }) {
  return (
    <nav aria-label="主导航" className="flex items-center gap-1">
      {primaryLinks.map((item) => {
        const active = matchPath(currentPath, item.href);
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-colors outline-none",
              "focus-visible:ring-2 focus-visible:ring-accent/40",
              active
                ? "border-border bg-muted text-foreground"
                : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            href={item.href}
            key={item.href}
          >
            <item.icon aria-hidden className="size-[15px]" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function UtilityNav({
  currentPath,
  showAdminLink
}: {
  currentPath: string;
  showAdminLink: boolean;
}) {
  return (
    <div aria-label="工具区" className="flex items-center gap-1" role="navigation">
      {showAdminLink ? (
        <UtilityLink
          active={matchPath(currentPath, "/admin")}
          href="/admin"
          icon={Shield}
          label="管理台"
        />
      ) : null}
      <UtilityLink
        active={matchPath(currentPath, "/settings")}
        href="/settings"
        icon={Settings}
        label="设置"
      />
    </div>
  );
}

function UtilityLink({
  href,
  label,
  icon: Icon,
  active
}: {
  href: string;
  label: string;
  icon: IconType;
  active: boolean;
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-[13px] font-medium transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-accent/40",
        active
          ? "border-border bg-muted text-foreground"
          : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
      href={href}
    >
      <Icon aria-hidden className="size-[14px]" />
      <span>{label}</span>
    </Link>
  );
}

function matchPath(currentPath: string, href: string) {
  if (href === "/") {
    return currentPath === "/";
  }

  return currentPath === href || currentPath.startsWith(`${href}/`);
}

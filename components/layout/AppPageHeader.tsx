import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type AppPageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

/**
 * 通用页面头：eyebrow + title + description + actions slot。
 * 替换原 product-page-header / library-page-header / community-header / admin-header。
 */
export default function AppPageHeader({
  eyebrow,
  title,
  description,
  actions,
  className
}: AppPageHeaderProps) {
  return (
    <header
      className={cn(
        "mx-auto flex w-full max-w-[1180px] flex-wrap items-end justify-between gap-4",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {eyebrow}
          </span>
        ) : null}
        <h1 className="mt-1 text-[22px] font-semibold leading-tight tracking-tight text-foreground sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

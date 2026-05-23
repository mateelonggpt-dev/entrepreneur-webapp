import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface DocumentSectionProps {
  title: string;
  icon?: ElementType;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  headerAction?: ReactNode;
}

export const DocumentSection = ({
  title,
  icon: Icon,
  children,
  className,
  contentClassName,
  headerAction,
}: DocumentSectionProps) => (
  <section className={cn("overflow-hidden rounded-xl border border-border/60 bg-card", className)}>
    <header className="flex items-center justify-between gap-3 border-b border-border/60 bg-secondary/40 px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        {Icon ? (
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-brand text-primary-foreground">
            <Icon className="h-3.5 w-3.5" />
          </div>
        ) : null}
        <h3 className="truncate text-xs font-semibold tracking-wide">{title}</h3>
      </div>
      {headerAction}
    </header>
    <div className={cn("space-y-3 p-4", contentClassName)}>{children}</div>
  </section>
);

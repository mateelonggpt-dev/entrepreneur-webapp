import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface DocumentTotalRow {
  label: ReactNode;
  value: ReactNode;
}

interface DocumentTotalsPanelProps {
  title: ReactNode;
  rows: DocumentTotalRow[];
  totalLabel: ReactNode;
  totalValue: ReactNode;
  className?: string;
  totalClassName?: string;
  children?: ReactNode;
}

export const DocumentTotalsPanel = ({
  title,
  rows,
  totalLabel,
  totalValue,
  className,
  totalClassName,
  children,
}: DocumentTotalsPanelProps) => (
  <section
    className={cn(
      "rounded-xl border border-border/60 bg-gradient-to-br from-primary/5 to-accent/5 p-4",
      className
    )}
  >
    <h3 className="mb-3 text-xs font-semibold text-primary">{title}</h3>
    <dl className="space-y-2 text-xs tabular-nums">
      {rows.map((row, index) => (
        <div key={index} className="flex justify-between">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="font-mono">{row.value}</dd>
        </div>
      ))}
      <div className="mt-2 flex justify-between border-t border-border pt-2">
        <dt className="text-sm font-bold">{totalLabel}</dt>
        <dd className={cn("font-mono text-base font-extrabold text-primary", totalClassName)}>
          {totalValue}
        </dd>
      </div>
      {children}
    </dl>
  </section>
);

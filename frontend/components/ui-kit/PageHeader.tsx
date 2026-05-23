import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: { label: string; to?: string }[];
  actions?: ReactNode;
  className?: string;
}

export const PageHeader = ({ title, description, breadcrumbs, actions, className }: PageHeaderProps) => {
  return (
    <div className={cn("mb-6 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4", className)}>
      <div>
        {breadcrumbs && (
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            {breadcrumbs.map((b, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="opacity-50">/</span>}
                <span className={i === breadcrumbs.length - 1 ? "text-foreground font-medium" : ""}>
                  {b.label}
                </span>
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-2xl lg:text-3xl font-display font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
};

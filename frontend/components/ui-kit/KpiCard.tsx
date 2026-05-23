import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  icon?: ReactNode;
  delta?: { value: string; positive?: boolean };
  hint?: string;
  accent?: "primary" | "success" | "warning" | "destructive" | "info";
  className?: string;
}

const accentMap = {
  primary: "from-primary/10 to-primary/0 text-primary",
  success: "from-success/10 to-success/0 text-success",
  warning: "from-warning/10 to-warning/0 text-warning",
  destructive: "from-destructive/10 to-destructive/0 text-destructive",
  info: "from-info/10 to-info/0 text-info",
};

export const KpiCard = ({ label, value, icon, delta, hint, accent = "primary", className }: KpiCardProps) => {
  return (
    <div className={cn(
      "card-premium p-5 relative overflow-hidden group hover:shadow-premium transition-all duration-300",
      className
    )}>
      <div className={cn(
        "absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br opacity-60 blur-2xl",
        accentMap[accent]
      )} />
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
          {icon && (
            <div className={cn("p-2 rounded-xl bg-gradient-to-br", accentMap[accent])}>
              {icon}
            </div>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-display font-bold tabular-nums tracking-tight">{value}</p>
        </div>
        {(delta || hint) && (
          <div className="mt-2 flex items-center gap-2">
            {delta && (
              <span className={cn(
                "inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded",
                delta.positive ? "text-success bg-success/10" : "text-destructive bg-destructive/10"
              )}>
                {delta.positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {delta.value}
              </span>
            )}
            {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
          </div>
        )}
      </div>
    </div>
  );
};

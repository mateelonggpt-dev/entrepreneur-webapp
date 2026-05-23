import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

type Status =
  | "draft" | "sent" | "paid" | "overdue" | "partial"
  | "approved" | "pending" | "pending_bill" | "billed" | "invoiced"
  | "rejected" | "cancelled" | "void"
  | "active" | "inactive"
  | "connected" | "disconnected" | "coming_soon" | "needs_configuration"
  | "in_stock" | "low_stock" | "out_of_stock" | "negative_stock";

const map: Record<Status, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-info/10 text-info border-info/20",
  paid: "bg-success/10 text-success border-success/20",
  overdue: "bg-destructive/10 text-destructive border-destructive/20",
  partial: "bg-warning/15 text-warning border-warning/20",
  approved: "bg-success/10 text-success border-success/20",
  pending: "bg-warning/15 text-warning border-warning/20",
  pending_bill: "bg-warning/15 text-warning border-warning/20",
  billed: "bg-primary/10 text-primary border-primary/20",
  invoiced: "bg-info/10 text-info border-info/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  cancelled: "bg-muted text-muted-foreground",
  void: "bg-muted text-muted-foreground line-through",
  active: "bg-success/10 text-success border-success/20",
  inactive: "bg-muted text-muted-foreground",
  connected: "bg-success/10 text-success border-success/20",
  disconnected: "bg-muted text-muted-foreground",
  coming_soon: "bg-info/10 text-info border-info/20",
  needs_configuration: "bg-warning/15 text-warning border-warning/20",
  in_stock: "bg-success/10 text-success border-success/20",
  low_stock: "bg-warning/15 text-warning border-warning/20",
  out_of_stock: "bg-destructive/10 text-destructive border-destructive/20",
  negative_stock: "bg-destructive/10 text-destructive border-destructive/20",
};

const humanizeStatus = (status: string) =>
  status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const StatusBadge = ({ status, className }: { status: Status; className?: string }) => {
  const { t } = useTranslation();
  const label = t(`status.${status}`, {
    defaultValue: humanizeStatus(status),
  });
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold capitalize border border-transparent",
      map[status],
      className
    )}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
};

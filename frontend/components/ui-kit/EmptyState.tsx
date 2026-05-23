import { ReactNode } from "react";
import { Mascot } from "@/components/brand/Mascot";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: { label: string; onClick?: () => void };
  icon?: ReactNode;
  className?: string;
}

export const EmptyState = ({ title, description, action, icon, className }: EmptyStateProps) => {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-16 px-6", className)}>
      {icon ?? <Mascot size="md" />}
      <h3 className="mt-4 text-lg font-display font-semibold">{title}</h3>
      {description && <p className="mt-1.5 text-sm text-muted-foreground max-w-sm">{description}</p>}
      {action && (
        <Button onClick={action.onClick} className="mt-5 bg-gradient-brand hover:opacity-90 text-primary-foreground border-0 shadow-brand">
          {action.label}
        </Button>
      )}
    </div>
  );
};

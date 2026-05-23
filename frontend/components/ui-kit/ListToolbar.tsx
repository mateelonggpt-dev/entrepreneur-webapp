import { ReactNode } from "react";
import { Search, Filter, Calendar, Download, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ListToolbarProps {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  primaryAction?: { label: string; onClick?: () => void };
  extra?: ReactNode;
  className?: string;
  onFilterClick?: () => void;
  onPeriodClick?: () => void;
  onExportClick?: () => void;
}

export const ListToolbar = ({
  searchPlaceholder,
  searchValue,
  onSearchChange,
  primaryAction,
  extra,
  className,
  onFilterClick,
  onPeriodClick,
  onExportClick,
}: ListToolbarProps) => {
  const { t } = useTranslation();
  return (
    <div className={cn("flex flex-col lg:flex-row gap-3 mb-4", className)}>
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder ?? t("common.searchShort")}
          className="pl-9 bg-card"
          value={searchValue}
          onChange={(event) => onSearchChange?.(event.target.value)}
        />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {onFilterClick ? (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onFilterClick}>
            <Filter className="h-4 w-4" /> {t("common.filters")}
          </Button>
        ) : null}
        {onPeriodClick ? (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onPeriodClick}>
            <Calendar className="h-4 w-4" /> {t("common.thisMonth")}
          </Button>
        ) : null}
        {onExportClick ? (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onExportClick}>
            <Download className="h-4 w-4" /> {t("common.export")}
          </Button>
        ) : null}
        {extra}
        {primaryAction && (
          <Button
            size="sm"
            onClick={primaryAction.onClick}
            disabled={!primaryAction.onClick}
            className="gap-1.5 bg-gradient-brand hover:opacity-90 shadow-brand text-primary-foreground border-0"
          >
            <Plus className="h-4 w-4" /> {primaryAction.label}
          </Button>
        )}
      </div>
    </div>
  );
};

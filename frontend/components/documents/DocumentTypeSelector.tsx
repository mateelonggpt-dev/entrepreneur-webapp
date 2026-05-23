import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface DocumentTypeOption {
  id: string;
  label: string;
  thaiLabel: string;
  helper?: string;
  children?: DocumentTypeOption[];
}

interface DocumentTypeSelectorProps {
  options: DocumentTypeOption[];
  selectedValues: string[];
  onSelectedValuesChange: (values: string[]) => void;
  language?: "en" | "th";
  otherMenuLabel?: string;
  disabledReasons?: Record<string, string>;
}

const NONE_ID = "none";

export const DocumentTypeSelector = ({
  options,
  selectedValues,
  onSelectedValuesChange,
  language = "en",
  otherMenuLabel = "More document types",
  disabledReasons = {},
}: DocumentTypeSelectorProps) => {
  const optionLabel = (option: DocumentTypeOption) => (language === "th" ? option.thaiLabel : option.label);
  const toggleValue = (value: string) => {
    if (disabledReasons[value]) {
      return;
    }

    if (value === NONE_ID) {
      onSelectedValuesChange(selectedValues.includes(NONE_ID) ? [] : [NONE_ID]);
      return;
    }

    const withoutNone = selectedValues.filter((selectedValue) => selectedValue !== NONE_ID);
    onSelectedValuesChange(
      withoutNone.includes(value)
        ? withoutNone.filter((selectedValue) => selectedValue !== value)
        : [...withoutNone, value]
    );
  };

  const selectedButtonClass =
    "border-primary/40 bg-emerald-50 text-emerald-950 shadow-sm ring-1 ring-primary/20 hover:bg-emerald-50";

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const childIds = option.children?.map((child) => child.id) ?? [];
        const selectedChildren = childIds.filter((childId) => selectedValues.includes(childId));
        const isSelected = selectedValues.includes(option.id);
        const isOtherSelected = selectedChildren.length > 0;
        const active = isSelected || isOtherSelected;
        const disabledReason = disabledReasons[option.id];
        const disabled = Boolean(disabledReason);

        if (option.children?.length) {
          return (
            <DropdownMenu key={option.id}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isOtherSelected}
                  disabled={disabled}
                  title={disabledReason}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-left text-sm font-semibold transition hover:border-primary/35 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    active && selectedButtonClass,
                    disabled && "cursor-not-allowed opacity-45 hover:border-border hover:bg-card"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-background",
                      active && "border-primary bg-primary text-primary-foreground"
                    )}
                    aria-hidden="true"
                  >
                    {active ? <Check className="h-3.5 w-3.5" /> : null}
                  </span>
                  <span className="leading-tight">{optionLabel(option)}</span>
                  {selectedChildren.length > 0 ? (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">
                      {selectedChildren.length}
                    </span>
                  ) : null}
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                <DropdownMenuLabel>{otherMenuLabel}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {option.children.map((child) => {
                  const childDisabledReason = disabledReasons[child.id];
                  return (
                    <DropdownMenuCheckboxItem
                      key={child.id}
                      checked={selectedValues.includes(child.id)}
                      disabled={Boolean(childDisabledReason)}
                      onCheckedChange={() => toggleValue(child.id)}
                      onSelect={(event) => event.preventDefault()}
                      className="py-2.5"
                      title={childDisabledReason}
                    >
                      <span className="flex flex-col leading-tight">
                        <span>{optionLabel(child)}</span>
                        {childDisabledReason ? (
                          <span className="mt-1 text-[11px] text-muted-foreground">{childDisabledReason}</span>
                        ) : null}
                      </span>
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }

        return (
          <button
            key={option.id}
            type="button"
            role="checkbox"
            aria-checked={isSelected}
            disabled={disabled}
            title={disabledReason}
            onClick={() => toggleValue(option.id)}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-left text-sm font-semibold transition hover:border-primary/35 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isSelected && selectedButtonClass,
              disabled && "cursor-not-allowed opacity-45 hover:border-border hover:bg-card"
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-background",
                isSelected && "border-primary bg-primary text-primary-foreground"
              )}
              aria-hidden="true"
            >
              {isSelected ? <Check className="h-3.5 w-3.5" /> : null}
            </span>
            <span className="leading-tight">{optionLabel(option)}</span>
          </button>
        );
      })}
    </div>
  );
};

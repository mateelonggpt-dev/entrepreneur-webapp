import type { ElementType, ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { DocumentSection } from "./DocumentSection";

interface SelectOption {
  value: string;
  label: string;
}

interface DocumentPartySectionProps {
  title: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  icon?: ElementType;
  placeholder?: string;
  error?: string;
  children?: ReactNode;
}

export const DocumentPartySection = ({
  title,
  label,
  value,
  onValueChange,
  options,
  icon,
  placeholder,
  error,
  children,
}: DocumentPartySectionProps) => (
  <DocumentSection icon={icon} title={title}>
    <div>
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="mt-1 h-9 bg-background">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? <p className="mt-1 text-[11px] text-destructive">{error}</p> : null}
    </div>
    {children}
  </DocumentSection>
);

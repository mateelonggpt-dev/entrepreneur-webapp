import type { ElementType, ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { DocumentSection } from "./DocumentSection";

export interface DocumentDateField {
  id: string;
  label: string;
  name?: string;
  type?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  onChange?: (value: string) => void;
}

interface DocumentDatesSectionProps {
  title: string;
  icon?: ElementType;
  fields?: DocumentDateField[];
  children?: ReactNode;
  gridClassName?: string;
}

export const DocumentDatesSection = ({
  title,
  icon,
  fields = [],
  children,
  gridClassName,
}: DocumentDatesSectionProps) => (
  <DocumentSection icon={icon} title={title}>
    {fields.length > 0 ? (
      <div className={cn("grid grid-cols-2 gap-3", gridClassName)}>
        {fields.map((field) => (
          <div key={field.id} className={field.className}>
            <Label htmlFor={field.id} className="text-[11px] text-muted-foreground">
              {field.label}
            </Label>
            <Input
              id={field.id}
              name={field.name}
              type={field.type ?? "text"}
              value={field.value}
              defaultValue={field.defaultValue}
              placeholder={field.placeholder}
              onChange={(event) => field.onChange?.(event.target.value)}
              className={cn("mt-1 h-9 bg-background", field.inputClassName)}
            />
          </div>
        ))}
      </div>
    ) : null}
    {children}
  </DocumentSection>
);

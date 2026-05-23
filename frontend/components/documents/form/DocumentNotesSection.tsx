import type { ElementType } from "react";

import { Textarea } from "@/components/ui/textarea";

import { DocumentSection } from "./DocumentSection";

interface DocumentNotesSectionProps {
  title: string;
  icon?: ElementType;
  name?: string;
  rows?: number;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  className?: string;
}

export const DocumentNotesSection = ({
  title,
  icon,
  name,
  rows = 4,
  value,
  defaultValue,
  placeholder,
  onChange,
  className,
}: DocumentNotesSectionProps) => (
  <DocumentSection icon={icon} title={title}>
    <Textarea
      name={name}
      rows={rows}
      value={value}
      defaultValue={defaultValue}
      placeholder={placeholder}
      onChange={(event) => onChange?.(event.target.value)}
      className={className ?? "resize-none bg-background text-xs"}
    />
  </DocumentSection>
);

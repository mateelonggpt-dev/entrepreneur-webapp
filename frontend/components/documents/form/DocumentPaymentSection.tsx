import type { ElementType, ReactNode } from "react";

import { DocumentSection } from "./DocumentSection";

interface DocumentPaymentSectionProps {
  title: string;
  icon?: ElementType;
  children: ReactNode;
}

export const DocumentPaymentSection = ({ title, icon, children }: DocumentPaymentSectionProps) => (
  <DocumentSection icon={icon} title={title}>
    {children}
  </DocumentSection>
);

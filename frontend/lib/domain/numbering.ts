import type { NumberingMode } from "@/lib/domain/enums";
import type { NumberingPolicy } from "@/lib/domain/models";

export const buildDocumentNumberPreview = ({
  prefix,
  startAt,
  dateText,
}: NumberingPolicy & { dateText?: string; serialDigits?: number }): string => {
  const match = String(dateText || "").match(/^(\d{4})-(\d{2})/);
  const year = match?.[1] ?? "2026";
  const month = match?.[2] ?? "04";

  return `${prefix}-${year}-${month}${String(startAt).padStart(5, "0")}`;
};

export const resolveNumberingMode = (automatic: boolean): NumberingMode =>
  automatic ? "yearly_reset" : "continuous";

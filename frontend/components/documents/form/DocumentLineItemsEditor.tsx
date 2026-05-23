import type { ElementType } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { DocumentSection } from "./DocumentSection";

export interface EditableDocumentLine {
  id: string;
  desc: string;
  qty: number;
  price: number;
  tax: number;
  vatRate?: number;
  vatAmount?: number;
  withholdingRate?: number;
  withholdingAmount?: number;
  discountType?: "percent" | "amount";
  discountValue?: number;
  discountAmount?: number;
  discount?: number;
  sku?: string;
}

interface DocumentLineItemsEditorLabels {
  title?: string;
  description?: string;
  qty?: string;
  unitPrice?: string;
  unitCost?: string;
  tax?: string;
  withholdingTax?: string;
  discount?: string;
  discountType?: string;
  percent?: string;
  amountType?: string;
  amount?: string;
  addLine?: string;
  linePlaceholder?: string;
}

interface DocumentLineItemsEditorProps<TLine extends EditableDocumentLine> {
  title: string;
  icon?: ElementType;
  lines: TLine[];
  onAddLine: () => void;
  onRemoveLine: (id: string) => void;
  onUpdateLine: (id: string, field: keyof EditableDocumentLine, value: string | number) => void;
  lineDiscountType?: "percent" | "amount";
  onLineDiscountTypeChange?: (value: "percent" | "amount") => void;
  labels?: DocumentLineItemsEditorLabels;
  error?: string;
  variant?: "table" | "cards";
  showDiscount?: boolean;
  showSku?: boolean;
  showVat?: boolean;
  showWithholdingTax?: boolean;
  amountFormatter?: (amount: number) => string;
}

const defaultFormatter = (amount: number) =>
  amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const lineTotal = (line: EditableDocumentLine) => {
  const subtotal = (Number(line.qty) || 0) * (Number(line.price) || 0);
  const discountValue = Number(line.discountValue ?? line.discount) || 0;
  const discount = Math.min(
    Math.max(line.discountType === "amount" ? discountValue : subtotal * (discountValue / 100), 0),
    subtotal
  );
  return subtotal - discount;
};

const sanitizeWholePercent = (value: string | number | undefined | null) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(Math.max(Math.trunc(numeric), 0), 100);
};
const whtRateOptions = [0, 1, 2, 3, 5];

export const DocumentLineItemsEditor = <TLine extends EditableDocumentLine>({
  title,
  icon,
  lines,
  onAddLine,
  onRemoveLine,
  onUpdateLine,
  lineDiscountType,
  onLineDiscountTypeChange,
  labels,
  error,
  variant = "table",
  showDiscount = false,
  showSku = false,
  showVat = true,
  showWithholdingTax = false,
  amountFormatter = defaultFormatter,
}: DocumentLineItemsEditorProps<TLine>) => {
  const effectiveDiscountType = lineDiscountType ?? lines.find((line) => line.discountType)?.discountType ?? "percent";
  const changeLineDiscountType = (value: "percent" | "amount") => {
    onLineDiscountTypeChange?.(value);
    lines.forEach((line) => onUpdateLine(line.id, "discountType", value));
  };
  const addButton = (
    <Button type="button" variant="outline" size="sm" onClick={onAddLine} className="gap-1.5">
      <Plus className="h-3.5 w-3.5" /> {labels?.addLine ?? "Add line"}
    </Button>
  );

  return (
    <DocumentSection
      icon={icon}
      title={title}
      headerAction={variant === "cards" ? addButton : undefined}
    >
      {variant === "cards" ? (
        <div className="space-y-3">
          {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
          {showDiscount ? (
            <div className="flex max-w-xs items-center gap-2">
              <Label className="shrink-0">{labels?.discountType ?? "Discount type"}</Label>
              <Select value={effectiveDiscountType} onValueChange={(value) => changeLineDiscountType(value as "percent" | "amount")}>
                <SelectTrigger className="h-8 bg-background" aria-label={labels?.discountType ?? "Discount type"}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">{labels?.percent ?? "Percent"}</SelectItem>
                  <SelectItem value="amount">{labels?.amountType ?? "Amount"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {lines.map((line, index) => (
            <div
              key={line.id}
              className={cn(
                "grid gap-3 rounded-xl border border-border/50 p-3",
                showDiscount
                  ? showWithholdingTax
                    ? "md:grid-cols-[2fr_0.7fr_0.9fr_0.7fr_0.7fr_0.7fr_auto]"
                    : "md:grid-cols-[2fr_0.7fr_0.9fr_0.7fr_0.7fr_auto]"
                  : showWithholdingTax
                    ? "md:grid-cols-[2fr_0.7fr_0.9fr_0.7fr_0.7fr_auto]"
                    : "md:grid-cols-[2fr_0.7fr_0.9fr_0.7fr_auto]"
              )}
            >
              <div>
                <Label>{labels?.description ?? "Description"}</Label>
                <Input
                  className="mt-1.5"
                  value={line.desc}
                  onChange={(event) => onUpdateLine(line.id, "desc", event.target.value)}
                  placeholder={
                    labels?.linePlaceholder
                      ? `${labels.linePlaceholder} ${index + 1}`
                      : `Line ${index + 1}`
                  }
                />
                {showSku && line.sku ? (
                  <p className="mt-1 text-[11px] font-mono text-muted-foreground">SKU: {line.sku}</p>
                ) : null}
              </div>
              <div>
                <Label>{labels?.qty ?? "Qty"}</Label>
                <Input
                  className="mt-1.5"
                  type="number"
                  min="0"
                  value={line.qty}
                  onChange={(event) => onUpdateLine(line.id, "qty", event.target.value)}
                />
              </div>
              <div>
                <Label>{labels?.unitCost ?? labels?.unitPrice ?? "Unit Cost"}</Label>
                <Input
                  className="mt-1.5"
                  type="number"
                  min="0"
                  value={line.price}
                  onChange={(event) => onUpdateLine(line.id, "price", event.target.value)}
                />
              </div>
              {showVat ? (
                <div>
                  <Label>{labels?.tax ?? "Tax %"}</Label>
                  <Input
                    className="mt-1.5"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    inputMode="numeric"
                    value={sanitizeWholePercent(line.vatRate ?? line.tax)}
                    onChange={(event) => onUpdateLine(line.id, "tax", sanitizeWholePercent(event.target.value))}
                  />
                </div>
              ) : null}
              {showWithholdingTax ? (
                <div>
                  <Label>{labels?.withholdingTax ?? "WHT %"}</Label>
                  <Select
                    value={String(whtRateOptions.includes(sanitizeWholePercent(line.withholdingRate ?? 0)) ? sanitizeWholePercent(line.withholdingRate ?? 0) : 0)}
                    onValueChange={(value) => onUpdateLine(line.id, "withholdingRate", Number(value))}
                  >
                    <SelectTrigger className="mt-1.5 h-9" aria-label={labels?.withholdingTax ?? "WHT %"}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {whtRateOptions.map((rate) => (
                        <SelectItem key={rate} value={String(rate)}>{rate}%</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {showDiscount ? (
                <div>
                  <Label>{labels?.discount ?? "Disc %"}</Label>
                  <Input
                    className="mt-1.5"
                    type="number"
                    min="0"
                    value={line.discountValue ?? line.discount ?? 0}
                    onChange={(event) => onUpdateLine(line.id, "discountValue", event.target.value)}
                  />
                </div>
              ) : null}
              <div className="flex items-end">
                <Button type="button" variant="ghost" size="icon" onClick={() => onRemoveLine(line.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border/60">
                  <th className="px-1 py-2 text-left font-semibold">
                    {labels?.description ?? "Description"}
                  </th>
                  <th className="w-20 px-1 py-2 text-right font-semibold">{labels?.qty ?? "Qty"}</th>
                  <th className="w-28 px-1 py-2 text-right font-semibold">
                    {labels?.unitPrice ?? "Unit Price"}
                  </th>
                  {showVat ? <th className="w-16 px-1 py-2 text-right font-semibold">{labels?.tax ?? "Tax"}</th> : null}
                  {showWithholdingTax ? <th className="w-16 px-1 py-2 text-right font-semibold">{labels?.withholdingTax ?? "WHT"}</th> : null}
                  {showDiscount ? (
                    <th className="w-40 px-1 py-2 text-right font-semibold">
                      <div className="flex items-center justify-end gap-2">
                        <span>{labels?.discount ?? "Discount"}</span>
                        <Select value={effectiveDiscountType} onValueChange={(value) => changeLineDiscountType(value as "percent" | "amount")}>
                          <SelectTrigger className="h-8 w-24 bg-background px-2 normal-case" aria-label={labels?.discountType ?? "Discount type"}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percent">{labels?.percent ?? "Percent"}</SelectItem>
                            <SelectItem value="amount">{labels?.amountType ?? "Amount"}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </th>
                  ) : null}
                  <th className="w-28 px-1 py-2 text-right font-semibold">
                    {labels?.amount ?? "Amount"}
                  </th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-b border-border/40">
                    <td className="px-1 py-2">
                      <Input
                        value={line.desc}
                        onChange={(event) => onUpdateLine(line.id, "desc", event.target.value)}
                        className="h-8 bg-background"
                        placeholder={labels?.linePlaceholder}
                      />
                    </td>
                    <td className="px-1 py-2">
                      <Input
                        type="number"
                        value={line.qty}
                        onChange={(event) => onUpdateLine(line.id, "qty", event.target.value)}
                        className="h-8 bg-background text-right font-mono"
                      />
                    </td>
                    <td className="px-1 py-2">
                      <Input
                        type="number"
                        value={line.price}
                        onChange={(event) => onUpdateLine(line.id, "price", event.target.value)}
                        className="h-8 bg-background text-right font-mono"
                      />
                    </td>
                    {showVat ? (
                      <td className="px-1 py-2">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          inputMode="numeric"
                          value={sanitizeWholePercent(line.vatRate ?? line.tax)}
                          onChange={(event) => onUpdateLine(line.id, "tax", sanitizeWholePercent(event.target.value))}
                          className="h-8 bg-background text-right font-mono"
                        />
                      </td>
                    ) : null}
                    {showWithholdingTax ? (
                      <td className="px-1 py-2">
                        <Select
                          value={String(whtRateOptions.includes(sanitizeWholePercent(line.withholdingRate ?? 0)) ? sanitizeWholePercent(line.withholdingRate ?? 0) : 0)}
                          onValueChange={(value) => onUpdateLine(line.id, "withholdingRate", Number(value))}
                        >
                          <SelectTrigger className="h-8 bg-background" aria-label={labels?.withholdingTax ?? "WHT %"}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {whtRateOptions.map((rate) => (
                              <SelectItem key={rate} value={String(rate)}>{rate}%</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    ) : null}
                    {showDiscount ? (
                      <td className="px-1 py-2">
                        <div>
                          <Input
                            type="number"
                            min="0"
                            value={line.discountValue ?? line.discount ?? 0}
                            onChange={(event) => onUpdateLine(line.id, "discountValue", event.target.value)}
                            className="h-8 bg-background text-right font-mono"
                            aria-label={labels?.discount ?? "Discount"}
                          />
                        </div>
                      </td>
                    ) : null}
                    <td className="px-1 py-2 text-right font-mono font-semibold tabular-nums">
                      {amountFormatter(lineTotal(line))}
                    </td>
                    <td className="px-1 py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => onRemoveLine(line.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
          <div className="mt-2">{addButton}</div>
        </>
      )}
    </DocumentSection>
  );
};

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProcessingDialog } from "./ProcessingDialog";
import { createStockAdjustment } from "@/lib/api";
import { useAppData } from "@/lib/app-data";
import type { InventoryItem } from "@/lib/types";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  item?: InventoryItem | null;
  onSaved?: (item: InventoryItem | null) => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export const StockAdjustmentModal = ({ open, onOpenChange, item, onSaved }: Props) => {
  const { t } = useTranslation();
  const { refresh } = useAppData();
  const [adjustmentType, setAdjustmentType] = useState<"increase" | "decrease">("increase");
  const [qty, setQty] = useState("1");
  const [effectiveDate, setEffectiveDate] = useState(today());
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setAdjustmentType("increase");
    setQty("1");
    setEffectiveDate(today());
    setReason("");
    setNotes("");
    setError(null);
    setSubmitting(false);
  }, [open, item?.sku]);

  const submit = async () => {
    if (!item?.sku) {
      return;
    }

    const numericQty = Number(qty);
    if (!Number.isFinite(numericQty) || numericQty <= 0) {
      setError(t("inventory.validation.adjustmentQtyPositive"));
      return;
    }
    if (!reason.trim()) {
      setError(t("inventory.validation.adjustmentReasonRequired"));
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const result = await createStockAdjustment({
        sku: item.sku,
        adjustmentType,
        qty: numericQty,
        effectiveDate,
        reason: reason.trim(),
        notes: notes.trim(),
      });
      await refresh();
      onSaved?.(result.inventoryItem);
      onOpenChange(false);
      toast.success(t("inventory.toast.stockUpdated", { sku: item.sku }), {
        description:
          adjustmentType === "increase"
            ? t("inventory.toast.stockIncreased", { qty: numericQty })
            : t("inventory.toast.stockDecreased", { qty: numericQty }),
      });
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : t("inventory.toast.unableToAdjustStock");
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
          <div className="flex items-start gap-3 border-b border-border bg-card px-6 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-brand text-primary-foreground shadow-brand">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold leading-tight">{t("inventory.adjustStock")}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("inventory.modals.stockAdjustmentDescription")}
              </p>
            </div>
          </div>

          <div className="space-y-4 bg-background px-6 py-5">
            <div className="rounded-xl border border-border/60 bg-secondary/20 p-4 text-sm">
              <p className="font-semibold">{item?.name ?? t("inventory.empty.noProductSelected")}</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{item?.sku ?? "-"}</p>
              <p className="mt-2 text-muted-foreground">
                {t("inventory.stock.currentQty")}: <span className="font-semibold text-foreground">{item?.currentQty ?? 0}</span>
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>{t("inventory.stock.adjustmentType")}</Label>
                <Select value={adjustmentType} onValueChange={(value) => setAdjustmentType(value as typeof adjustmentType)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="increase">{t("inventory.stock.increase")}</SelectItem>
                    <SelectItem value="decrease">{t("inventory.stock.decrease")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="stock-adjustment-qty">{t("inventory.stock.qty")}</Label>
                <Input
                  id="stock-adjustment-qty"
                  type="number"
                  min="0"
                  step="1"
                  className="mt-1.5"
                  value={qty}
                  onChange={(event) => setQty(event.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="stock-adjustment-reason">{t("inventory.stock.reason")}</Label>
                <Input
                  id="stock-adjustment-reason"
                  className="mt-1.5"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={t("inventory.stock.reasonPlaceholder")}
                />
              </div>
              <div>
                <Label htmlFor="stock-adjustment-date">{t("inventory.stock.effectiveDate")}</Label>
                <Input
                  id="stock-adjustment-date"
                  type="date"
                  className="mt-1.5"
                  value={effectiveDate}
                  onChange={(event) => setEffectiveDate(event.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="stock-adjustment-notes">{t("inventory.stock.notes")}</Label>
                <Textarea
                  id="stock-adjustment-notes"
                  className="mt-1.5 min-h-[120px]"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder={t("inventory.stock.notesPlaceholder")}
                />
              </div>
            </div>

            {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border bg-card px-6 py-3.5">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
              {t("common.cancel")}
            </Button>
            <Button
              className="border-0 bg-gradient-brand text-primary-foreground shadow-brand"
              onClick={() => void submit()}
              disabled={submitting || !item}
            >
              {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {t("inventory.actions.saveAdjustment")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ProcessingDialog
        open={submitting}
        title={t("inventory.processing.savingStockAdjustment")}
        message={t("inventory.processing.stockAdjustmentMessage")}
      />
    </>
  );
};

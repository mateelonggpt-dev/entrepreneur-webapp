import { useEffect, useState } from "react";
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
      setError("Adjustment qty must be greater than zero.");
      return;
    }
    if (!reason.trim()) {
      setError("Adjustment reason is required.");
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
      toast.success(`Stock updated for ${item.sku}`, {
        description:
          adjustmentType === "increase"
            ? `${numericQty} unit(s) were added to inventory.`
            : `${numericQty} unit(s) were deducted from inventory.`,
      });
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to adjust stock.";
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
              <h2 className="font-display text-lg font-bold leading-tight">Stock Adjustment</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Record a controlled inventory increase or decrease for the selected SKU.
              </p>
            </div>
          </div>

          <div className="space-y-4 bg-background px-6 py-5">
            <div className="rounded-xl border border-border/60 bg-secondary/20 p-4 text-sm">
              <p className="font-semibold">{item?.name ?? "No product selected"}</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{item?.sku ?? "-"}</p>
              <p className="mt-2 text-muted-foreground">
                Current qty: <span className="font-semibold text-foreground">{item?.currentQty ?? 0}</span>
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Adjustment type</Label>
                <Select value={adjustmentType} onValueChange={(value) => setAdjustmentType(value as typeof adjustmentType)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="increase">Increase</SelectItem>
                    <SelectItem value="decrease">Decrease</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="stock-adjustment-qty">Qty</Label>
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
                <Label htmlFor="stock-adjustment-reason">Reason</Label>
                <Input
                  id="stock-adjustment-reason"
                  className="mt-1.5"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Cycle count, damage, opening correction..."
                />
              </div>
              <div>
                <Label htmlFor="stock-adjustment-date">Effective date</Label>
                <Input
                  id="stock-adjustment-date"
                  type="date"
                  className="mt-1.5"
                  value={effectiveDate}
                  onChange={(event) => setEffectiveDate(event.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="stock-adjustment-notes">Notes</Label>
                <Textarea
                  id="stock-adjustment-notes"
                  className="mt-1.5 min-h-[120px]"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional audit note for the adjustment history."
                />
              </div>
            </div>

            {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border bg-card px-6 py-3.5">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              className="border-0 bg-gradient-brand text-primary-foreground shadow-brand"
              onClick={() => void submit()}
              disabled={submitting || !item}
            >
              {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Save Adjustment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ProcessingDialog
        open={submitting}
        title="Saving stock adjustment..."
        message="The movement log and inventory balance are being updated in the backend."
      />
    </>
  );
};

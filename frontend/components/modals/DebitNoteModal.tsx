import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProcessingDialog } from "./ProcessingDialog";
import { createDocument, fetchInvoiceDetail } from "@/lib/api";
import { useAppData } from "@/lib/app-data";
import { getLocalDateInputValue } from "@/lib/sales";
import { fmtTHB } from "@/lib/demo-data";
import type { DocumentLine, Invoice, SalesDocumentRecord } from "@/lib/types";
import { ArrowUpCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DOCUMENT_FORM_MODELS } from "@/components/documents/form";

type AdjustmentLine = {
  id: string;
  desc: string;
  selected: boolean;
  qty: number;
  oldPrice: number;
  newPrice: number;
  tax: number;
};

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  sourceInvoiceId?: string;
  onCreated?: (debitNote: SalesDocumentRecord) => void;
}

const createManualAdjustment = (): AdjustmentLine => ({
  id: "manual-1",
  desc: "",
  selected: true,
  qty: 1,
  oldPrice: 0,
  newPrice: 0,
  tax: 7,
});

const lineToAdjustment = (line: DocumentLine): AdjustmentLine => ({
  id: line.id,
  desc: line.desc,
  selected: false,
  qty: line.qty,
  oldPrice: line.price,
  newPrice: line.price,
  tax: line.tax,
});

export const DebitNoteModal = ({
  open,
  onOpenChange,
  sourceInvoiceId,
  onCreated,
}: Props) => {
  const formModel = DOCUMENT_FORM_MODELS.debit_note;
  const { data, refresh } = useAppData();
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("standalone");
  const [customer, setCustomer] = useState("");
  const [reason, setReason] = useState("");
  const [stockCutBehavior, setStockCutBehavior] = useState<"follow_policy" | "cut_stock" | "no_stock_cut">("follow_policy");
  const [adjustments, setAdjustments] = useState<AdjustmentLine[]>([createManualAdjustment()]);
  const [sourceInvoice, setSourceInvoice] = useState<Invoice | null>(null);
  const [date, setDate] = useState(getLocalDateInputValue());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const initialInvoiceId = sourceInvoiceId ?? "standalone";
    const initialInvoice = data.invoices.find((invoice) => invoice.id === sourceInvoiceId) ?? null;

    setSelectedInvoiceId(initialInvoiceId);
    setSourceInvoice(initialInvoice);
    setCustomer(initialInvoice?.customer ?? data.customers[0]?.name ?? "");
    setReason("");
    setStockCutBehavior("follow_policy");
    setAdjustments(
      initialInvoice?.lines?.length
        ? initialInvoice.lines.map(lineToAdjustment)
        : [createManualAdjustment()]
    );
    setDate(getLocalDateInputValue());
    setSubmitting(false);
  }, [data.customers, data.invoices, open, sourceInvoiceId]);

  useEffect(() => {
    if (!open || selectedInvoiceId === "standalone") {
      return;
    }

    void fetchInvoiceDetail(selectedInvoiceId)
      .then((invoice) => {
        setSourceInvoice(invoice);
        setCustomer(invoice.customer);
        setAdjustments(invoice.lines?.length ? invoice.lines.map(lineToAdjustment) : [createManualAdjustment()]);
      })
      .catch(() => {
        const fallback = data.invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null;
        setSourceInvoice(fallback);
      });
  }, [data.invoices, open, selectedInvoiceId]);

  useEffect(() => {
    if (selectedInvoiceId !== "standalone") {
      return;
    }

    setSourceInvoice(null);
    setAdjustments((current) => (current.length > 0 ? current : [createManualAdjustment()]));
  }, [selectedInvoiceId]);

  const selectedAdjustments = useMemo(
    () =>
      adjustments.filter(
        (line) => line.selected && line.qty > 0 && line.newPrice > line.oldPrice && line.desc.trim()
      ),
    [adjustments]
  );

  const adjustmentTotal = useMemo(
    () =>
      Number(
        selectedAdjustments
          .reduce(
            (sum, line) =>
              sum + (line.newPrice - line.oldPrice) * line.qty * (1 + line.tax / 100),
            0
          )
          .toFixed(2)
      ),
    [selectedAdjustments]
  );

  const sourceTotal = sourceInvoice?.amount ?? 0;
  const adjustedTotal = sourceTotal + adjustmentTotal;

  const updateAdjustment = (lineId: string, patch: Partial<AdjustmentLine>) => {
    setAdjustments((current) =>
      current.map((line) => (line.id === lineId ? { ...line, ...patch } : line))
    );
  };

  const addManualLine = () => {
    setAdjustments((current) => [
      ...current,
      {
        ...createManualAdjustment(),
        id: `manual-${current.length + 1}`,
      },
    ]);
  };

  const removeManualLine = (lineId: string) => {
    setAdjustments((current) =>
      current.length > 1 ? current.filter((line) => line.id !== lineId) : current
    );
  };

  const handleSubmit = async () => {
    if (!customer) {
      toast.error("Please select a customer.");
      return;
    }

    if (!reason.trim()) {
      toast.error("Please add a reason for the debit note.");
      return;
    }

    if (selectedAdjustments.length === 0 || adjustmentTotal <= 0) {
      toast.error("Select at least one line with an increased price.");
      return;
    }

    setSubmitting(true);

    try {
      const created = (await createDocument("debit_note", {
        customer,
        date,
        due: date,
        amount: adjustmentTotal,
        currency: sourceInvoice?.currency ?? "THB",
        status: "draft",
        documentVariant:
          selectedInvoiceId === "standalone"
            ? "standalone-adjustment"
            : "invoice-adjustment",
        relatedInvoice: selectedInvoiceId !== "standalone" ? selectedInvoiceId : undefined,
        sourceDocumentId: selectedInvoiceId !== "standalone" ? selectedInvoiceId : undefined,
        sourceDocumentType: selectedInvoiceId !== "standalone" ? "invoice" : undefined,
        linkedDocumentIds: selectedInvoiceId !== "standalone" ? [selectedInvoiceId] : [],
        stockCutBehavior,
        reason,
        notes:
          selectedInvoiceId !== "standalone"
            ? `Debit note linked to invoice ${selectedInvoiceId}.`
            : "Standalone debit note.",
        lines: selectedAdjustments.map((line) => ({
          id: line.id,
          desc: `${line.desc} (debit adjustment)`,
          qty: line.qty,
          price: Number((line.newPrice - line.oldPrice).toFixed(2)),
          tax: line.tax,
        })),
        timeline: [
          {
            who: "Sales",
            what:
              selectedInvoiceId !== "standalone"
                ? `created debit note from ${selectedInvoiceId}`
                : "created standalone debit note",
            time: date,
            type: "debit_note",
            amount: adjustmentTotal,
          },
        ],
      })) as SalesDocumentRecord;

      await refresh();
      onCreated?.(created);
      onOpenChange(false);
      toast.success(`Debit note ${created.id} created`, {
        description:
          selectedInvoiceId !== "standalone"
            ? `Adjusted total for ${selectedInvoiceId} is now ${fmtTHB(adjustedTotal)}.`
            : "Stored as a standalone adjustment.",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create debit note.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl gap-0 overflow-hidden p-0">
          <div className="flex items-start gap-3 border-b border-border bg-card px-6 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-brand text-primary-foreground shadow-brand">
              <ArrowUpCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold leading-tight">{formModel.createTitle}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formModel.description}
              </p>
            </div>
          </div>

          <div className="grid gap-6 bg-background px-6 py-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{formModel.sourceDocumentLabel}</Label>
                  <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standalone">Standalone debit note</SelectItem>
                      {data.invoices.map((invoice) => (
                        <SelectItem key={invoice.id} value={invoice.id}>
                          {invoice.id} - {invoice.customer}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{formModel.partyLabel}</Label>
                  <Select value={customer} onValueChange={setCustomer}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {data.customers.map((customerOption) => (
                        <SelectItem key={customerOption.id} value={customerOption.name}>
                          {customerOption.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="debit-date">{formModel.dateLabel}</Label>
                  <Input
                    id="debit-date"
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Stock cut behavior</Label>
                  <Select
                    value={stockCutBehavior}
                    onValueChange={(value) =>
                      setStockCutBehavior(value as "follow_policy" | "cut_stock" | "no_stock_cut")
                    }
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="follow_policy">Follow policy</SelectItem>
                      <SelectItem value="cut_stock">Cut stock</SelectItem>
                      <SelectItem value="no_stock_cut">No stock cut</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-border/60 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Adjustment lines</p>
                    <p className="text-xs text-muted-foreground">
                      Select source rows and increase price or add standalone adjustments.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={addManualLine}>
                    Add line
                  </Button>
                </div>

                <div className="grid grid-cols-[40px_1.4fr_0.6fr_0.7fr_0.7fr_0.4fr] gap-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <span />
                  <span>Description</span>
                  <span>Qty</span>
                  <span>Current</span>
                  <span>New</span>
                  <span />
                </div>

                {adjustments.map((line) => (
                  <div
                    key={line.id}
                    className="grid grid-cols-[40px_1.4fr_0.6fr_0.7fr_0.7fr_0.4fr] gap-3"
                  >
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={line.selected}
                        onCheckedChange={(value) =>
                          updateAdjustment(line.id, { selected: Boolean(value) })
                        }
                      />
                    </div>
                    <Input
                      value={line.desc}
                      onChange={(event) => updateAdjustment(line.id, { desc: event.target.value })}
                    />
                    <Input
                      type="number"
                      min={0}
                      value={line.qty}
                      onChange={(event) =>
                        updateAdjustment(line.id, { qty: Number(event.target.value || 0) })
                      }
                    />
                    <Input
                      type="number"
                      min={0}
                      value={line.oldPrice}
                      onChange={(event) =>
                        updateAdjustment(line.id, { oldPrice: Number(event.target.value || 0) })
                      }
                    />
                    <Input
                      type="number"
                      min={0}
                      value={line.newPrice}
                      onChange={(event) =>
                        updateAdjustment(line.id, { newPrice: Number(event.target.value || 0) })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeManualLine(line.id)}
                      disabled={adjustments.length === 1}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>

              <div>
                <Label htmlFor="debit-reason">{formModel.notesLabel}</Label>
                <Textarea
                  id="debit-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="mt-1.5 min-h-[120px]"
                  placeholder="Explain the adjustment, rate change, or stock reason..."
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-secondary/30 p-4">
                <h3 className="font-display font-semibold">Accounting summary</h3>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Source total</dt>
                    <dd className="tabular-nums">{fmtTHB(sourceTotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{formModel.totalLabel}</dt>
                    <dd className="tabular-nums">{fmtTHB(adjustmentTotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Stock policy</dt>
                    <dd>{stockCutBehavior.replace(/_/g, " ")}</dd>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2 font-semibold">
                    <dt>Adjusted total</dt>
                    <dd className="tabular-nums">{fmtTHB(adjustedTotal || adjustmentTotal)}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border bg-card px-6 py-3.5">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              className="border-0 bg-gradient-brand text-primary-foreground shadow-brand"
              onClick={() => void handleSubmit()}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {formModel.createButtonLabel}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ProcessingDialog
        open={submitting}
        title="Creating debit note..."
        message="Saving the debit note, stock policy, and linked source information."
      />
    </>
  );
};

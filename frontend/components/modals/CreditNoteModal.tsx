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
import type { Invoice, SalesDocumentRecord } from "@/lib/types";
import { ArrowDownCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DOCUMENT_FORM_MODELS } from "@/components/documents/form";

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  sourceInvoiceId?: string;
  onCreated?: (creditNote: SalesDocumentRecord) => void;
}

export const CreditNoteModal = ({
  open,
  onOpenChange,
  sourceInvoiceId,
  onCreated,
}: Props) => {
  const formModel = DOCUMENT_FORM_MODELS.credit_note;
  const { data, refresh } = useAppData();
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("standalone");
  const [customer, setCustomer] = useState("");
  const [reason, setReason] = useState("");
  const [caseType, setCaseType] = useState<"normal" | "closed">("normal");
  const [manualAmount, setManualAmount] = useState(0);
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
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
    setCaseType("normal");
    setManualAmount(initialInvoice?.amount ?? 0);
    setSelectedLineIds(initialInvoice?.lines?.map((line) => line.id) ?? []);
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
        setManualAmount(invoice.amount);
        setSelectedLineIds(invoice.lines?.map((line) => line.id) ?? []);
      })
      .catch(() => {
        const fallback = data.invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null;
        setSourceInvoice(fallback);
      });
  }, [data.invoices, open, selectedInvoiceId]);

  const sourceLines = useMemo(() => sourceInvoice?.lines ?? [], [sourceInvoice?.lines]);

  const selectedLines = useMemo(
    () => sourceLines.filter((line) => selectedLineIds.includes(line.id)),
    [selectedLineIds, sourceLines]
  );

  const calculatedAmount = useMemo(() => {
    if (selectedInvoiceId === "standalone") {
      return manualAmount;
    }

    if (selectedLines.length === 0) {
      return manualAmount;
    }

    return Number(
      selectedLines
        .reduce(
          (sum, line) => sum + (line.amount || line.qty * line.price) * (1 + line.tax / 100),
          0
        )
        .toFixed(2)
    );
  }, [manualAmount, selectedInvoiceId, selectedLines]);

  const toggleLine = (lineId: string) => {
    setSelectedLineIds((current) =>
      current.includes(lineId)
        ? current.filter((id) => id !== lineId)
        : [...current, lineId]
    );
  };

  const handleSubmit = async () => {
    if (!customer) {
      toast.error("Please select a customer.");
      return;
    }

    if (!reason.trim()) {
      toast.error("Please add a reason for the credit note.");
      return;
    }

    if (calculatedAmount <= 0) {
      toast.error("Credit note amount must be greater than zero.");
      return;
    }

    setSubmitting(true);

    try {
      const lines =
        selectedInvoiceId === "standalone" || selectedLines.length === 0
          ? [
              {
                id: "1",
                desc: reason.trim(),
                qty: 1,
                price: calculatedAmount,
                tax: 0,
              },
            ]
          : selectedLines.map((line) => ({
              id: line.id,
              desc: `${line.desc} (credit)`,
              qty: line.qty,
              price: line.price,
              tax: line.tax,
            }));

      const created = (await createDocument("credit_note", {
        customer,
        date,
        due: date,
        amount: calculatedAmount,
        currency: sourceInvoice?.currency ?? "THB",
        status: caseType === "closed" ? "approved" : "draft",
        documentVariant:
          caseType === "closed" ? "paid-adjustment-credit" : "invoice-credit",
        relatedInvoice: selectedInvoiceId !== "standalone" ? selectedInvoiceId : undefined,
        sourceDocumentId: selectedInvoiceId !== "standalone" ? selectedInvoiceId : undefined,
        sourceDocumentType: selectedInvoiceId !== "standalone" ? "invoice" : undefined,
        linkedDocumentIds: selectedInvoiceId !== "standalone" ? [selectedInvoiceId] : [],
        reason,
        notes:
          selectedInvoiceId !== "standalone"
            ? `Credit note linked to invoice ${selectedInvoiceId}.`
            : "Standalone credit note.",
        lines,
        timeline: [
          {
            who: "Sales",
            what:
              selectedInvoiceId !== "standalone"
                ? `created credit note from ${selectedInvoiceId}`
                : "created standalone credit note",
            time: date,
            type: "credit_note",
            amount: calculatedAmount,
          },
        ],
      })) as SalesDocumentRecord;

      await refresh();
      onCreated?.(created);
      onOpenChange(false);
      toast.success(`Credit note ${created.id} created`, {
        description:
          selectedInvoiceId !== "standalone"
            ? `Linked to invoice ${selectedInvoiceId}.`
            : "Stored as a standalone adjustment.",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create credit note.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl gap-0 overflow-hidden p-0">
          <div className="flex items-start gap-3 border-b border-border bg-card px-6 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-brand text-primary-foreground shadow-brand">
              <ArrowDownCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold leading-tight">{formModel.createTitle}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formModel.description}
              </p>
            </div>
          </div>

          <div className="grid gap-6 bg-background px-6 py-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{formModel.sourceDocumentLabel}</Label>
                  <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standalone">Standalone credit note</SelectItem>
                      {data.invoices.map((invoice) => (
                        <SelectItem key={invoice.id} value={invoice.id}>
                          {invoice.id} - {invoice.customer}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Case type</Label>
                  <Select value={caseType} onValueChange={(value) => setCaseType(value as "normal" | "closed")}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal invoice credit</SelectItem>
                      <SelectItem value="closed">Already-paid / closed case</SelectItem>
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
                  <Label htmlFor="credit-date">{formModel.dateLabel}</Label>
                  <Input
                    id="credit-date"
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>

              {selectedInvoiceId !== "standalone" && sourceLines.length > 0 ? (
                <div className="rounded-2xl border border-border/60">
                  <div className="grid grid-cols-[40px_1.2fr_0.7fr_0.7fr] gap-3 border-b border-border/60 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <span />
                    <span>Line</span>
                    <span>Qty</span>
                    <span className="text-right">Amount</span>
                  </div>
                  <div className="max-h-[260px] overflow-y-auto">
                    {sourceLines.map((line) => {
                      const lineAmount = (line.amount || line.qty * line.price) * (1 + line.tax / 100);
                      return (
                        <label
                          key={line.id}
                          className="grid grid-cols-[40px_1.2fr_0.7fr_0.7fr] gap-3 border-b border-border/40 px-4 py-3 text-sm last:border-0"
                        >
                          <Checkbox
                            checked={selectedLineIds.includes(line.id)}
                            onCheckedChange={() => toggleLine(line.id)}
                          />
                          <span>{line.desc}</span>
                          <span className="text-muted-foreground">{line.qty}</span>
                          <span className="text-right font-semibold tabular-nums">
                            {fmtTHB(lineAmount)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div>
                  <Label htmlFor="credit-amount">{formModel.totalLabel}</Label>
                  <Input
                    id="credit-amount"
                    type="number"
                    min={0}
                    value={manualAmount}
                    onChange={(event) => setManualAmount(Number(event.target.value || 0))}
                    className="mt-1.5"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="credit-reason">{formModel.notesLabel}</Label>
                <Textarea
                  id="credit-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="mt-1.5 min-h-[120px]"
                  placeholder="Explain why the credit note is required..."
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-secondary/30 p-4">
                <h3 className="font-display font-semibold">Accounting summary</h3>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{formModel.sourceDocumentLabel}</dt>
                    <dd>{selectedInvoiceId === "standalone" ? "None" : selectedInvoiceId}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Case type</dt>
                    <dd>{caseType === "closed" ? "Closed / paid case" : "Normal credit"}</dd>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2 font-semibold">
                    <dt>{formModel.totalLabel}</dt>
                    <dd className="tabular-nums">{fmtTHB(calculatedAmount)}</dd>
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
        title="Creating credit note..."
        message="Saving the credit note and linking it to the source invoice when applicable."
      />
    </>
  );
};

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProcessingDialog } from "./ProcessingDialog";
import { createDocument } from "@/lib/api";
import { useAppData } from "@/lib/app-data";
import { calculateReceiptFooter, getEligibleReceiptInvoices, summarizeSelectedInvoices } from "@/lib/sales";
import { fmtTHB } from "@/lib/demo-data";
import { Loader2, ReceiptText } from "lucide-react";
import { toast } from "sonner";

const EMPTY_INVOICE_IDS: string[] = [];

type SplitReceive = {
  id: string;
  amount: number;
  paymentMethod: string;
  receivedAt: string;
  note?: string;
};

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  sourceInvoiceIds?: string[];
  sourceBillingId?: string;
}

export const CombinedReceiptModal = ({
  open,
  onOpenChange,
  sourceInvoiceIds,
  sourceBillingId = "",
}: Props) => {
  const { data, refresh } = useAppData();
  const resolvedSourceInvoiceIds = sourceInvoiceIds ?? EMPTY_INVOICE_IDS;
  const [mode, setMode] = useState<"invoices" | "billing">("invoices");
  const [customer, setCustomer] = useState("");
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [selectedBillingId, setSelectedBillingId] = useState("");
  const [receiptOnlyHeader, setReceiptOnlyHeader] = useState(false);
  const [specialDiscount, setSpecialDiscount] = useState(0);
  const [commission, setCommission] = useState(0);
  const [serviceFee, setServiceFee] = useState(0);
  const [rounding, setRounding] = useState(0);
  const [splits, setSplits] = useState<SplitReceive[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const initialInvoices = data.invoices.filter((invoice) => resolvedSourceInvoiceIds.includes(invoice.id));
    const initialBilling = data.billings.find((billing) => billing.id === sourceBillingId);
    const initialCustomer =
      initialInvoices[0]?.customer ??
      initialBilling?.party ??
      data.customers[0]?.name ??
      "";

    setMode(sourceBillingId ? "billing" : "invoices");
    setCustomer(initialCustomer);
    setSelectedInvoiceIds(resolvedSourceInvoiceIds);
    setSelectedBillingId(sourceBillingId);
    setReceiptOnlyHeader(false);
    setSpecialDiscount(0);
    setCommission(0);
    setServiceFee(0);
    setRounding(0);
    setSplits([
      {
        id: "split-1",
        amount: initialInvoices.length ? summarizeSelectedInvoices(data, resolvedSourceInvoiceIds) : initialBilling?.amount ?? 0,
        paymentMethod: "Bank transfer",
        receivedAt: "2026-04-19",
      },
    ]);
    setSubmitting(false);
  }, [data, open, resolvedSourceInvoiceIds, sourceBillingId]);

  const eligibleInvoices = useMemo(
    () => getEligibleReceiptInvoices(data, customer),
    [customer, data]
  );

  const eligibleBillings = useMemo(
    () =>
      data.billings.filter(
        (billing) =>
          (!customer || billing.party === customer) &&
          ["draft", "pending_bill", "billed"].includes(billing.status)
      ),
    [customer, data.billings]
  );

  const baseAmount =
    mode === "billing"
      ? eligibleBillings.find((billing) => billing.id === selectedBillingId)?.amount ?? 0
      : summarizeSelectedInvoices(data, selectedInvoiceIds);

  const receiptAdjustments = [
    { id: "adj-discount", type: "special_discount" as const, amount: specialDiscount },
    { id: "adj-commission", type: "commission" as const, amount: commission },
    { id: "adj-service", type: "service_fee" as const, amount: serviceFee },
    { id: "adj-rounding", type: "rounding" as const, amount: rounding },
  ].filter((item) => item.amount !== 0);

  const { summary, netReceivable } = calculateReceiptFooter(baseAmount, receiptAdjustments);
  const totalReceived = splits.reduce((sum, split) => sum + split.amount, 0);

  const toggleInvoice = (invoiceId: string) => {
    setSelectedInvoiceIds((current) =>
      current.includes(invoiceId)
        ? current.filter((id) => id !== invoiceId)
        : [...current, invoiceId]
    );
  };

  const updateSplit = (id: string, patch: Partial<SplitReceive>) => {
    setSplits((current) => current.map((split) => (split.id === id ? { ...split, ...patch } : split)));
  };

  const addSplit = () => {
    setSplits((current) => [
      ...current,
      {
        id: `split-${current.length + 1}`,
        amount: 0,
        paymentMethod: "Bank transfer",
        receivedAt: "2026-04-19",
      },
    ]);
  };

  const removeSplit = (id: string) => {
    setSplits((current) => current.filter((split) => split.id !== id));
  };

  const handleSubmit = async () => {
    if (!customer) {
      toast.error("Please select a customer.");
      return;
    }

    if (mode === "invoices" && selectedInvoiceIds.length === 0) {
      toast.error("Select at least one invoice.");
      return;
    }

    if (mode === "billing" && !selectedBillingId) {
      toast.error("Select a billing document.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await createDocument("receipt", {
        customer,
        date: "2026-04-19",
        relatedInvoice: mode === "invoices" && selectedInvoiceIds.length === 1 ? selectedInvoiceIds[0] : undefined,
        sourceInvoiceIds: mode === "invoices" ? selectedInvoiceIds : [],
        sourceBillingId: mode === "billing" ? selectedBillingId : undefined,
        linkedDocumentIds: mode === "billing" ? [selectedBillingId] : selectedInvoiceIds,
        amount: totalReceived,
        paymentMethod: splits[0]?.paymentMethod ?? "Bank transfer",
        status: totalReceived >= netReceivable ? "paid" : "partial",
        documentVariant: receiptOnlyHeader ? "receipt-only" : "tax-receipt",
        receiptAdjustments,
        splitReceives: splits,
        netReceivable,
        paymentSummary: {
          received: totalReceived,
          remaining: Math.max(netReceivable - totalReceived, 0),
          netReceivable,
        },
        notes:
          mode === "billing"
            ? `Combined receipt from billing ${selectedBillingId}`
            : `Combined receipt from ${selectedInvoiceIds.length} invoice(s)`,
        timeline: [
          {
            who: "Cashier",
            what:
              mode === "billing"
                ? `created combined receipt from billing ${selectedBillingId}`
                : `created combined receipt from ${selectedInvoiceIds.length} invoice(s)`,
            time: "2026-04-19",
            type: "receipt",
            amount: totalReceived,
          },
        ],
      });

      await refresh();
      onOpenChange(false);
      toast.success(`Receipt ${created.id} created`, {
        description: "Receipt adjustments and split receives were stored.",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create receipt.");
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
              <ReceiptText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold leading-tight">Create Combined Receipt</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Receive against multiple invoices or a billing document with adjustment footer support.
              </p>
            </div>
          </div>

          <div className="grid gap-6 bg-background px-6 py-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Source mode</Label>
                  <Select value={mode} onValueChange={(value) => setMode(value as "invoices" | "billing")}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="invoices">Invoices</SelectItem>
                      <SelectItem value="billing">Billing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Customer</Label>
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
              </div>

              {mode === "invoices" ? (
                <div className="rounded-2xl border border-border/60">
                  <div className="grid grid-cols-[40px_1fr_0.8fr] gap-3 border-b border-border/60 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <span />
                    <span>Invoice</span>
                    <span className="text-right">Amount</span>
                  </div>
                  <div className="max-h-[220px] overflow-y-auto">
                    {eligibleInvoices.map((invoice) => (
                      <label key={invoice.id} className="grid grid-cols-[40px_1fr_0.8fr] items-center gap-3 border-b border-border/40 px-4 py-3 text-sm last:border-0">
                        <Checkbox checked={selectedInvoiceIds.includes(invoice.id)} onCheckedChange={() => toggleInvoice(invoice.id)} />
                        <span>
                          <span className="font-mono text-xs font-semibold text-primary">{invoice.id}</span>
                          <span className="ml-2 text-muted-foreground">{invoice.customer}</span>
                        </span>
                        <span className="text-right font-semibold tabular-nums">{fmtTHB(invoice.amount)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <Label>Billing document</Label>
                  <Select value={selectedBillingId} onValueChange={setSelectedBillingId}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select billing document" />
                    </SelectTrigger>
                    <SelectContent>
                      {eligibleBillings.map((billing) => (
                        <SelectItem key={billing.id} value={billing.id}>
                          {billing.id} · {billing.party} · {fmtTHB(billing.amount)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-border/60 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Receipt-only header mode</p>
                      <p className="text-xs text-muted-foreground">Use a separate receipt-only header instead of tax receipt wording.</p>
                    </div>
                    <Switch checked={receiptOnlyHeader} onCheckedChange={setReceiptOnlyHeader} />
                  </div>
                </div>
                <div className="rounded-xl border border-border/60 p-4">
                  <p className="text-sm font-semibold">Base receivable</p>
                  <p className="mt-2 text-lg font-bold tabular-nums">{fmtTHB(baseAmount)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="special-discount">Special discount</Label>
                  <Input id="special-discount" type="number" value={specialDiscount} onChange={(event) => setSpecialDiscount(Number(event.target.value || 0))} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="commission">Commission / revenue share</Label>
                  <Input id="commission" type="number" value={commission} onChange={(event) => setCommission(Number(event.target.value || 0))} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="service-fee">Service fee</Label>
                  <Input id="service-fee" type="number" value={serviceFee} onChange={(event) => setServiceFee(Number(event.target.value || 0))} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="rounding">Rounding</Label>
                  <Input id="rounding" type="number" value={rounding} onChange={(event) => setRounding(Number(event.target.value || 0))} className="mt-1.5" />
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-border/60 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Split receive / partial receive</p>
                    <p className="text-xs text-muted-foreground">Add multiple settlement lines when a receipt is collected in parts.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={addSplit}>
                    Add Split
                  </Button>
                </div>
                {splits.map((split) => (
                  <div key={split.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3">
                    <Input type="number" value={split.amount} onChange={(event) => updateSplit(split.id, { amount: Number(event.target.value || 0) })} />
                    <Select value={split.paymentMethod} onValueChange={(value) => updateSplit(split.id, { paymentMethod: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Bank transfer">Bank transfer</SelectItem>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Cheque">Cheque</SelectItem>
                        <SelectItem value="Credit Card">Credit Card</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="date" value={split.receivedAt} onChange={(event) => updateSplit(split.id, { receivedAt: event.target.value })} />
                    <Button variant="ghost" size="sm" onClick={() => removeSplit(split.id)} disabled={splits.length === 1}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-secondary/30 p-4">
                <h3 className="font-display font-semibold">Receipt footer summary</h3>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Base receivable</dt>
                    <dd className="tabular-nums">{fmtTHB(baseAmount)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Special discount</dt>
                    <dd className="tabular-nums">-{fmtTHB(summary.specialDiscount)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Commission</dt>
                    <dd className="tabular-nums">-{fmtTHB(summary.commission)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Service fee</dt>
                    <dd className="tabular-nums">+{fmtTHB(summary.serviceFee)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Rounding</dt>
                    <dd className="tabular-nums">{rounding >= 0 ? "+" : ""}{fmtTHB(summary.rounding)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2 font-semibold">
                    <dt>Net receivable</dt>
                    <dd className="tabular-nums">{fmtTHB(netReceivable)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Received</dt>
                    <dd className="tabular-nums">{fmtTHB(totalReceived)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Remaining</dt>
                    <dd className="tabular-nums">{fmtTHB(Math.max(netReceivable - totalReceived, 0))}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border bg-card px-6 py-3.5">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button className="border-0 bg-gradient-brand text-primary-foreground shadow-brand" onClick={() => void handleSubmit()} disabled={submitting}>
              {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Create Receipt
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ProcessingDialog
        open={submitting}
        title="Creating receipt..."
        message="Saving receipt adjustments, split receives, and linked source references."
      />
    </>
  );
};

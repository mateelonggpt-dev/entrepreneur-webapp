import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProcessingDialog } from "./ProcessingDialog";
import { createVendorPayment, updateVendorPayment } from "@/lib/api";
import { useAppData } from "@/lib/app-data";
import { validateChequeLifecycle } from "@/lib/domain/rules";
import { fmtTHB } from "@/lib/demo-data";
import { getDocumentKindFromPayable } from "@/lib/purchases";
import type { PayableSummary, VendorPayment } from "@/lib/types";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  payables: PayableSummary[];
  initialSelection?: string[];
  payment?: VendorPayment | null;
  onSaved?: (payment: VendorPayment) => void;
}

const allocateAmount = (rows: PayableSummary[], amount: number) => {
  let remaining = amount;
  return rows
    .map((row) => {
      if (remaining <= 0) {
        return null;
      }
      const allocated = Math.min(row.remaining, remaining);
      remaining -= allocated;
      return {
        documentId: row.id,
        documentType: getDocumentKindFromPayable(row),
        amount: Number(allocated.toFixed(2)),
      };
    })
    .filter((value): value is { documentId: string; documentType: string; amount: number } => Boolean(value));
};

export const PaymentModal = ({
  open,
  onOpenChange,
  payables,
  initialSelection,
  payment,
  onSaved,
}: Props) => {
  const { data } = useAppData();
  const [paymentMethod, setPaymentMethod] = useState("Bank transfer");
  const [paymentDate, setPaymentDate] = useState("2026-04-19");
  const [amount, setAmount] = useState("0");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [note, setNote] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  const [chequeCutDate, setChequeCutDate] = useState("");
  const [chequeDepositDate, setChequeDepositDate] = useState("");
  const [chequeClearedDate, setChequeClearedDate] = useState("");
  const [autoCreateWht, setAutoCreateWht] = useState(false);
  const [whtRate, setWhtRate] = useState("3");
  const [incomeType, setIncomeType] = useState("service");
  const [filingMonth, setFilingMonth] = useState("2026-04");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPayables = useMemo(() => {
    if (payment?.allocations?.length) {
      const allocationIds = payment.allocations.map((allocation) => allocation.documentId);
      const payableRows = payables.filter((row) => allocationIds.includes(row.id));
      if (payableRows.length === allocationIds.length) {
        return payableRows;
      }

      return allocationIds
        .map((allocationId) => {
          const existing = payableRows.find((row) => row.id === allocationId);
          if (existing) {
            return existing;
          }

          const expense = data.expenses.find((row) => row.id === allocationId);
          if (expense) {
            return {
              id: expense.id,
              sourceType: "expense" as const,
              vendor: expense.vendor,
              date: expense.date,
              due: expense.due || expense.date,
              amount: expense.amount,
              paid: expense.paymentSummary?.paid ?? expense.amount,
              remaining: expense.paymentSummary?.remaining ?? 0,
              currency: expense.currency || "THB",
              status: expense.status,
              paymentStatus: expense.paymentSummary?.status ?? "paid",
              category: expense.category,
              linkedDocumentIds: expense.linkedDocumentIds,
              sourceDocumentId: expense.sourceDocumentId,
            };
          }

          const receive = data.receives.find((row) => row.id === allocationId);
          if (receive) {
            return {
              id: receive.id,
              sourceType: "receive" as const,
              vendor: receive.party,
              date: receive.date,
              due: receive.date,
              amount: receive.amount,
              paid: receive.paymentSummary?.paid ?? receive.amount,
              remaining: receive.paymentSummary?.remaining ?? 0,
              currency: "THB",
              status: receive.status,
              paymentStatus: receive.paymentSummary?.status ?? "paid",
              linkedDocumentIds: receive.linkedDocumentIds,
              sourceDocumentId: receive.sourceDocumentId,
            };
          }

          return null;
        })
        .filter((row): row is PayableSummary => Boolean(row));
    }

    return payables.filter((row) => initialSelection?.includes(row.id));
  }, [data.expenses, data.receives, initialSelection, payables, payment]);

  const selectedVendor = selectedPayables[0]?.vendor ?? payment?.vendor ?? "";
  const totalRemaining = useMemo(
    () => selectedPayables.reduce((sum, row) => sum + row.remaining, 0),
    [selectedPayables]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setPaymentMethod(payment?.paymentMethod ?? "Bank transfer");
    setPaymentDate(payment?.paymentDate ?? "2026-04-19");
    setAmount(String(payment?.amount ?? totalRemaining));
    setAccountName(payment?.accountName ?? data.financeAccounts[0]?.name ?? "");
    setAccountNumber(payment?.accountNumber ?? data.financeAccounts[0]?.number ?? "");
    setNote(payment?.note ?? "");
    setChequeDate(payment?.chequeDate ?? "");
    setChequeCutDate(payment?.chequeCutDate ?? "");
    setChequeDepositDate(payment?.chequeDepositDate ?? "");
    setChequeClearedDate(payment?.chequeClearedDate ?? "");
    setAutoCreateWht(Boolean(payment?.withholdingTaxEnabled));
    setWhtRate(payment?.withholdingTaxAmount ? String((payment.withholdingTaxAmount / Math.max(payment.amount, 1)) * 100) : "3");
    setIncomeType("service");
    setFilingMonth(payment?.paymentDate?.slice(0, 7) ?? "2026-04");
    setError(null);
    setSubmitting(false);
  }, [data.financeAccounts, open, payment, totalRemaining]);

  const handleSubmit = async () => {
    const numericAmount = Number(amount);
    if (!selectedVendor) {
      setError("Select at least one payable document before opening the payment modal.");
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Payment amount must be greater than zero.");
      return;
    }

    if (paymentMethod === "Cheque") {
      const validation = validateChequeLifecycle({
        chequeDate,
        paymentDate,
        cutDate: chequeCutDate,
        depositDate: chequeDepositDate,
        clearedDate: chequeClearedDate,
      });
      if (!validation.valid) {
        setError(validation.message);
        toast.error(validation.message);
        return;
      }
    }

    setError(null);
    setSubmitting(true);

    try {
      const saved = payment
        ? await updateVendorPayment(payment.id, {
            paymentDate,
            paymentMethod,
            paymentStatus: numericAmount >= totalRemaining ? "paid" : "partial",
            note,
            accountName,
            accountNumber,
            chequeDate,
            chequeCutDate,
            chequeDepositDate,
            chequeClearedDate,
          })
        : await createVendorPayment({
            vendor: selectedVendor,
            amount: numericAmount,
            currency: selectedPayables[0]?.currency ?? "THB",
            paymentDate,
            paymentMethod,
            paymentStatus: numericAmount >= totalRemaining ? "paid" : "partial",
            note,
            accountName,
            accountNumber,
            chequeDate,
            chequeCutDate,
            chequeDepositDate,
            chequeClearedDate,
            allocations: allocateAmount(selectedPayables, numericAmount),
            autoCreateWht,
            whtRate: Number(whtRate),
            taxableAmount: numericAmount,
            incomeType,
            filingMonth,
          });

      onSaved?.(saved);
      onOpenChange(false);
      toast.success(payment ? `Payment ${saved.id} updated` : `Payment ${saved.id} recorded`, {
        description: autoCreateWht && !payment ? "Linked withholding tax document created automatically." : "Payable metadata is now synced with the backend.",
      });
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Unable to save payment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0">
          <div className="flex items-start gap-3 border-b border-border bg-card px-6 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-brand text-primary-foreground shadow-brand">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold leading-tight">
                {payment ? "Edit Payment Metadata" : "Record Vendor Payment"}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Support cash, bank transfer, petty cash, and cheque payments with optional WHT creation.
              </p>
            </div>
          </div>

          <div className="grid gap-6 bg-background px-6 py-5 lg:grid-cols-[1fr_0.9fr]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/60 p-4">
                <h3 className="font-display text-sm font-semibold">Payable selection</h3>
                <div className="mt-4 space-y-3">
                  {selectedPayables.map((row) => (
                    <div key={row.id} className="rounded-xl border border-border/50 p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <p className="font-mono text-xs font-semibold text-primary">{row.id}</p>
                        <p className="font-semibold">{fmtTHB(row.remaining)}</p>
                      </div>
                      <p className="mt-1 text-muted-foreground">{row.vendor}</p>
                    </div>
                  ))}
                  {selectedPayables.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No payable rows were selected.</p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Payment date</Label>
                    <Input className="mt-1.5" type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
                  </div>
                  <div>
                    <Label>Amount</Label>
                    <Input
                      className="mt-1.5"
                      type="number"
                      min="0"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      disabled={Boolean(payment)}
                    />
                  </div>
                  <div>
                    <Label>Payment method</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Bank transfer">Bank transfer</SelectItem>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Petty Cash">Petty Cash</SelectItem>
                        <SelectItem value="Cheque">Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Account</Label>
                    <Select
                      value={accountNumber || "none"}
                      onValueChange={(value) => {
                        const selected = data.financeAccounts.find((account) => account.number === value);
                        setAccountNumber(selected?.number ?? "");
                        setAccountName(selected?.name ?? "");
                      }}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {data.financeAccounts.map((account) => (
                          <SelectItem key={account.number} value={account.number}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {paymentMethod === "Cheque" ? (
                    <>
                      <div>
                        <Label>Cheque date</Label>
                        <Input className="mt-1.5" type="date" value={chequeDate} onChange={(event) => setChequeDate(event.target.value)} />
                      </div>
                      <div>
                        <Label>Cheque cut date</Label>
                        <Input className="mt-1.5" type="date" value={chequeCutDate} onChange={(event) => setChequeCutDate(event.target.value)} />
                      </div>
                      <div>
                        <Label>Deposit date</Label>
                        <Input className="mt-1.5" type="date" value={chequeDepositDate} onChange={(event) => setChequeDepositDate(event.target.value)} />
                      </div>
                      <div>
                        <Label>Cleared date</Label>
                        <Input className="mt-1.5" type="date" value={chequeClearedDate} onChange={(event) => setChequeClearedDate(event.target.value)} />
                      </div>
                    </>
                  ) : null}
                  <div className="col-span-2">
                    <Label>Note</Label>
                    <Textarea className="mt-1.5 min-h-[110px]" value={note} onChange={(event) => setNote(event.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-secondary/20 p-4">
                <h3 className="font-display text-sm font-semibold">Summary</h3>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Vendor</dt>
                    <dd>{selectedVendor || "-"}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Open payable</dt>
                    <dd>{fmtTHB(totalRemaining)}</dd>
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-2 font-semibold">
                    <dt>Payment amount</dt>
                    <dd>{fmtTHB(Number(amount) || 0)}</dd>
                  </div>
                </dl>
              </div>

              {!payment ? (
                <div className="rounded-2xl border border-border/60 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-display text-sm font-semibold">Withholding tax</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Optionally create a WHT record from this payment.
                      </p>
                    </div>
                    <Switch checked={autoCreateWht} onCheckedChange={setAutoCreateWht} />
                  </div>
                  {autoCreateWht ? (
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div>
                        <Label>WHT rate (%)</Label>
                        <Input className="mt-1.5" type="number" min="0" value={whtRate} onChange={(event) => setWhtRate(event.target.value)} />
                      </div>
                      <div>
                        <Label>Income type</Label>
                        <Select value={incomeType} onValueChange={setIncomeType}>
                          <SelectTrigger className="mt-1.5">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="service">Service</SelectItem>
                            <SelectItem value="rent">Rent</SelectItem>
                            <SelectItem value="transport">Transport</SelectItem>
                            <SelectItem value="professional_fee">Professional fee</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label>Filing month</Label>
                        <Input className="mt-1.5" type="month" value={filingMonth} onChange={(event) => setFilingMonth(event.target.value)} />
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
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
              {payment ? "Save Payment Metadata" : "Record Payment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ProcessingDialog
        open={submitting}
        title={payment ? "Updating payment metadata..." : "Recording payment..."}
        message="Saving payment allocations and validation data to the backend."
      />
    </>
  );
};

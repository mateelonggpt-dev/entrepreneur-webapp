import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProcessingDialog } from "./ProcessingDialog";
import { createExpense, updateExpense } from "@/lib/api";
import { useAppData } from "@/lib/app-data";
import { getEnabledCurrencies, resolveExchangeRate } from "@/lib/currency";
import type { Expense } from "@/lib/types";
import { Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  expense?: Expense | null;
  seed?: Partial<Expense> | null;
  sourceDocumentId?: string;
  sourceDocumentType?: string;
  onSaved?: (expense: Expense) => void;
}

const CATEGORY_OPTIONS = [
  "Office Supplies",
  "Utilities",
  "Software",
  "Travel",
  "Inventory",
  "Professional Services",
] as const;

export const ExpenseModal = ({
  open,
  onOpenChange,
  expense,
  seed,
  sourceDocumentId,
  sourceDocumentType,
  onSaved,
}: Props) => {
  const { data, refresh } = useAppData();
  const [vendor, setVendor] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORY_OPTIONS)[number]>("Office Supplies");
  const [paymentMethod, setPaymentMethod] = useState("Bank transfer");
  const [status, setStatus] = useState("pending");
  const [date, setDate] = useState("2026-04-19");
  const [due, setDue] = useState("2026-04-19");
  const [amount, setAmount] = useState("0");
  const [currency, setCurrency] = useState("THB");
  const [projectId, setProjectId] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [accountantCategory, setAccountantCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isEditing = Boolean(expense?.id);
  const currencyOptions = useMemo(() => getEnabledCurrencies(data.currencySettings), [data.currencySettings]);
  const selectedProject = data.projects.find((project) => project.id === projectId) ?? null;

  useEffect(() => {
    if (!open) {
      return;
    }

    setVendor(expense?.vendor ?? seed?.vendor ?? data.vendors[0]?.name ?? "");
    setCategory(((expense?.category ?? seed?.category) as (typeof CATEGORY_OPTIONS)[number]) ?? "Office Supplies");
    setPaymentMethod(expense?.paymentMethod ?? seed?.paymentMethod ?? "Bank transfer");
    setStatus(expense?.status ?? seed?.status ?? "pending");
    setDate(expense?.date ?? seed?.date ?? "2026-04-19");
    setDue(expense?.due ?? seed?.due ?? expense?.date ?? seed?.date ?? "2026-04-19");
    setAmount(String(expense?.amount ?? seed?.amount ?? 0));
    setCurrency(expense?.currency ?? seed?.currency ?? data.currencySettings.baseCurrency ?? "THB");
    setProjectId(expense?.projectId ?? seed?.projectId ?? "");
    setReference(expense?.reference ?? seed?.reference ?? "");
    setNotes(expense?.notes ?? seed?.notes ?? "");
    setAccountantCategory(expense?.accountantCategory ?? seed?.accountantCategory ?? "");
    setError(null);
    setSubmitting(false);
  }, [data.currencySettings.baseCurrency, data.vendors, expense, open, seed]);

  const handleSubmit = async () => {
    const numericAmount = Number(amount);
    if (!vendor || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Vendor and amount are required.");
      toast.error("Please complete the expense form.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const payload = {
        vendor,
        category,
        date,
        due,
        amount: numericAmount,
        paymentMethod,
        currency,
        exchangeRate: resolveExchangeRate(data.currencySettings, currency),
        projectId,
        projectName: selectedProject?.name,
        status,
        reference,
        notes,
        accountantCategory,
        linkedDocumentIds:
          sourceDocumentId && !expense?.linkedDocumentIds?.includes(sourceDocumentId)
            ? [sourceDocumentId, ...(expense?.linkedDocumentIds ?? [])]
            : expense?.linkedDocumentIds,
        sourceDocumentId: sourceDocumentId ?? expense?.sourceDocumentId,
        sourceDocumentType: sourceDocumentType ?? expense?.sourceDocumentType,
      };

      const saved = expense ? await updateExpense(expense.id, payload) : await createExpense(payload);
      await refresh();
      onSaved?.(saved);
      onOpenChange(false);
      toast.success(expense ? `Expense ${saved.id} updated` : `Expense ${saved.id} created`, {
        description: `${saved.vendor} is now part of the payable workflow.`,
      });
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Unable to save expense.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
          <div className="flex items-start gap-3 border-b border-border bg-card px-6 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-brand text-primary-foreground shadow-brand">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold leading-tight">
                {isEditing ? "Edit Expense" : "New Expense"}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Record an operating expense with linked documents, accountant category, and payment-ready metadata.
              </p>
            </div>
          </div>

          <div className="space-y-4 bg-background px-6 py-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Vendor</Label>
                <Select value={vendor} onValueChange={setVendor}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {data.vendors.map((item) => (
                      <SelectItem key={item.id} value={item.name}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Category</Label>
                <Select value={category} onValueChange={(value) => setCategory(value as (typeof CATEGORY_OPTIONS)[number])}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date</Label>
                <Input className="mt-1.5" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </div>
              <div>
                <Label>Due date</Label>
                <Input className="mt-1.5" type="date" value={due} onChange={(event) => setDue(event.target.value)} />
              </div>
              <div>
                <Label>Amount</Label>
                <Input className="mt-1.5" type="number" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} />
              </div>
              <div>
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencyOptions.map((currencyCode) => (
                      <SelectItem key={currencyCode} value={currencyCode}>
                        {currencyCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    <SelectItem value="Card">Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Project</Label>
                <Select value={projectId || "__none__"} onValueChange={(value) => setProjectId(value === "__none__" ? "" : value)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Optional project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No project</SelectItem>
                    {data.projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.code ? `${project.code} - ${project.name}` : project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reference</Label>
                <Input className="mt-1.5" value={reference} onChange={(event) => setReference(event.target.value)} />
              </div>
              {data.policySummary.documents.accountantExpenseCategory ? (
                <div>
                  <Label>Accountant category</Label>
                  <Input className="mt-1.5" value={accountantCategory} onChange={(event) => setAccountantCategory(event.target.value)} placeholder="Optional accounting bucket" />
                </div>
              ) : null}
              <div className="col-span-2">
                <Label>Notes</Label>
                <Textarea className="mt-1.5 min-h-[110px]" value={notes} onChange={(event) => setNotes(event.target.value)} />
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
              onClick={() => void handleSubmit()}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {isEditing ? "Save Expense" : "Create Expense"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ProcessingDialog
        open={submitting}
        title={isEditing ? "Saving expense..." : "Creating expense..."}
        message="Saving the expense to the backend."
      />
    </>
  );
};

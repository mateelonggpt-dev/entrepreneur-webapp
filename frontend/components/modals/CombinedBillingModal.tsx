import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProcessingDialog } from "./ProcessingDialog";
import { createDocument } from "@/lib/api";
import { useAppData } from "@/lib/app-data";
import { fmtTHB } from "@/lib/demo-data";
import { Loader2, ReceiptText } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  preselectedInvoiceIds?: string[];
}

export const CombinedBillingModal = ({ open, onOpenChange, preselectedInvoiceIds = [] }: Props) => {
  const { data, refresh } = useAppData();
  const [customer, setCustomer] = useState("");
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const preselectedInvoices = data.invoices.filter((invoice) => preselectedInvoiceIds.includes(invoice.id));
    setCustomer(preselectedInvoices[0]?.customer ?? data.customers[0]?.name ?? "");
    setSelectedInvoiceIds(preselectedInvoiceIds);
    setSubmitting(false);
  }, [data.customers, data.invoices, open, preselectedInvoiceIds]);

  const eligibleInvoices = useMemo(
    () =>
      data.invoices.filter(
        (invoice) =>
          (!customer || invoice.customer === customer) &&
          !["paid", "cancelled", "void"].includes(invoice.status)
      ),
    [customer, data.invoices]
  );

  const selectedInvoices = eligibleInvoices.filter((invoice) => selectedInvoiceIds.includes(invoice.id));
  const total = selectedInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);

  const toggleInvoice = (invoiceId: string) => {
    setSelectedInvoiceIds((current) =>
      current.includes(invoiceId) ? current.filter((id) => id !== invoiceId) : [...current, invoiceId]
    );
  };

  const handleSubmit = async () => {
    if (!customer) {
      toast.error("Please select a customer.");
      return;
    }
    if (selectedInvoiceIds.length === 0) {
      toast.error("Select at least one invoice.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await createDocument("billing", {
        customer,
        date: "2026-04-19",
        amount: total,
        status: "pending_bill",
        documentTitle: "ใบวางบิลรวม",
        documentVariant: "Combined Billing Note",
        documentTypes: ["combined_billing_note"],
        sourceInvoiceIds: selectedInvoiceIds,
        linkedDocumentIds: selectedInvoiceIds,
        notes: `Combined billing from ${selectedInvoiceIds.length} invoice(s)`,
        timeline: [
          {
            who: "System",
            what: `created combined billing from ${selectedInvoiceIds.length} invoice(s)`,
            time: "2026-04-19",
            type: "billing",
            amount: total,
          },
        ],
      });
      await refresh();
      onOpenChange(false);
      toast.success(`Billing ${created.id} created`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create billing document.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0">
          <div className="flex items-start gap-3 border-b border-border bg-card px-6 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-brand text-primary-foreground shadow-brand">
              <ReceiptText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold leading-tight">Create Combined Billing</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Group unpaid invoices from one customer into a single billing note.
              </p>
            </div>
          </div>

          <div className="space-y-4 bg-background px-6 py-5">
            <div>
              <Label>Customer</Label>
              <Select
                value={customer || "none"}
                onValueChange={(value) => {
                  setCustomer(value === "none" ? "" : value);
                  setSelectedInvoiceIds([]);
                }}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select customer</SelectItem>
                  {data.customers.map((item) => (
                    <SelectItem key={item.id} value={item.name}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-xl border border-border/60">
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                <p className="text-sm font-semibold">Eligible invoices</p>
                <p className="text-sm font-semibold">{fmtTHB(total)}</p>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {eligibleInvoices.map((invoice) => (
                  <label key={invoice.id} className="flex cursor-pointer items-center gap-3 border-b border-border/40 px-4 py-3 last:border-0">
                    <Checkbox
                      checked={selectedInvoiceIds.includes(invoice.id)}
                      onCheckedChange={() => toggleInvoice(invoice.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-xs font-semibold text-primary">{invoice.id}</span>
                      <span className="block truncate text-sm text-muted-foreground">{invoice.customer}</span>
                    </span>
                    <span className="text-sm font-semibold">{fmtTHB(invoice.amount)}</span>
                  </label>
                ))}
                {eligibleInvoices.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No eligible invoices for this customer.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border bg-card px-6 py-3.5">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={submitting}>
              {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Create Billing
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ProcessingDialog
        open={submitting}
        title="Creating billing document..."
        message="Linking selected invoices and saving the billing document."
      />
    </>
  );
};

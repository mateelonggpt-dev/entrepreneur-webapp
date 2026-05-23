import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProcessingDialog } from "./ProcessingDialog";
import { createWithholdingTaxDocument } from "@/lib/api";
import { useAppData } from "@/lib/app-data";
import type { PayableSummary } from "@/lib/types";
import { Loader2, ReceiptText } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  payables: PayableSummary[];
}

export const WithholdingTaxModal = ({ open, onOpenChange, payables }: Props) => {
  const { refresh } = useAppData();
  const [documentId, setDocumentId] = useState("");
  const [vendor, setVendor] = useState("");
  const [taxableAmount, setTaxableAmount] = useState("0");
  const [rate, setRate] = useState("3");
  const [incomeType, setIncomeType] = useState("service");
  const [filingMonth, setFilingMonth] = useState("2026-04");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const firstPayable = payables[0];
    setDocumentId(firstPayable?.id ?? "");
    setVendor(firstPayable?.vendor ?? "");
    setTaxableAmount(String(firstPayable?.remaining ?? 0));
    setRate("3");
    setIncomeType("service");
    setFilingMonth("2026-04");
    setSubmitting(false);
  }, [open, payables]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
          <div className="flex items-start gap-3 border-b border-border bg-card px-6 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-brand text-primary-foreground shadow-brand">
              <ReceiptText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold leading-tight">Create WHT Document</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Add a withholding tax document shell when payment-created WHT is not enough.
              </p>
            </div>
          </div>
          <div className="grid gap-4 bg-background px-6 py-5">
            <div>
              <Label>Related document</Label>
              <Select
                value={documentId || "none"}
                onValueChange={(value) => {
                  const payable = payables.find((row) => row.id === value);
                  setDocumentId(value === "none" ? "" : value);
                  setVendor(payable?.vendor ?? "");
                  setTaxableAmount(String(payable?.remaining ?? 0));
                }}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select payable" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select payable</SelectItem>
                  {payables.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.id} • {row.vendor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vendor</Label>
              <Input className="mt-1.5" value={vendor} onChange={(event) => setVendor(event.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Taxable amount</Label>
                <Input className="mt-1.5" type="number" min="0" value={taxableAmount} onChange={(event) => setTaxableAmount(event.target.value)} />
              </div>
              <div>
                <Label>WHT rate (%)</Label>
                <Input className="mt-1.5" type="number" min="0" value={rate} onChange={(event) => setRate(event.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
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
              <div>
                <Label>Filing month</Label>
                <Input className="mt-1.5" type="month" value={filingMonth} onChange={(event) => setFilingMonth(event.target.value)} />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-border bg-card px-6 py-3.5">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              className="border-0 bg-gradient-brand text-primary-foreground shadow-brand"
              onClick={async () => {
                setSubmitting(true);
                try {
                  await createWithholdingTaxDocument({
                    sourceDocumentId: documentId,
                    relatedExpenseId: documentId,
                    vendor,
                    incomeType,
                    taxableAmount: Number(taxableAmount),
                    rate: Number(rate),
                    amount: Number(taxableAmount) * (Number(rate) / 100),
                    filingMonth,
                    status: "pending",
                  });
                  await refresh();
                  onOpenChange(false);
                  toast.success("WHT document created");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Unable to create WHT document.");
                } finally {
                  setSubmitting(false);
                }
              }}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Create WHT
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ProcessingDialog
        open={submitting}
        title="Creating WHT document..."
        message="Saving withholding tax metadata to the backend."
      />
    </>
  );
};

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReceiptText, User2, Coins, StickyNote, Link2 } from "lucide-react";
import { ProcessingDialog } from "./ProcessingDialog";
import { toast } from "sonner";
import { createDocument } from "@/lib/api";
import { useAppData } from "@/lib/app-data";
import { readFormNumber, readFormString } from "@/lib/document-utils";
import { fmtTHB } from "@/lib/demo-data";
import {
  DocumentFormActions,
  DocumentModalFrame,
  DocumentNotesSection,
  DocumentPartySection,
  DocumentPaymentSection,
  DOCUMENT_FORM_MODELS,
} from "@/components/documents/form";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export const ReceiptModal = ({ open, onOpenChange }: Props) => {
  const formModel = DOCUMENT_FORM_MODELS.receipt;
  const { data, refresh } = useAppData();
  const formRef = useRef<HTMLFormElement>(null);
  const [customer, setCustomer] = useState("Bangkok Foods Co., Ltd.");
  const [relatedInvoice, setRelatedInvoice] = useState(data.invoices[0]?.id ?? "");
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [currency, setCurrency] = useState("THB");
  const [submitting, setSubmitting] = useState<"draft" | "create" | null>(null);
  const [errors, setErrors] = useState<{ customer?: string; invoice?: string; amount?: string }>({});

  useEffect(() => {
    if (!open) {
      return;
    }

    setCustomer(data.invoices[0]?.customer ?? "Bangkok Foods Co., Ltd.");
    setRelatedInvoice(data.invoices[0]?.id ?? "");
    setPaymentMethod("Bank Transfer");
    setCurrency("THB");
    setSubmitting(null);
    setErrors({});
    formRef.current?.reset();
  }, [data.invoices, open]);

  const submit = async (mode: "draft" | "create") => {
    const form = formRef.current;
    if (!form) {
      return;
    }

    const formData = new FormData(form);
    const amount = readFormNumber(formData, "amount");
    const nextErrors: typeof errors = {};

    if (!readFormString(formData, "customer")) {
      nextErrors.customer = "Please select a customer.";
    }
    if (!readFormString(formData, "relatedInvoice")) {
      nextErrors.invoice = "Link this receipt to an invoice.";
    }
    if (amount <= 0) {
      nextErrors.amount = "Amount received must be greater than zero.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast.error("Receipt is missing required information.");
      return;
    }

    setErrors({});
    setSubmitting(mode);

    try {
      const created = await createDocument("receipt", {
        number: readFormString(formData, "number"),
        customer: readFormString(formData, "customer"),
        date: readFormString(formData, "date"),
        relatedInvoice: readFormString(formData, "relatedInvoice"),
        paymentMethod: readFormString(formData, "paymentMethod"),
        amount,
        currency: readFormString(formData, "currency"),
        notes: readFormString(formData, "notes"),
        status: mode === "draft" ? "draft" : "paid",
      });

      await refresh();
      onOpenChange(false);
      toast.success(
        mode === "draft" ? `Draft ${created.id} saved` : `Receipt ${created.id} recorded`,
        {
          description:
            mode === "draft"
              ? "You can finalise and verify it later."
              : "The linked invoice status has been refreshed.",
        }
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save receipt.");
    } finally {
      setSubmitting(null);
    }
  };

  const relatedInvoiceAmount =
    data.invoices.find((invoice) => invoice.id === relatedInvoice)?.amount ?? 0;

  return (
    <>
      <DocumentModalFrame
        open={open}
        onOpenChange={onOpenChange}
        formRef={formRef}
        contentClassName="flex max-h-[90vh] max-w-2xl flex-col"
        hiddenFields={
          <>
            <input type="hidden" name="customer" value={customer} />
            <input type="hidden" name="relatedInvoice" value={relatedInvoice} />
            <input type="hidden" name="paymentMethod" value={paymentMethod} />
            <input type="hidden" name="currency" value={currency} />
          </>
        }
        icon={<ReceiptText className="h-5 w-5 text-primary-foreground" />}
        title={formModel.createTitle}
        description={formModel.description}
        footer={
          <DocumentFormActions
            submitting={submitting}
            cancelLabel="Cancel"
            draftLabel="Save Draft"
            submitLabel={formModel.createButtonLabel}
            onCancel={() => onOpenChange(false)}
            onSaveDraft={() => void submit("draft")}
            onSubmit={() => void submit("create")}
          />
        }
      >
        <DocumentPartySection
          icon={User2}
          title={formModel.partyLabel}
          label={formModel.partyLabel}
          value={customer}
          onValueChange={setCustomer}
          error={errors.customer}
          options={data.invoices.map((invoice) => ({
            value: invoice.customer,
            label: invoice.customer,
          }))}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="receipt-number" className="text-[11px] text-muted-foreground">
                {formModel.numberLabel}
              </Label>
              <Input
                id="receipt-number"
                name="number"
                defaultValue="RC-2026-0418"
                className="mt-1 h-9 bg-background font-mono"
              />
            </div>
            <div>
              <Label htmlFor="receipt-date" className="text-[11px] text-muted-foreground">
                {formModel.dateLabel}
              </Label>
              <Input
                id="receipt-date"
                name="date"
                type="date"
                defaultValue="2026-04-18"
                className="mt-1 h-9 bg-background"
              />
            </div>
          </div>
        </DocumentPartySection>

        <DocumentPaymentSection icon={Link2} title="Reference and Payment">
                <div>
                  <Label className="text-[11px] text-muted-foreground">{formModel.sourceDocumentLabel}</Label>
                  <Select value={relatedInvoice} onValueChange={setRelatedInvoice}>
                    <SelectTrigger className="mt-1 h-9 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {data.invoices.map((invoice) => (
                        <SelectItem key={invoice.id} value={invoice.id}>
                          {invoice.id} - {fmtTHB(invoice.amount)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.invoice ? (
                    <p className="mt-1 text-[11px] text-destructive">{errors.invoice}</p>
                  ) : (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Linked invoice total: {fmtTHB(relatedInvoiceAmount)}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="mt-1 h-9 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                      <SelectItem value="Credit Card">Credit Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
        </DocumentPaymentSection>

        <DocumentPaymentSection icon={Coins} title="Amount">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="receipt-amount" className="text-[11px] text-muted-foreground">
                      Amount Received
                    </Label>
                    <Input
                      id="receipt-amount"
                      name="amount"
                      type="number"
                      defaultValue={relatedInvoiceAmount || 42800}
                      className="mt-1 h-9 bg-background text-right font-mono"
                    />
                    {errors.amount ? (
                      <p className="mt-1 text-[11px] text-destructive">{errors.amount}</p>
                    ) : null}
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Currency</Label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger className="mt-1 h-9 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="THB">THB - Thai Baht</SelectItem>
                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
        </DocumentPaymentSection>

        <DocumentNotesSection
          icon={StickyNote}
          title={formModel.notesLabel}
          name="notes"
          rows={3}
          placeholder="Optional internal note..."
        />
      </DocumentModalFrame>

      <ProcessingDialog
        open={Boolean(submitting)}
        title={submitting === "draft" ? "Saving receipt draft..." : "Recording your receipt..."}
        message="The payment and linked invoice are being updated in the backend."
      />
    </>
  );
};

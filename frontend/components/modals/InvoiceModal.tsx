import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Receipt, User2, Calendar, StickyNote } from "lucide-react";
import { ProcessingDialog } from "./ProcessingDialog";
import { toast } from "sonner";
import { createDocument } from "@/lib/api";
import { useAppData } from "@/lib/app-data";
import { createClientId, readFormString } from "@/lib/document-utils";
import { buildDocumentNumberPreview } from "@/lib/domain/numbering";
import { calculateDocumentTotals } from "@/lib/domain/totals";
import {
  DocumentDatesSection,
  DocumentFormActions,
  DocumentLineItemsEditor,
  DocumentModalFrame,
  DocumentNotesSection,
  DocumentPartySection,
  DocumentTotalsPanel,
  DOCUMENT_FORM_MODELS,
} from "@/components/documents/form";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type Line = { id: string; desc: string; qty: number; price: number; tax: number; vatRate?: number; withholdingRate?: number };

const initialLines: Line[] = [
  { id: "1", desc: "Monthly subscription - Pro plan", qty: 1, price: 12000, tax: 7, vatRate: 7, withholdingRate: 0 },
  { id: "2", desc: "Onboarding and setup", qty: 1, price: 8500, tax: 7, vatRate: 7, withholdingRate: 0 },
];

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const InvoiceModal = ({ open, onOpenChange }: Props) => {
  const formModel = DOCUMENT_FORM_MODELS.invoice;
  const { data, refresh } = useAppData();
  const formRef = useRef<HTMLFormElement>(null);
  const [lines, setLines] = useState<Line[]>(initialLines);
  const [customer, setCustomer] = useState("Bangkok Foods Co., Ltd.");
  const [paymentTerms, setPaymentTerms] = useState("Net 30");
  const [submitting, setSubmitting] = useState<"draft" | "create" | null>(null);
  const [errors, setErrors] = useState<{ customer?: string; lines?: string }>({});

  useEffect(() => {
    if (!open) {
      return;
    }

    setLines(initialLines);
    setCustomer("Bangkok Foods Co., Ltd.");
    setPaymentTerms("Net 30");
    setErrors({});
    setSubmitting(null);
    formRef.current?.reset();
  }, [open]);

  const companyVatRegistered = data.policySummary?.vatRegistered !== false;
  const documentSettings = data.policySummary?.documents;
  const perLineWithholdingTax = Boolean(documentSettings?.perLineWithholdingTax);
  const totals = calculateDocumentTotals(lines, {
    defaultTaxRate: companyVatRegistered ? 7 : 0,
    vatEnabled: companyVatRegistered,
    perLineWithholding: perLineWithholdingTax,
  });
  const subtotal = totals.subtotal;
  const tax = totals.taxAmount;
  const total = totals.total;
  const invoiceNumberPreview = buildDocumentNumberPreview({
    mode: "yearly_reset",
    prefix: "INV",
    startAt: 143,
    dateText: "2026-04-18",
  });

  const addLine = () =>
    setLines((current) => [
      ...current,
      { id: createClientId(), desc: "", qty: 1, price: 0, tax: companyVatRegistered ? 7 : 0, vatRate: companyVatRegistered ? 7 : 0, withholdingRate: 0 },
    ]);

  const removeLine = (id: string) => setLines((current) => current.filter((line) => line.id !== id));

  const updateLine = (id: string, key: keyof Line, value: string | number) =>
    setLines((current) =>
      current.map((line) =>
        line.id === id
          ? {
              ...line,
              [key]:
                key === "desc"
                  ? String(value)
                  : key === "tax" || key === "vatRate" || key === "withholdingRate"
                    ? Math.min(Math.max(Math.trunc(Number(value) || 0), 0), 100)
                  : Number.isFinite(Number(value))
                    ? Number(value)
                    : 0,
            }
          : line
      )
    );

  const submit = async (mode: "draft" | "create") => {
    const form = formRef.current;
    if (!form) {
      return;
    }

    const formData = new FormData(form);
    const sanitizedLines = lines
      .map((line) => ({
        id: line.id,
        desc: line.desc.trim(),
        qty: Number(line.qty) || 0,
        price: Number(line.price) || 0,
        tax: companyVatRegistered ? Math.min(Math.max(Math.trunc(Number(line.tax) || 0), 0), 100) : 0,
        vatRate: companyVatRegistered ? Math.min(Math.max(Math.trunc(Number(line.vatRate ?? line.tax) || 0), 0), 100) : 0,
        withholdingRate: perLineWithholdingTax ? Math.min(Math.max(Math.trunc(Number(line.withholdingRate) || 0), 0), 100) : 0,
      }))
      .filter((line) => line.desc && line.qty > 0);

    const nextErrors: typeof errors = {};
    const customerName = readFormString(formData, "customer");

    if (!customerName) {
      nextErrors.customer = "Please select a customer.";
    }

    if (!sanitizedLines.length) {
      nextErrors.lines = "Add at least one line item before saving.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast.error("Invoice is missing a few required fields.");
      return;
    }

    setErrors({});
    setSubmitting(mode);

    try {
      const created = await createDocument("invoice", {
        number: readFormString(formData, "number"),
        customer: customerName,
        date: readFormString(formData, "date"),
        due: readFormString(formData, "due"),
        reference: readFormString(formData, "reference"),
        paymentTerms: readFormString(formData, "paymentTerms"),
        notes: readFormString(formData, "notes"),
        status: mode === "draft" ? "draft" : "pending",
        currency: "THB",
        subtotal,
        amountBeforeVat: subtotal,
        taxAmount: tax,
        vatGroups: totals.vatGroups,
        amount: total,
        withholdingAmount: totals.withholdingAmount,
        withholdingGroups: totals.withholdingGroups,
        totalWithholdingTax: totals.totalWithholdingTax,
        amountDue: totals.remainingDue,
        documentSettingsSnapshot: companyVatRegistered ? documentSettings : { ...documentSettings, taxMode: "exclusive", perLineVat: false },
        lines: sanitizedLines,
      });

      await refresh();
      onOpenChange(false);
      toast.success(
        mode === "draft"
          ? `Draft ${created.id} saved`
          : `Invoice ${created.id} created`,
        {
          description:
            mode === "draft"
              ? "You can continue editing it later."
              : "The invoice is now available in your sales list.",
        }
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save invoice.");
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <>
      <DocumentModalFrame
        open={open}
        onOpenChange={onOpenChange}
        formRef={formRef}
        hiddenFields={
          <>
            <input type="hidden" name="customer" value={customer} />
            <input type="hidden" name="paymentTerms" value={paymentTerms} />
          </>
        }
        icon={<Receipt className="h-5 w-5 text-primary-foreground" />}
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DocumentPartySection
            icon={User2}
            title={formModel.partyLabel}
            label={formModel.partyLabel}
            value={customer}
            onValueChange={setCustomer}
            error={errors.customer}
            options={[
              { value: "Bangkok Foods Co., Ltd.", label: "Bangkok Foods Co., Ltd." },
              { value: "Siam Digital Studio", label: "Siam Digital Studio" },
              { value: "Chiang Mai Crafts Ltd.", label: "Chiang Mai Crafts Ltd." },
            ]}
          >
                  <div>
                    <Label htmlFor="invoice-number" className="text-[11px] text-muted-foreground">
                      {formModel.numberLabel}
                    </Label>
                    <Input
                      id="invoice-number"
                      name="number"
                      defaultValue={invoiceNumberPreview}
                      className="mt-1 h-9 bg-background font-mono"
                    />
                  </div>
          </DocumentPartySection>

          <DocumentDatesSection
            icon={Calendar}
            title="Dates"
            fields={[
              {
                id: "invoice-date",
                name: "date",
                type: "date",
                label: formModel.dateLabel,
                defaultValue: "2026-04-18",
              },
              {
                id: "invoice-due",
                name: "due",
                type: "date",
                label: formModel.dueDateLabel,
                defaultValue: "2026-05-18",
              },
            ]}
          >
                  <div>
                    <Label htmlFor="invoice-terms" className="text-[11px] text-muted-foreground">
                      {formModel.termsLabel}
                    </Label>
                    <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                      <SelectTrigger id="invoice-terms" className="mt-1 h-9 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Net 15">Net 15</SelectItem>
                        <SelectItem value="Net 30">Net 30</SelectItem>
                        <SelectItem value="Net 60">Net 60</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="invoice-reference" className="text-[11px] text-muted-foreground">
                      Reference
                    </Label>
                    <Input
                      id="invoice-reference"
                      name="reference"
                      defaultValue="PO-2026-0418"
                      className="mt-1 h-9 bg-background"
                    />
                  </div>
          </DocumentDatesSection>
        </div>

        <DocumentLineItemsEditor
          icon={Receipt}
          title="Line Items"
          lines={lines}
          onAddLine={addLine}
          onRemoveLine={removeLine}
          onUpdateLine={(id, field, value) => updateLine(id, field as keyof Line, value)}
          amountFormatter={fmt}
          error={errors.lines}
          showVat={companyVatRegistered}
          showWithholdingTax={perLineWithholdingTax}
          labels={{
            description: "Description",
            qty: "Qty",
            unitPrice: "Unit Price",
            tax: "Tax",
            withholdingTax: "WHT %",
            amount: "Amount",
            addLine: "Add line",
          }}
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <DocumentNotesSection
            icon={StickyNote}
            title={formModel.notesLabel}
            name="notes"
            rows={4}
            placeholder="Internal note or message to the customer..."
            defaultValue="Thank you for your business. Please remit payment to the bank account shown below."
          />

          <DocumentTotalsPanel
            title={formModel.summaryTitle}
            rows={[
              { label: formModel.subtotalLabel, value: fmt(subtotal) },
              ...totals.vatGroups.map((group) => ({ label: `${formModel.taxLabel} ${group.rate}%`, value: fmt(group.taxAmount) })),
              ...totals.withholdingGroups.map((group) => ({ label: `WHT ${group.rate}%`, value: fmt(group.taxAmount) })),
              ...(totals.withholdingAmount > 0 ? [{ label: "Total withholding tax", value: fmt(totals.withholdingAmount) }] : []),
            ]}
            totalLabel={totals.withholdingAmount > 0 ? "Amount after withholding" : formModel.totalLabel}
            totalValue={`THB ${fmt(totals.remainingDue)}`}
          />
        </div>
      </DocumentModalFrame>

      <ProcessingDialog
        open={Boolean(submitting)}
        title={submitting === "draft" ? "Saving invoice draft..." : "Creating your invoice..."}
        message="Totals, numbering, and backend records are being prepared."
        variant="ring"
      />
    </>
  );
};

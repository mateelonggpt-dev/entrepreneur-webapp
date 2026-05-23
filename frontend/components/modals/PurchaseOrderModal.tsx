import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProcessingDialog } from "./ProcessingDialog";
import { createDocument } from "@/lib/api";
import { useAppData } from "@/lib/app-data";
import { getEnabledCurrencies, resolveExchangeRate } from "@/lib/currency";
import { calculateDocumentTotals } from "@/lib/domain/totals";
import { createClientId } from "@/lib/document-utils";
import type { PurchaseDocumentRecord } from "@/lib/types";
import { PackagePlus } from "lucide-react";
import { toast } from "sonner";
import {
  DocumentFormActions,
  DocumentLineItemsEditor,
  DocumentModalFrame,
  DocumentSection,
  DocumentTotalsPanel,
  DOCUMENT_FORM_MODELS,
} from "@/components/documents/form";

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  document?: PurchaseDocumentRecord | null;
  onSaved?: (document: PurchaseDocumentRecord) => void;
}

interface LineDraft {
  id: string;
  desc: string;
  qty: number;
  price: number;
  tax: number;
  vatRate?: number;
  withholdingRate?: number;
  discount?: number;
}

const buildDefaultLines = (): LineDraft[] => [
  {
    id: createClientId(),
    desc: "",
    qty: 1,
    price: 0,
    tax: 7,
    vatRate: 7,
    withholdingRate: 0,
    discount: 0,
  },
];

export const PurchaseOrderModal = ({ open, onOpenChange, document, onSaved }: Props) => {
  const formModel = DOCUMENT_FORM_MODELS.purchase_order;
  const { data, refresh } = useAppData();
  const [vendor, setVendor] = useState("");
  const [status, setStatus] = useState<"draft" | "pending" | "approved">("draft");
  const [currency, setCurrency] = useState("THB");
  const [projectId, setProjectId] = useState("");
  const [date, setDate] = useState("2026-04-19");
  const [due, setDue] = useState("2026-05-03");
  const [reference, setReference] = useState("");
  const [requestedBy, setRequestedBy] = useState("");
  const [department, setDepartment] = useState("");
  const [deliveryTo, setDeliveryTo] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("Net 30");
  const [deliveryTerms, setDeliveryTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>(buildDefaultLines);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<"draft" | "create" | null>(null);

  const isEditing = Boolean(document?.id);
  const currencyOptions = useMemo(() => getEnabledCurrencies(data.currencySettings), [data.currencySettings]);
  const selectedProject = data.projects.find((project) => project.id === projectId) ?? null;
  const companyVatRegistered = data.policySummary?.vatRegistered !== false;
  const documentSettings = data.policySummary?.documents;
  const perLineWithholdingTax = Boolean(documentSettings?.perLineWithholdingTax);

  useEffect(() => {
    if (!open) {
      return;
    }

    setVendor(document?.vendor ?? data.vendors[0]?.name ?? "");
    setStatus((document?.status as "draft" | "pending" | "approved") ?? "draft");
    setCurrency(document?.currency ?? "THB");
    setProjectId(document?.projectId ?? "");
    setDate(document?.date ?? "2026-04-19");
    setDue(document?.due ?? "2026-05-03");
    setReference(document?.reference ?? "");
    setRequestedBy(document?.requestedBy ?? "");
    setDepartment(document?.department ?? "");
    setDeliveryTo(document?.deliveryTo ?? "");
    setPaymentTerms(document?.paymentTerms ?? "Net 30");
    setDeliveryTerms(document?.deliveryTerms ?? "");
    setNotes(document?.notes ?? "");
    setLines(
      document?.lines?.length
        ? document.lines.map((line) => ({
            id: line.id || createClientId(),
            desc: line.desc,
            qty: Number(line.qty || 1),
            price: Number(line.price || 0),
            tax: companyVatRegistered ? Math.min(Math.max(Math.trunc(Number(line.tax || 0)), 0), 100) : 0,
            vatRate: companyVatRegistered ? Math.min(Math.max(Math.trunc(Number(line.vatRate ?? line.tax ?? 0)), 0), 100) : 0,
            withholdingRate: Math.min(Math.max(Math.trunc(Number(line.withholdingRate || 0)), 0), 100),
            discount: Number(line.discount || 0),
          }))
        : buildDefaultLines()
    );
    setErrors({});
    setSubmitting(null);
  }, [companyVatRegistered, data.vendors, document, open]);

  const totals = useMemo(
    () =>
      calculateDocumentTotals(
        lines.map((line) => ({
          qty: Number(line.qty || 0),
          price: Number(line.price || 0),
          tax: Number(line.tax || 0),
          vatRate: Number(line.vatRate ?? line.tax ?? 0),
          withholdingRate: Number(line.withholdingRate || 0),
          discount: Number(line.discount || 0),
        })),
        {
          defaultTaxRate: companyVatRegistered ? 7 : 0,
          vatEnabled: companyVatRegistered,
          perLineWithholding: perLineWithholdingTax,
        }
      ),
    [companyVatRegistered, lines, perLineWithholdingTax]
  );

  const updateLine = (lineId: string, field: keyof LineDraft, value: string | number) => {
    setLines((current) =>
      current.map((line) =>
        line.id === lineId
          ? {
              ...line,
              [field]:
                field === "desc"
                  ? String(value)
                  : field === "tax" || field === "vatRate" || field === "withholdingRate"
                    ? Math.min(Math.max(Math.trunc(Number(value) || 0), 0), 100)
                  : Number(value),
            }
          : line
      )
    );
  };

  const addLine = () => {
    setLines((current) => [
      ...current,
      {
        id: createClientId(),
        desc: "",
        qty: 1,
        price: 0,
        tax: companyVatRegistered ? 7 : 0,
        vatRate: companyVatRegistered ? 7 : 0,
        withholdingRate: 0,
        discount: 0,
      },
    ]);
  };

  const removeLine = (lineId: string) => {
    setLines((current) => (current.length > 1 ? current.filter((line) => line.id !== lineId) : current));
  };

  const submit = async (mode: "draft" | "create") => {
    const activeLines = lines.filter((line) => line.desc.trim());
    const nextErrors: Record<string, string> = {};

    if (!vendor) {
      nextErrors.vendor = "Vendor is required.";
    }
    if (activeLines.length === 0) {
      nextErrors.lines = "Add at least one line item.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast.error("Purchase order needs a little more detail.");
      return;
    }

    setErrors({});
    setSubmitting(mode);

    try {
      const saved = (await createDocument("purchase_order", {
        id: document?.id,
        vendor,
        date,
        due,
        reference,
        paymentTerms,
        notes,
        deliveryTo,
        requestedBy,
        department,
        deliveryTerms,
        status: mode === "draft" ? "draft" : status === "approved" ? "approved" : "pending",
        currency,
        exchangeRate: resolveExchangeRate(data.currencySettings, currency),
        projectId,
        projectName: selectedProject?.name,
        subtotal: totals.subtotal,
        amountBeforeVat: totals.subtotal,
        taxAmount: totals.taxAmount,
        vatGroups: totals.vatGroups,
        amount: totals.total,
        withholdingAmount: totals.withholdingAmount,
        withholdingGroups: totals.withholdingGroups,
        totalWithholdingTax: totals.totalWithholdingTax,
        amountDue: totals.remainingDue,
        documentSettingsSnapshot: companyVatRegistered ? documentSettings : { ...documentSettings, taxMode: "exclusive", perLineVat: false },
        lines: activeLines.map((line) => ({
          id: line.id,
          desc: line.desc,
          qty: line.qty,
          price: line.price,
          tax: companyVatRegistered ? Math.min(Math.max(Math.trunc(Number(line.tax) || 0), 0), 100) : 0,
          vatRate: companyVatRegistered ? Math.min(Math.max(Math.trunc(Number(line.vatRate ?? line.tax) || 0), 0), 100) : 0,
          withholdingRate: perLineWithholdingTax ? Math.min(Math.max(Math.trunc(Number(line.withholdingRate) || 0), 0), 100) : 0,
          discount: line.discount,
        })),
      })) as unknown as PurchaseDocumentRecord;

      await refresh();
      onSaved?.(saved);
      onOpenChange(false);
      toast.success(isEditing ? `Purchase order ${saved.id} updated` : `Purchase order ${saved.id} created`, {
        description:
          mode === "draft"
            ? "The draft is ready to continue later."
            : "You can now convert it into goods received or an expense flow.",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save purchase order.");
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <>
      <DocumentModalFrame
        open={open}
        onOpenChange={onOpenChange}
        contentClassName="h-[92vh] max-w-5xl"
        bodyClassName="space-y-0 overflow-y-auto bg-background px-6 py-5"
        icon={<PackagePlus className="h-5 w-5 text-primary-foreground" />}
        title={isEditing ? formModel.editTitle : formModel.createTitle}
        description={formModel.description}
        footer={
          <DocumentFormActions
            submitting={submitting}
            cancelLabel="Cancel"
            draftLabel="Save Draft"
            submitLabel={isEditing ? formModel.saveButtonLabel : formModel.createButtonLabel}
            onCancel={() => onOpenChange(false)}
            onSaveDraft={() => void submit("draft")}
            onSubmit={() => void submit("create")}
          />
        }
      >
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <DocumentSection title="Order details" contentClassName="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label>{formModel.partyLabel}</Label>
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
                      {errors.vendor ? <p className="mt-1 text-[11px] text-destructive">{errors.vendor}</p> : null}
                    </div>
                    <div>
                      <Label>{formModel.dateLabel}</Label>
                      <Input className="mt-1.5" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
                    </div>
                    <div>
                      <Label>{formModel.dueDateLabel}</Label>
                      <Input className="mt-1.5" type="date" value={due} onChange={(event) => setDue(event.target.value)} />
                    </div>
                    <div>
                      <Label>Reference</Label>
                      <Input className="mt-1.5" value={reference} onChange={(event) => setReference(event.target.value)} />
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
                        <SelectTrigger className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Requested by</Label>
                      <Input className="mt-1.5" value={requestedBy} onChange={(event) => setRequestedBy(event.target.value)} />
                    </div>
                    <div>
                      <Label>Department</Label>
                      <Input className="mt-1.5" value={department} onChange={(event) => setDepartment(event.target.value)} />
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
                    <div className="col-span-2">
                      <Label>Delivery to</Label>
                      <Textarea className="mt-1.5 min-h-[88px]" value={deliveryTo} onChange={(event) => setDeliveryTo(event.target.value)} />
                    </div>
            </DocumentSection>

            <DocumentLineItemsEditor
              title="Line items"
              lines={lines}
              variant="cards"
              showDiscount
              showVat={companyVatRegistered}
              showWithholdingTax={perLineWithholdingTax}
              error={errors.lines}
              onAddLine={addLine}
              onRemoveLine={removeLine}
              onUpdateLine={(id, field, value) => updateLine(id, field as keyof LineDraft, value)}
              labels={{
                addLine: "Add Line",
                description: "Description",
                qty: "Qty",
                unitCost: "Unit Cost",
                tax: "Tax %",
                withholdingTax: "WHT %",
                discount: "Disc %",
              }}
            />
          </div>

          <div className="space-y-6">
            <DocumentSection title="Commercial terms" contentClassName="grid gap-4">
                    <div>
                      <Label>{formModel.termsLabel}</Label>
                      <Input className="mt-1.5" value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} />
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
                      <Label>Delivery terms</Label>
                      <Textarea className="mt-1.5 min-h-[88px]" value={deliveryTerms} onChange={(event) => setDeliveryTerms(event.target.value)} />
                    </div>
                    <div>
                      <Label>{formModel.notesLabel}</Label>
                      <Textarea className="mt-1.5 min-h-[120px]" value={notes} onChange={(event) => setNotes(event.target.value)} />
                    </div>
            </DocumentSection>

            <DocumentTotalsPanel
              title="Totals"
              className="bg-secondary/20 bg-none"
              totalClassName="text-foreground"
              rows={[
                {
                  label: formModel.subtotalLabel,
                  value: totals.subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 }),
                },
                {
                  label: "Discount",
                  value: totals.discountAmount.toLocaleString("en-US", { minimumFractionDigits: 2 }),
                },
                {
                  label: "Amount before VAT",
                  value: totals.subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 }),
                },
                ...totals.vatGroups.map((group) => ({
                  label: `${formModel.taxLabel} ${group.rate}%`,
                  value: group.taxAmount.toLocaleString("en-US", { minimumFractionDigits: 2 }),
                })),
                ...totals.withholdingGroups.map((group) => ({
                  label: `WHT ${group.rate}%`,
                  value: group.taxAmount.toLocaleString("en-US", { minimumFractionDigits: 2 }),
                })),
                ...(totals.withholdingAmount > 0
                  ? [
                      {
                        label: "Total withholding tax",
                        value: totals.withholdingAmount.toLocaleString("en-US", { minimumFractionDigits: 2 }),
                      },
                    ]
                  : []),
              ]}
              totalLabel={totals.withholdingAmount > 0 ? "Amount after withholding" : formModel.totalLabel}
              totalValue={(totals.remainingDue ?? totals.total).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            />
          </div>
        </div>
      </DocumentModalFrame>

      <ProcessingDialog
        open={Boolean(submitting)}
        title={submitting === "draft" ? "Saving purchase order draft..." : "Saving purchase order..."}
        message="The document structure and totals are being stored in the backend."
      />
    </>
  );
};

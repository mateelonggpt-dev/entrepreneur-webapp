import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileSpreadsheet, User2, Calendar, StickyNote } from "lucide-react";
import { ProcessingDialog } from "./ProcessingDialog";
import { toast } from "sonner";
import { createDocument } from "@/lib/api";
import { useAppData } from "@/lib/app-data";
import { createClientId, readFormString } from "@/lib/document-utils";
import { buildDocumentNumberPreview } from "@/lib/domain/numbering";
import { calculateDocumentTotals } from "@/lib/domain/totals";
import type { SalesDocumentRecord } from "@/lib/types";
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
  quotation?: SalesDocumentRecord | null;
  onSaved?: (quotation: SalesDocumentRecord) => void;
}

type Line = { id: string; desc: string; qty: number; price: number; tax: number; vatRate?: number; withholdingRate?: number };

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const QuotationModal = ({ open, onOpenChange, quotation, onSaved }: Props) => {
  const formModel = DOCUMENT_FORM_MODELS.quotation;
  const { t } = useTranslation();
  const { data, refresh } = useAppData();
  const formRef = useRef<HTMLFormElement>(null);
  const defaultLines = useState<Line[]>([
    {
      id: "1",
      desc: t("quotationModal.defaultLines.consulting", {
        defaultValue: "Consulting service - Q2 retainer",
      }),
      qty: 1,
      price: 35000,
      tax: 7,
      vatRate: 7,
      withholdingRate: 0,
    },
    {
      id: "2",
      desc: t("quotationModal.defaultLines.implementation", {
        defaultValue: "Implementation hours",
      }),
      qty: 12,
      price: 1800,
      tax: 7,
      vatRate: 7,
      withholdingRate: 0,
    },
  ])[0];
  const customerOptions = [
    {
      value: "Bangkok Foods Co., Ltd.",
      label: t("quotationModal.customers.bangkokFoods", {
        defaultValue: "Bangkok Foods Co., Ltd.",
      }),
    },
    {
      value: "Siam Digital Studio",
      label: t("quotationModal.customers.siamDigital", {
        defaultValue: "Siam Digital Studio",
      }),
    },
    {
      value: "Chiang Mai Crafts Ltd.",
      label: t("quotationModal.customers.chiangMaiCrafts", {
        defaultValue: "Chiang Mai Crafts Ltd.",
      }),
    },
  ];
  const [lines, setLines] = useState<Line[]>(defaultLines);
  const [customer, setCustomer] = useState("Bangkok Foods Co., Ltd.");
  const [submitting, setSubmitting] = useState<"draft" | "create" | null>(null);
  const [errors, setErrors] = useState<{ customer?: string; lines?: string }>({});

  useEffect(() => {
    if (!open) {
      return;
    }

    setLines(
      quotation?.lines?.length
        ? quotation.lines.map((line) => ({
            id: line.id,
            desc: line.desc,
            qty: line.qty,
            price: line.price,
            tax: line.tax,
            vatRate: line.vatRate ?? line.tax,
            withholdingRate: line.withholdingRate ?? 0,
          }))
        : defaultLines
    );
    setCustomer(quotation?.customer ?? "Bangkok Foods Co., Ltd.");
    setSubmitting(null);
    setErrors({});
    formRef.current?.reset();
  }, [defaultLines, open, quotation]);

  const companyVatRegistered = data.policySummary?.vatRegistered !== false;
  const documentSettings = data.policySummary?.documents;
  const perLineWithholdingTax = Boolean(documentSettings?.perLineWithholdingTax);
  const totals = calculateDocumentTotals(lines, {
    defaultTaxRate: companyVatRegistered ? 7 : 0,
    vatEnabled: companyVatRegistered,
    perLineWithholding: perLineWithholdingTax,
  });
  const subtotal = totals.subtotal;
  const quotationNumberPreview = buildDocumentNumberPreview({
    mode: "yearly_reset",
    prefix: "QT",
    startAt: 418,
    dateText: "2026-04-18",
  });
  const formKey = `${quotation?.id ?? "new"}-${open ? "open" : "closed"}`;

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
    const customerName = readFormString(formData, "customer");
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
    if (!customerName) {
      nextErrors.customer = t("quotationModal.customerRequired", {
        defaultValue: "Please select a customer.",
      });
    }
    if (!sanitizedLines.length) {
      nextErrors.lines = t("quotationModal.lineRequired", {
        defaultValue: "Add at least one quotation line item.",
      });
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast.error(
        t("quotationModal.missingInfo", {
          defaultValue: "Quotation is missing required information.",
        })
      );
      return;
    }

    setErrors({});
    setSubmitting(mode);

    try {
      const created = await createDocument("quotation", {
        id: quotation?.id,
        number: readFormString(formData, "number"),
        customer: customerName,
        date: readFormString(formData, "date"),
        expiryDate: readFormString(formData, "expiryDate"),
        reference: readFormString(formData, "reference"),
        notes: readFormString(formData, "notes"),
        status: mode === "draft" ? "draft" : "pending",
        currency: "THB",
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
        lines: sanitizedLines,
      });

      await refresh();
      onSaved?.(created as SalesDocumentRecord);
      onOpenChange(false);
      toast.success(
        mode === "draft"
          ? t("quotationModal.draftSaved", {
              defaultValue: "Draft {{id}} saved",
              id: created.id,
            })
          : quotation
            ? t("quotationModal.updated", {
                defaultValue: "Quotation {{id}} updated",
                id: created.id,
              })
            : t("quotationModal.created", {
                defaultValue: "Quotation {{id}} created",
                id: created.id,
              }),
        {
          description:
            mode === "draft"
              ? t("quotationModal.draftDescription", {
                  defaultValue: "It stays editable in the quotations module.",
                })
              : quotation
                ? t("quotationModal.updatedDescription", {
                    defaultValue: "The quotation has been updated in the backend.",
                  })
                : t("quotationModal.createdDescription", {
                    defaultValue: "The quotation is now stored in the backend.",
                  }),
        }
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("quotationModal.saveError", { defaultValue: "Unable to save quotation." })
      );
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <>
      <DocumentModalFrame
        open={open}
        onOpenChange={onOpenChange}
        formKey={formKey}
        formRef={formRef}
        hiddenFields={<input type="hidden" name="customer" value={customer} />}
        icon={<FileSpreadsheet className="h-5 w-5 text-primary-foreground" />}
        title={
          quotation
            ? t("quotationModal.editTitle", { defaultValue: formModel.editTitle })
            : t("modal.quotation.title")
        }
        description={
          quotation
            ? t("quotationModal.editDescription", {
                defaultValue: "Update quotation details and keep its linked history.",
              })
            : t("modal.quotation.sub")
        }
        footer={
          <DocumentFormActions
            submitting={submitting}
            cancelLabel={t("common.cancel")}
            draftLabel={t("common.saveDraft")}
            submitLabel={
              quotation
                ? t("quotationModal.saveChanges", { defaultValue: formModel.saveButtonLabel })
                : t("modal.quotation.create")
            }
            onCancel={() => onOpenChange(false)}
            onSaveDraft={() => void submit("draft")}
            onSubmit={() => void submit("create")}
          />
        }
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DocumentPartySection
            icon={User2}
            title={t("modal.quotation.customer")}
            label={t("modal.quotation.customer")}
            value={customer}
            onValueChange={setCustomer}
            options={customerOptions}
            error={errors.customer}
          >
                  <div>
                    <Label htmlFor="quotation-number" className="text-[11px] text-muted-foreground">
                      {t("modal.quotation.number")}
                    </Label>
                    <Input
                      id="quotation-number"
                      name="number"
                      defaultValue={quotation?.id ?? quotationNumberPreview}
                      className="mt-1 h-9 bg-background font-mono"
                    />
                  </div>
          </DocumentPartySection>

          <DocumentDatesSection
            icon={Calendar}
            title={t("modal.quotation.issueDate")}
            fields={[
              {
                id: "quotation-date",
                name: "date",
                type: "date",
                label: t("modal.quotation.issueDate"),
                defaultValue: quotation?.date ?? "2026-04-18",
              },
              {
                id: "quotation-expiry",
                name: "expiryDate",
                type: "date",
                label: t("modal.quotation.expiryDate"),
                defaultValue: quotation?.expiryDate ?? quotation?.due ?? "2026-05-18",
              },
            ]}
          >
                  <div>
                    <Label htmlFor="quotation-reference" className="text-[11px] text-muted-foreground">
                      {t("modal.quotation.reference")}
                    </Label>
                    <Input
                      id="quotation-reference"
                      name="reference"
                      placeholder={t("quotationModal.referencePlaceholder", { defaultValue: "PO-..." })}
                      defaultValue={quotation?.reference ?? ""}
                      className="mt-1 h-9 bg-background"
                    />
                  </div>
          </DocumentDatesSection>
        </div>

        <DocumentLineItemsEditor
          icon={FileSpreadsheet}
          title={t("modal.quotation.lineItems")}
          lines={lines}
          onAddLine={addLine}
          onRemoveLine={removeLine}
          onUpdateLine={(id, field, value) => updateLine(id, field as keyof Line, value)}
          amountFormatter={fmt}
          error={errors.lines}
          showVat={companyVatRegistered}
          showWithholdingTax={perLineWithholdingTax}
          labels={{
            description: t("modal.quotation.description"),
            qty: t("modal.quotation.qty"),
            unitPrice: t("modal.quotation.unitPrice"),
            tax: t("modal.quotation.tax"),
            withholdingTax: t("document.whtPercent", { defaultValue: "WHT %" }),
            amount: t("modal.quotation.amount"),
            addLine: t("modal.quotation.addLine"),
            linePlaceholder: t("quotationModal.linePlaceholder", {
              defaultValue: "Item or service...",
            }),
          }}
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <DocumentNotesSection
            icon={StickyNote}
            title={t("modal.quotation.notes")}
            name="notes"
            rows={4}
            defaultValue={quotation?.notes ?? ""}
          />

          <DocumentTotalsPanel
            title={t("modal.quotation.summary")}
            rows={[
              { label: t("modal.quotation.subtotal"), value: fmt(subtotal) },
              ...totals.vatGroups.map((group) => ({ label: `${t("modal.quotation.vat")} ${group.rate}%`, value: fmt(group.taxAmount) })),
              ...totals.withholdingGroups.map((group) => ({ label: `${t("document.whtPercent", { defaultValue: "WHT" })} ${group.rate}%`, value: fmt(group.taxAmount) })),
              ...(totals.withholdingAmount > 0 ? [{ label: t("document.totalWithholdingTax", { defaultValue: "Total withholding tax" }), value: fmt(totals.withholdingAmount) }] : []),
            ]}
            totalLabel={totals.withholdingAmount > 0 ? t("document.amountAfterWithholding", { defaultValue: "Amount after withholding" }) : t("modal.quotation.grandTotal")}
            totalValue={`THB ${fmt(totals.remainingDue)}`}
          />
        </div>
      </DocumentModalFrame>

      <ProcessingDialog
        open={Boolean(submitting)}
        title={
          submitting === "draft"
            ? t("quotationModal.savingDraft", { defaultValue: "Saving quotation draft..." })
            : t("loading.creatingQuotation")
        }
        message={t("loading.creatingDoc")}
        variant="ring"
      />
    </>
  );
};

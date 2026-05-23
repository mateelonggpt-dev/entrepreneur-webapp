import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProcessingDialog } from "./ProcessingDialog";
import { createDocument, uploadAttachments } from "@/lib/api";
import { useAppData } from "@/lib/app-data";
import { getEnabledCurrencies, resolveExchangeRate } from "@/lib/currency";
import { calculateDocumentTotals } from "@/lib/domain/totals";
import { createClientId } from "@/lib/document-utils";
import type { DocumentSummary, Product, PurchaseDocumentRecord } from "@/lib/types";
import { FilePlus2 } from "lucide-react";
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
  sourcePurchaseOrder?: PurchaseDocumentRecord | null;
  seedProduct?: Product | null;
  onSaved?: (document: PurchaseDocumentRecord) => void;
}

interface LineDraft {
  id: string;
  sku?: string;
  desc: string;
  qty: number;
  price: number;
  tax: number;
  vatRate?: number;
  withholdingRate?: number;
}

const blankLine = (): LineDraft => ({
  id: createClientId(),
  desc: "",
  qty: 1,
  price: 0,
  tax: 7,
  vatRate: 7,
  withholdingRate: 0,
});

export const NewReceiveModal = ({
  open,
  onOpenChange,
  document,
  sourcePurchaseOrder,
  seedProduct,
  onSaved,
}: Props) => {
  const formModel = DOCUMENT_FORM_MODELS.receive;
  const { data, refresh } = useAppData();
  const [vendor, setVendor] = useState("");
  const [status, setStatus] = useState<"draft" | "pending" | "approved">("draft");
  const [date, setDate] = useState("2026-04-19");
  const [currency, setCurrency] = useState("THB");
  const [projectId, setProjectId] = useState("");
  const [receiveType, setReceiveType] = useState<"inventory" | "operating_expense">("inventory");
  const [relatedPurchaseOrderId, setRelatedPurchaseOrderId] = useState("");
  const [department, setDepartment] = useState("");
  const [verifiedBy, setVerifiedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([blankLine()]);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<"draft" | "create" | null>(null);
  const currencyOptions = useMemo(() => getEnabledCurrencies(data.currencySettings), [data.currencySettings]);
  const selectedProject = data.projects.find((project) => project.id === projectId) ?? null;
  const companyVatRegistered = data.policySummary?.vatRegistered !== false;
  const documentSettings = data.policySummary?.documents;
  const perLineWithholdingTax = Boolean(documentSettings?.perLineWithholdingTax);

  const selectedPurchaseOrder = useMemo<DocumentSummary | PurchaseDocumentRecord | null>(
    () =>
      sourcePurchaseOrder ??
      (relatedPurchaseOrderId ? data.purchaseOrders.find((item) => item.id === relatedPurchaseOrderId) : undefined) ??
      null,
    [data.purchaseOrders, relatedPurchaseOrderId, sourcePurchaseOrder]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const initialSource = sourcePurchaseOrder ?? null;
    const initialDocument = document ?? null;
    const initialLines =
      initialDocument?.lines?.length
        ? initialDocument.lines.map((line) => ({
            id: line.id || createClientId(),
            sku: line.sku,
            desc: line.desc,
            qty: Number(line.qty || 1),
            price: Number(line.price || 0),
            tax: companyVatRegistered ? Math.min(Math.max(Math.trunc(Number(line.tax || 0)), 0), 100) : 0,
            vatRate: companyVatRegistered ? Math.min(Math.max(Math.trunc(Number(line.vatRate ?? line.tax ?? 0)), 0), 100) : 0,
            withholdingRate: Math.min(Math.max(Math.trunc(Number(line.withholdingRate || 0)), 0), 100),
          }))
        : initialSource?.lines?.length
          ? initialSource.lines.map((line) => ({
              id: line.id || createClientId(),
              sku: line.sku,
              desc: line.desc,
              qty: Number(line.qty || 1),
              price: Number(line.price || 0),
              tax: companyVatRegistered ? Math.min(Math.max(Math.trunc(Number(line.tax || 0)), 0), 100) : 0,
              vatRate: companyVatRegistered ? Math.min(Math.max(Math.trunc(Number(line.vatRate ?? line.tax ?? 0)), 0), 100) : 0,
              withholdingRate: Math.min(Math.max(Math.trunc(Number(line.withholdingRate || 0)), 0), 100),
            }))
          : seedProduct
            ? [{
                id: createClientId(),
                sku: seedProduct.sku,
                desc: seedProduct.name,
                qty: 1,
                price: Number(seedProduct.averageCost ?? seedProduct.openingCost ?? 0),
                tax: companyVatRegistered ? 7 : 0,
                vatRate: companyVatRegistered ? 7 : 0,
                withholdingRate: 0,
              }]
          : [blankLine()];

    setVendor(initialDocument?.vendor ?? initialSource?.vendor ?? data.vendors[0]?.name ?? "");
    setStatus((initialDocument?.status as "draft" | "pending" | "approved") ?? "draft");
    setDate(initialDocument?.date ?? "2026-04-19");
    setCurrency(initialDocument?.currency ?? "THB");
    setProjectId(initialDocument?.projectId ?? "");
    setReceiveType((initialDocument?.receiveType as "inventory" | "operating_expense") ?? "inventory");
    setRelatedPurchaseOrderId(initialDocument?.relatedPurchaseOrderId ?? initialSource?.id ?? "");
    setDepartment(initialDocument?.department ?? initialSource?.department ?? "");
    setVerifiedBy(initialDocument?.verifiedBy ?? "");
    setNotes(initialDocument?.notes ?? "");
    setLines(initialLines);
    setFiles([]);
    setErrors({});
    setSubmitting(null);
  }, [companyVatRegistered, data.vendors, document, open, seedProduct, sourcePurchaseOrder]);

  useEffect(() => {
    if (!selectedPurchaseOrder || document) {
      return;
    }

    setVendor("vendor" in selectedPurchaseOrder ? selectedPurchaseOrder.vendor : selectedPurchaseOrder.party);
    setDepartment("department" in selectedPurchaseOrder ? selectedPurchaseOrder.department ?? "" : "");
    if ("lines" in selectedPurchaseOrder && selectedPurchaseOrder.lines?.length) {
      setLines(
        selectedPurchaseOrder.lines.map((line) => ({
          id: line.id || createClientId(),
          sku: line.sku,
          desc: line.desc,
          qty: Number(line.qty || 1),
          price: Number(line.price || 0),
          tax: companyVatRegistered ? Math.min(Math.max(Math.trunc(Number(line.tax || 0)), 0), 100) : 0,
          vatRate: companyVatRegistered ? Math.min(Math.max(Math.trunc(Number(line.vatRate ?? line.tax ?? 0)), 0), 100) : 0,
          withholdingRate: Math.min(Math.max(Math.trunc(Number(line.withholdingRate || 0)), 0), 100),
        }))
      );
    }
  }, [companyVatRegistered, document, selectedPurchaseOrder]);

  const totals = useMemo(
    () =>
      calculateDocumentTotals(
        lines.map((line) => ({
          sku: line.sku,
          qty: Number(line.qty || 0),
          price: Number(line.price || 0),
        tax: Number(line.tax || 0),
        vatRate: Number(line.vatRate ?? line.tax ?? 0),
        withholdingRate: Number(line.withholdingRate || 0),
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
                field === "desc" || field === "sku"
                  ? String(value)
                  : field === "tax" || field === "vatRate" || field === "withholdingRate"
                    ? Math.min(Math.max(Math.trunc(Number(value) || 0), 0), 100)
                    : Number(value),
            }
          : line
      )
    );
  };

  const addLine = () => setLines((current) => [...current, blankLine()]);

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
      nextErrors.lines = "Add at least one received item row.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast.error("Goods received needs a few more details.");
      return;
    }

    setErrors({});
    setSubmitting(mode);

    try {
      const saved = (await createDocument("receive", {
        id: document?.id,
        vendor,
        receivedFrom: vendor,
        date,
        currency,
        exchangeRate: resolveExchangeRate(data.currencySettings, currency),
        projectId,
        projectName: selectedProject?.name,
        status: mode === "draft" ? "draft" : status === "approved" ? "approved" : "pending",
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
        notes,
        department,
        verifiedBy,
        relatedPurchaseOrderId: relatedPurchaseOrderId || undefined,
        relatedDocument: relatedPurchaseOrderId || undefined,
        sourceDocumentId: relatedPurchaseOrderId || undefined,
        sourceDocumentType: relatedPurchaseOrderId ? "purchase_order" : undefined,
        linkedDocumentIds: relatedPurchaseOrderId ? [relatedPurchaseOrderId] : undefined,
        receiveType,
        receiveMode: relatedPurchaseOrderId ? "from_purchase_order" : "standalone",
        itemFlow: receiveType === "inventory" ? "inventory" : "expense",
        lines: activeLines.map((line) => ({
          id: line.id,
          sku: line.sku,
          desc: line.desc,
          qty: line.qty,
          price: line.price,
          tax: companyVatRegistered ? Math.min(Math.max(Math.trunc(Number(line.tax) || 0), 0), 100) : 0,
          vatRate: companyVatRegistered ? Math.min(Math.max(Math.trunc(Number(line.vatRate ?? line.tax) || 0), 0), 100) : 0,
          withholdingRate: perLineWithholdingTax ? Math.min(Math.max(Math.trunc(Number(line.withholdingRate) || 0), 0), 100) : 0,
        })),
      })) as unknown as PurchaseDocumentRecord;

      if (files.length > 0) {
        await uploadAttachments({
          entityType: "receive",
          entityId: saved.id,
          files,
          category: "goods-received-evidence",
          note: notes,
          attachedBy: verifiedBy || "Matter Acc.",
          tags: [receiveType, relatedPurchaseOrderId ? "from-po" : "standalone"],
        });
      }

      await refresh();
      onSaved?.(saved);
      onOpenChange(false);
      toast.success(document ? `Goods received ${saved.id} updated` : `Goods received ${saved.id} created`, {
        description:
          files.length > 0
            ? `${files.length} evidence file(s) were uploaded.`
            : "The goods received flow is now stored in the backend.",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save goods received.");
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
        icon={<FilePlus2 className="h-5 w-5 text-primary-foreground" />}
        title={document ? formModel.editTitle : formModel.createTitle}
        description={formModel.description}
        footer={
          <DocumentFormActions
            submitting={submitting}
            cancelLabel="Cancel"
            draftLabel="Save Draft"
            submitLabel={document ? formModel.saveButtonLabel : formModel.createButtonLabel}
            onCancel={() => onOpenChange(false)}
            onSaveDraft={() => void submit("draft")}
            onSubmit={() => void submit("create")}
          />
        }
      >
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <DocumentSection title="Receipt details" contentClassName="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label>{formModel.sourceDocumentLabel}</Label>
                      <Select value={relatedPurchaseOrderId || "standalone"} onValueChange={(value) => setRelatedPurchaseOrderId(value === "standalone" ? "" : value)}>
                        <SelectTrigger className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standalone">Standalone receive</SelectItem>
                          {data.purchaseOrders.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.id} - {item.party}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
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
                      <Label>Flow type</Label>
                      <Select value={receiveType} onValueChange={(value) => setReceiveType(value as typeof receiveType)}>
                        <SelectTrigger className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="inventory">Inventory receipt</SelectItem>
                          <SelectItem value="operating_expense">Operating expense flow</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Department / Project</Label>
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
                    <div>
                      <Label>Verified by</Label>
                      <Input className="mt-1.5" value={verifiedBy} onChange={(event) => setVerifiedBy(event.target.value)} />
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
            </DocumentSection>

            <DocumentLineItemsEditor
              title="Received items"
              lines={lines}
              variant="cards"
              showSku
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
                linePlaceholder: "Item",
              }}
            />
          </div>

          <div className="space-y-6">
            <DocumentSection title="Evidence & notes">
                    <div>
                      <Label>Evidence files</Label>
                      <Input
                        className="mt-1.5"
                        type="file"
                        multiple
                        onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                      />
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Upload receiving slips, delivery notes, or photos after save.
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/50 bg-secondary/20 p-3">
                      <p className="text-sm font-medium">{files.length} file(s) ready</p>
                      {files.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                          {files.map((file) => (
                            <li key={`${file.name}-${file.size}`}>{file.name}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    <div>
                      <Label>{formModel.notesLabel}</Label>
                      <Textarea className="mt-1.5 min-h-[120px]" value={notes} onChange={(event) => setNotes(event.target.value)} />
                    </div>
            </DocumentSection>

            <DocumentTotalsPanel
              title={formModel.summaryTitle}
              className="bg-secondary/20 bg-none"
              totalClassName="text-foreground"
              rows={[
                {
                  label: formModel.subtotalLabel,
                  value: totals.subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 }),
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
            >
                    {selectedPurchaseOrder ? (
                      <div className="rounded-xl border border-border/50 bg-background p-3 text-xs text-muted-foreground">
                        Linked to purchase order <span className="font-mono text-foreground">{selectedPurchaseOrder.id}</span>
                      </div>
                    ) : null}
            </DocumentTotalsPanel>
          </div>
        </div>
      </DocumentModalFrame>

      <ProcessingDialog
        open={Boolean(submitting)}
        title={submitting === "draft" ? "Saving goods received draft..." : "Saving goods received..."}
        message="The received items and linked evidence metadata are being stored in the backend."
      />
    </>
  );
};

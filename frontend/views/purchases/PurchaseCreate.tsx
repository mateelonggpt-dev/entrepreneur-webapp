import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { useNavigate } from "react-router-dom";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { DocumentTypeSelector } from "@/components/documents/DocumentTypeSelector";
import { AppShell } from "@/components/layout/AppShell";
import { ExpenseDocumentModal, PaymentActionModal } from "@/components/modals/DomainModals";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createDocument, createExpense, uploadAttachments } from "@/lib/api";
import { useAppData } from "@/lib/app-data";
import { getRealDocumentTypes, PURCHASE_DOCUMENT_TYPE_OPTIONS } from "@/lib/document-sections";
import { createClientId } from "@/lib/document-utils";
import { buildPayables } from "@/lib/purchases";
import { upsertRemainingTasks, type RemainingTask } from "@/lib/remaining-tasks";
import type { Product } from "@/lib/types";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Download,
  Eye,
  FileText,
  Loader2,
  Plus,
  Save,
  Send,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

type ExpenseDocType =
  | "purchase_order"
  | "receive"
  | "vendor_invoice"
  | "expense"
  | "supplier_payment"
  | "advance_payment"
  | "withholding_tax";
type EvidenceType = "invoiceReceipt" | "paymentEvidence" | "deliveryEvidence" | "withholdingTaxEvidence";

type ExpenseLine = {
  id: string;
  sku: string;
  desc: string;
  detail: string;
  qty: number;
  unit: string;
  price: number;
  vat: number;
  vatRate?: number;
  vatAmount?: number;
  withholdingRate?: number;
  withholdingAmount?: number;
};

const purchaseTaxCopy = {
  en: {
    vatDisabled: "VAT options are disabled because this company is not VAT registered.",
    whtPercent: "WHT %",
    whtAmount: "WHT amount",
    totalWithholdingTax: "Total withholding tax",
    amountAfterWithholding: "Amount after withholding",
    amountBeforeVat: "Amount before VAT",
  },
  th: {
    vatDisabled: "ปิดการตั้งค่า VAT เพราะบริษัทนี้ไม่ได้จดทะเบียนภาษีมูลค่าเพิ่ม",
    whtPercent: "หัก ณ ที่จ่าย %",
    whtAmount: "ยอดหัก ณ ที่จ่าย",
    totalWithholdingTax: "รวมภาษีหัก ณ ที่จ่าย",
    amountAfterWithholding: "ยอดชำระหลังหัก ณ ที่จ่าย",
    amountBeforeVat: "ยอดก่อน VAT",
  },
} as const;

type TaxRateGroup = {
  rate: number;
  taxableBase: number;
  taxAmount: number;
};

type EvidenceFiles = Record<EvidenceType, File[]>;

const sourceDocumentCategoryLabels: Record<EvidenceType, { labelKey: string; missingKey: string }> = {
  invoiceReceipt: {
    labelKey: "expenseCreate.evidence.invoiceReceipt",
    missingKey: "expenseCreate.evidence.missingInvoiceReceipt",
  },
  paymentEvidence: {
    labelKey: "expenseCreate.evidence.paymentEvidence",
    missingKey: "expenseCreate.evidence.missingPaymentEvidence",
  },
  deliveryEvidence: {
    labelKey: "expenseCreate.evidence.deliveryEvidence",
    missingKey: "expenseCreate.evidence.missingDeliveryEvidence",
  },
  withholdingTaxEvidence: {
    labelKey: "expenseCreate.evidence.withholdingTaxEvidence",
    missingKey: "expenseCreate.evidence.missingWithholdingTaxEvidence",
  },
};

const documentTitles: Record<
  ExpenseDocType,
  { en: string; th: string; prefix: string; kind: "purchase_order" | "receive" | "expense" | "withholding_tax" | "supplier_payment" }
> = {
  expense: { en: "Record Expense", th: "บันทึกรายจ่าย", prefix: "EXP", kind: "expense" },
  vendor_invoice: { en: "Vendor Invoice", th: "ใบแจ้งหนี้ผู้ขาย", prefix: "VI", kind: "expense" },
  purchase_order: { en: "Purchase Order", th: "ใบสั่งซื้อ", prefix: "PO", kind: "purchase_order" },
  receive: { en: "Goods Receipt", th: "ใบรับสินค้า", prefix: "GRN", kind: "receive" },
  supplier_payment: { en: "Supplier Payment", th: "ชำระเงินผู้ขาย", prefix: "PAY", kind: "supplier_payment" },
  advance_payment: { en: "Advance Payment", th: "จ่ายเงินล่วงหน้า", prefix: "ADV", kind: "supplier_payment" },
  withholding_tax: { en: "Withholding Tax Certificate", th: "หนังสือรับรองหัก ณ ที่จ่าย", prefix: "WHT", kind: "withholding_tax" },
};

const sourceDocumentOptions = [
  { id: "vendor_invoice", labelKey: "expenseCreate.sourceDocuments.vendorInvoice" },
  { id: "tax_invoice", labelKey: "expenseCreate.sourceDocuments.taxInvoice" },
  { id: "receipt", labelKey: "expenseCreate.sourceDocuments.receipt" },
  { id: "delivery_note", labelKey: "expenseCreate.sourceDocuments.deliveryNote" },
  { id: "receive", labelKey: "expenseCreate.sourceDocuments.goodsReceipt" },
  { id: "other", labelKey: "expenseCreate.sourceDocuments.other" },
];

const todayText = () => new Date().toISOString().slice(0, 10);

const fmt = (value: number) =>
  value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const sanitizeWholePercent = (value: string | number | undefined | null) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(Math.max(Math.trunc(numeric), 0), 100);
};

const addTaxGroup = (groups: Map<number, TaxRateGroup>, rate: number, taxableBase: number, taxAmount: number) => {
  const safeRate = sanitizeWholePercent(rate);
  const current = groups.get(safeRate) ?? { rate: safeRate, taxableBase: 0, taxAmount: 0 };
  groups.set(safeRate, {
    rate: safeRate,
    taxableBase: roundMoney(current.taxableBase + taxableBase),
    taxAmount: roundMoney(current.taxAmount + taxAmount),
  });
};

const sortedTaxGroups = (groups: Map<number, TaxRateGroup>, includeZero = false) =>
  Array.from(groups.values())
    .filter((group) => group.taxAmount > 0 || (includeZero && group.taxableBase > 0))
    .sort((left, right) => right.rate - left.rate);

const emptyLine = (): ExpenseLine => ({
  id: createClientId(),
  sku: "",
  desc: "",
  detail: "",
  qty: 1,
  unit: "item",
  price: 0,
  vat: 7,
  vatRate: 7,
  vatAmount: 0,
  withholdingRate: 0,
  withholdingAmount: 0,
});

const findProduct = (products: Product[], value: string) => {
  const query = value.trim().toLowerCase();
  return products.find(
    (product) => product.sku.toLowerCase() === query || product.name.toLowerCase() === query
  );
};

const hydrateLineFromProduct = (line: ExpenseLine, product: Product, vatEnabled: boolean): ExpenseLine => ({
  ...line,
  sku: product.sku,
  desc: product.name,
  detail: product.productType === "service" ? "Service item" : product.stockSummary ?? "",
  unit: product.productType === "service" ? "service" : "item",
  price: product.averageCost ?? product.openingCost ?? product.price ?? 0,
  vat: vatEnabled ? 7 : 0,
  vatRate: vatEnabled ? 7 : 0,
});

const getExpenseRoute = (documentId: string) => `/expense/documents?document=${encodeURIComponent(documentId)}`;

const PurchaseCreate = () => {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const previewRef = useRef<HTMLDivElement>(null);
  const { data, refresh } = useAppData();
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["none"]);
  const realTypes = useMemo(() => getRealDocumentTypes(selectedTypes), [selectedTypes]);
  const selectedType = (realTypes[0] as ExpenseDocType | undefined) ?? null;
  const title = selectedType ? documentTitles[selectedType] : null;
  const [vendor, setVendor] = useState(data.vendors[0]?.name ?? "");
  const [projectId, setProjectId] = useState("");
  const [issueDate, setIssueDate] = useState(todayText());
  const [expectedDate, setExpectedDate] = useState(todayText());
  const [paymentTerm, setPaymentTerm] = useState("0");
  const [reference, setReference] = useState("");
  const [sourceDocumentType, setSourceDocumentType] = useState("");
  const [sourceDocumentNumber, setSourceDocumentNumber] = useState("");
  const [category, setCategory] = useState("Office Supplies");
  const [paymentStatus, setPaymentStatus] = useState("unpaid");
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [vatEnabled, setVatEnabled] = useState(true);
  const [withholdingRate, setWithholdingRate] = useState(0);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<ExpenseLine[]>([emptyLine()]);
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFiles>({
    invoiceReceipt: [],
    paymentEvidence: [],
    deliveryEvidence: [],
    withholdingTaxEvidence: [],
  });
  const [sourceDocumentModalOpen, setSourceDocumentModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [withholdingModalOpen, setWithholdingModalOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [submitting, setSubmitting] = useState<"draft" | "create" | null>(null);
  const [downloading, setDownloading] = useState(false);
  const payables = useMemo(() => buildPayables(data), [data]);
  const taxText = purchaseTaxCopy[i18n.language?.startsWith("th") ? "th" : "en"];
  const companyVatRegistered = data.policySummary?.vatRegistered !== false;
  const documentSettings = data.policySummary?.documents;
  const perLineWithholdingTax = Boolean(documentSettings?.perLineWithholdingTax);
  const effectiveVatEnabled = companyVatRegistered && vatEnabled;
  const transactionType = useMemo(
    () => (lines.length > 0 && lines.every((line) => line.unit.toLowerCase().includes("service")) ? "service" : "goods"),
    [lines]
  );
  const taxGuidanceMessages = useMemo(() => {
    const messages: string[] = [];
    if (!companyVatRegistered) {
      messages.push(t("taxGuidance.companyNotVatRegistered"));
    }
    if (effectiveVatEnabled && selectedType === "receive") {
      messages.push(t("taxGuidance.deliveryMayCreateTaxPoint"));
    }
    if (effectiveVatEnabled && paymentStatus === "paid") {
      messages.push(t("taxGuidance.paymentBeforeDelivery"));
    }
    if (effectiveVatEnabled && (selectedType === "expense" || selectedType === "vendor_invoice" || sourceDocumentType === "tax_invoice")) {
      messages.push(t("taxGuidance.taxInvoiceRecommended"));
    }
    return Array.from(new Set(messages));
  }, [companyVatRegistered, effectiveVatEnabled, paymentStatus, selectedType, sourceDocumentType, t]);

  const documentNumber = useMemo(() => {
    if (!selectedType || !title) return "";
    const next =
      selectedType === "purchase_order"
        ? data.purchaseOrders.length + 1
        : selectedType === "receive"
          ? data.receives.length + 1
          : selectedType === "withholding_tax"
            ? data.withholdingTaxDocuments.length + 1
          : selectedType === "supplier_payment"
              ? data.vendorPayments.length + 1
              : selectedType === "advance_payment"
                ? data.vendorPayments.length + 1
              : data.expenses.length + 1;
    return `${title.prefix}-2026-${String(next).padStart(4, "0")}`;
  }, [data.expenses.length, data.purchaseOrders.length, data.receives.length, data.vendorPayments.length, data.withholdingTaxDocuments.length, selectedType, title]);

  useEffect(() => {
    if (!companyVatRegistered) {
      setVatEnabled(false);
      setLines((current) => current.map((line) => ({ ...line, vat: 0, vatRate: 0, vatAmount: 0 })));
    }
  }, [companyVatRegistered]);

  const totals = useMemo(() => {
    const vatGroups = new Map<number, TaxRateGroup>();
    const withholdingGroups = new Map<number, TaxRateGroup>();
    const amountBeforeVat = roundMoney(
      lines.reduce((sum, line) => sum + Number(line.qty || 0) * Number(line.price || 0), 0)
    );
    let vatAmount = 0;
    lines.forEach((line) => {
      const taxableBase = roundMoney(Number(line.qty || 0) * Number(line.price || 0));
      const vatRate = effectiveVatEnabled ? sanitizeWholePercent(line.vatRate ?? line.vat ?? 7) : 0;
      const lineVatAmount = roundMoney(taxableBase * (vatRate / 100));
      const lineWithholdingRate = perLineWithholdingTax
        ? sanitizeWholePercent(line.withholdingRate ?? 0)
        : sanitizeWholePercent(withholdingRate);
      const lineWithholdingAmount = roundMoney(taxableBase * (lineWithholdingRate / 100));
      vatAmount = roundMoney(vatAmount + lineVatAmount);
      addTaxGroup(vatGroups, vatRate, taxableBase, lineVatAmount);
      addTaxGroup(withholdingGroups, lineWithholdingRate, taxableBase, lineWithholdingAmount);
    });
    const grandTotal = roundMoney(amountBeforeVat + vatAmount);
    const groupedWithholding = sortedTaxGroups(withholdingGroups);
    const withholdingAmount = roundMoney(groupedWithholding.reduce((sum, group) => sum + group.taxAmount, 0));
    return {
      subtotal: amountBeforeVat,
      amountBeforeVat,
      vatAmount,
      vatGroups: sortedTaxGroups(vatGroups, effectiveVatEnabled),
      grandTotal,
      withholdingGroups: groupedWithholding,
      withholdingAmount,
      amountDue: roundMoney(grandTotal - withholdingAmount),
    };
  }, [effectiveVatEnabled, lines, perLineWithholdingTax, withholdingRate]);
  const subtotal = totals.subtotal;
  const amountBeforeVat = totals.amountBeforeVat;
  const vatAmount = totals.vatAmount;
  const grandTotal = totals.grandTotal;
  const withholdingAmount = totals.withholdingAmount;
  const amountDue = totals.amountDue;
  const references = useMemo(
    () =>
      [...data.purchaseOrders, ...data.receives, ...data.expenses].map((doc) => ({
        id: doc.id,
        label: `${doc.id} - ${"party" in doc ? doc.party : doc.vendor}`,
      })),
    [data.expenses, data.purchaseOrders, data.receives]
  );

  const missingEvidence = useMemo<EvidenceType[]>(() => {
    if (selectedType !== "expense") return [];
    return (["invoiceReceipt", "paymentEvidence", "deliveryEvidence"] as EvidenceType[]).filter(
      (type) => evidenceFiles[type].length === 0
    );
  }, [evidenceFiles, selectedType]);

  const handleTypeChange = (values: string[]) => {
    const real = getRealDocumentTypes(values);
    setSelectedTypes(real.length ? [real[real.length - 1]] : values.includes("none") ? ["none"] : []);
    setPreview(false);
    setSourceDocumentType("");
    setSourceDocumentModalOpen(false);
  };

  const updateLine = (id: string, key: keyof ExpenseLine, value: string | number) => {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== id) return line;
        const numericValue =
          key === "vat" || key === "vatRate" || key === "withholdingRate"
            ? sanitizeWholePercent(value)
            : Number(value) || 0;
        const next = {
          ...line,
          [key]: ["sku", "desc", "detail", "unit"].includes(key) ? String(value) : numericValue,
          ...(key === "vat" ? { vatRate: numericValue } : {}),
        };
        if (key === "sku" || key === "desc") {
          const product = findProduct(data.products, String(value));
          return product ? hydrateLineFromProduct(next, product, effectiveVatEnabled) : next;
        }
        return next;
      })
    );
  };

  const addLine = () => setLines((current) => [...current, emptyLine()]);
  const removeLine = (id: string) => setLines((current) => current.filter((line) => line.id !== id));

  const updateEvidenceFiles = (type: EvidenceType, files: FileList | null) => {
    setEvidenceFiles((current) => ({ ...current, [type]: Array.from(files ?? []) }));
  };

  const validateForPreview = () => {
    const missing: string[] = [];
    if (!selectedType) missing.push(t("expenseCreate.validation.documentType"));
    if (selectedType === "expense" && !sourceDocumentType) missing.push(t("expenseCreate.validation.sourceDocumentType"));
    if (!vendor) missing.push(t("expenseCreate.validation.vendor"));
    if (!issueDate) missing.push(t("expenseCreate.validation.issueDate"));
    if (!documentNumber) missing.push(t("expenseCreate.validation.documentNumber"));
    if (!lines.some((line) => line.desc && line.qty > 0)) missing.push(t("expenseCreate.validation.lineItem"));
    if (missing.length) {
      toast.error(t("expenseCreate.toast.requiredMissing", { count: missing.length }), {
        description: missing.join(", "),
      });
      return false;
    }
    return true;
  };

  const createMissingEvidenceTasks = (createdId: string) => {
    const tasks: RemainingTask[] = missingEvidence.map((type) => ({
      id: `${createdId}-${type}`,
      title: t("expenseCreate.tasks.attachEvidence", {
        evidence: t(sourceDocumentCategoryLabels[type].labelKey),
        documentId: createdId,
      }),
      relatedDocumentNumber: createdId,
      documentType: title?.en ?? "Record Expense",
      missingEvidenceType: type,
      createdDate: todayText(),
      status: "pending",
      documentPath: getExpenseRoute(createdId),
    }));
    if (tasks.length) {
      upsertRemainingTasks(tasks);
      toast.warning(t("expenseCreate.toast.remainingTasksCreated", { count: tasks.length }));
    }
  };

  const uploadEvidenceFor = async (createdId: string) => {
    const categories: Record<EvidenceType, string> = {
      invoiceReceipt: "invoice-receipt",
      paymentEvidence: "payment-evidence",
      deliveryEvidence: "delivery-evidence",
      withholdingTaxEvidence: "withholding-tax-evidence",
    };
    for (const [type, files] of Object.entries(evidenceFiles) as Array<[EvidenceType, File[]]>) {
      if (files.length) {
        await uploadAttachments({
          entityType: "expense",
          entityId: createdId,
          files,
          category: categories[type],
          tags: [type, "source-document"],
        });
      }
    }
  };

  const submit = async (mode: "draft" | "create") => {
    if (!selectedType || !title) {
      toast.error(t("expenseCreate.toast.selectDocumentType"));
      return;
    }
    if (selectedType === "supplier_payment" || selectedType === "advance_payment" || selectedType === "withholding_tax") {
      toast.error(t("expenseCreate.toast.useQuickAction"));
      return;
    }
    if (!preview) {
      toast.error(t("expenseCreate.toast.previewRequired"));
      return;
    }

    setSubmitting(mode);
    try {
      const savedLines = lines.map((line) => {
        const taxableBase = roundMoney(Number(line.qty || 0) * Number(line.price || 0));
        const vatRate = effectiveVatEnabled ? sanitizeWholePercent(line.vatRate ?? line.vat ?? 7) : 0;
        const withholdingLineRate = perLineWithholdingTax
          ? sanitizeWholePercent(line.withholdingRate ?? 0)
          : sanitizeWholePercent(withholdingRate);
        return {
          ...line,
          tax: vatRate,
          vatRate,
          vatAmount: roundMoney(taxableBase * (vatRate / 100)),
          withholdingRate: withholdingLineRate,
          withholdingAmount: roundMoney(taxableBase * (withholdingLineRate / 100)),
          totalAmount: roundMoney(taxableBase + roundMoney(taxableBase * (vatRate / 100))),
        };
      });
      if (selectedType === "expense" || selectedType === "vendor_invoice") {
        const created = await createExpense({
          id: documentNumber,
          vendor,
          category,
          date: issueDate,
          amount: grandTotal,
          paymentMethod,
          currency: "THB",
          projectId,
          due: expectedDate,
          reference: sourceDocumentNumber || reference,
          notes,
          status: mode === "draft" ? "draft" : paymentStatus === "paid" ? "paid" : "pending",
          sourceDocumentId: reference,
          sourceDocumentType,
          documentTypes: [selectedType],
          documentTitle: title.th,
          documentVariant: title.en,
          transactionType,
          deliveryDate: undefined,
          paymentDate: paymentStatus === "paid" ? issueDate : undefined,
          serviceCompletedDate: transactionType === "service" ? issueDate : undefined,
          paymentSummary: {
            paid: paymentStatus === "paid" ? grandTotal : 0,
            remaining: paymentStatus === "paid" ? 0 : grandTotal,
            status: paymentStatus,
            lastPaymentMethod: paymentMethod,
          },
          lines: savedLines,
          vatEnabled: effectiveVatEnabled,
          vatRate: effectiveVatEnabled ? 7 : 0,
          taxAmount: vatAmount,
          vatGroups: totals.vatGroups,
          withholdingRate: perLineWithholdingTax ? 0 : sanitizeWholePercent(withholdingRate),
          withholdingAmount,
          withholdingGroups: totals.withholdingGroups,
          totalWithholdingTax: withholdingAmount,
          amountDue,
          documentSettingsSnapshot: documentSettings,
          sourceDocumentNumber,
          sourceDocuments: {
            invoiceReceipt: evidenceFiles.invoiceReceipt.map((file) => file.name),
            paymentEvidence: evidenceFiles.paymentEvidence.map((file) => file.name),
            deliveryEvidence: evidenceFiles.deliveryEvidence.map((file) => file.name),
            withholdingTaxEvidence: evidenceFiles.withholdingTaxEvidence.map((file) => file.name),
          },
          evidenceStatus: missingEvidence.length ? "missing" : "complete",
        } as Parameters<typeof createExpense>[0]);
        await uploadEvidenceFor(created.id);
        createMissingEvidenceTasks(created.id);
        await refresh();
        toast.success(mode === "draft" ? t("expenseCreate.toast.draftSaved", { id: created.id }) : t("expenseCreate.toast.expenseCreated", { id: created.id }));
        nav("/expense/documents");
        return;
      }

      const created = await createDocument(selectedType, {
        id: documentNumber,
        number: documentNumber,
        vendor,
        date: issueDate,
        due: expectedDate,
        reference,
        currency: "THB",
        projectId,
        paymentTerms: `${paymentTerm} days`,
        notes,
        status: mode === "draft" ? "draft" : "pending",
        documentTypes: [selectedType],
        documentTitle: title.th,
        documentVariant: title.en,
        transactionType,
        deliveryDate: selectedType === "receive" ? issueDate : undefined,
        paymentDate: paymentStatus === "paid" ? issueDate : undefined,
        serviceCompletedDate: transactionType === "service" ? issueDate : undefined,
        amount: grandTotal,
        subtotal: amountBeforeVat,
        taxAmount: vatAmount,
        vatEnabled: effectiveVatEnabled,
        withholdingRate: perLineWithholdingTax ? 0 : sanitizeWholePercent(withholdingRate),
        withholdingAmount,
        totalWithholdingTax: withholdingAmount,
        amountDue,
        vatGroups: totals.vatGroups,
        withholdingGroups: totals.withholdingGroups,
        documentSettingsSnapshot: documentSettings,
        lines: savedLines,
      });
      await refresh();
      toast.success(mode === "draft" ? t("expenseCreate.toast.draftSaved", { id: created.id }) : t("expenseCreate.toast.documentCreated", { document: title.en, id: created.id }));
      nav("/expense/documents");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("expenseCreate.toast.unableToSave"));
    } finally {
      setSubmitting(null);
    }
  };

  const downloadPdf = async () => {
    if (!previewRef.current || !title) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(previewRef.current, { scale: 2, backgroundColor: "#ffffff" });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let position = 0;
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, position, imgWidth, imgHeight);
      let remaining = imgHeight - pageHeight;
      while (remaining > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, position, imgWidth, imgHeight);
        remaining -= pageHeight;
      }
      pdf.save(`${documentNumber}-${title.en.replace(/\s+/g, "-")}.pdf`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("expenseCreate.toast.unableToDownloadPdf"));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title={t("expenseCreate.title")}
        description={t("expenseCreate.description")}
        breadcrumbs={[{ label: t("common.expense") }, { label: t("common.create") }]}
      />

      <Card className="card-premium mb-4 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold">{t("expenseCreate.documentTypes.title")}</h2>
            <p className="text-xs text-muted-foreground">{t("expenseCreate.documentTypes.description")}</p>
          </div>
          <Badge variant="secondary">{title ? title.en : t("incomeCreate.noDocumentSelected")}</Badge>
        </div>
        <DocumentTypeSelector
          options={PURCHASE_DOCUMENT_TYPE_OPTIONS}
          selectedValues={selectedTypes}
          onSelectedValuesChange={handleTypeChange}
          otherMenuLabel={t("expenseCreate.documentTypes.otherDocuments")}
        />
      </Card>

      {!selectedType ? (
        <Card className="p-8 text-center text-muted-foreground">{t("expenseCreate.emptyState")}</Card>
      ) : selectedType === "supplier_payment" || selectedType === "advance_payment" ? (
        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold">
            {selectedType === "advance_payment" ? t("expenseCreate.documentTypes.advancePayment") : t("expenseCreate.documentTypes.supplierPayment")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedType === "advance_payment" ? t("expenseCreate.guidance.advancePayment") : t("expenseCreate.guidance.supplierPayment")}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="button" onClick={() => setPaymentModalOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> {t("expenseCreate.actions.recordSupplierPayment")}
            </Button>
            <Button type="button" variant="outline" onClick={() => nav("/payment/transactions?type=supplier_payment")}>
              {t("expenseCreate.actions.viewPayments")}
            </Button>
          </div>
          <PaymentActionModal
            kind="vendor_payment"
            open={paymentModalOpen}
            onOpenChange={setPaymentModalOpen}
            payables={payables}
            onSaved={() => void refresh()}
          />
        </Card>
      ) : selectedType === "withholding_tax" ? (
        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold">{t("expenseCreate.documentTypes.withholdingTax")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("expenseCreate.guidance.withholdingTax")}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="button" onClick={() => setWithholdingModalOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> {t("documentActions.createWhtCertificate")}
            </Button>
            <Button type="button" variant="outline" onClick={() => nav("/tax/withholding-tax")}>
              {t("expenseCreate.actions.viewWhtDocuments")}
            </Button>
          </div>
          <ExpenseDocumentModal
            kind="withholding_tax"
            open={withholdingModalOpen}
            onOpenChange={setWithholdingModalOpen}
            payables={payables}
          />
        </Card>
      ) : selectedType === "expense" && !sourceDocumentType ? (
        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold">{t("expenseCreate.sourceDocuments.prompt")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("expenseCreate.sourceDocuments.description")}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sourceDocumentOptions.map((option) => (
              <Button
                key={option.id}
                type="button"
                variant="outline"
                className="h-auto justify-start py-4 text-left"
                onClick={() => {
                  setSourceDocumentType(option.id);
                  setSourceDocumentModalOpen(true);
                }}
              >
                <span>
                  <span className="block font-semibold">{t(option.labelKey)}</span>
                </span>
            </Button>
          ))}
        </div>
        <SourceDocumentModal
          open={sourceDocumentModalOpen}
          onOpenChange={setSourceDocumentModalOpen}
          evidenceFiles={evidenceFiles}
          missingEvidence={missingEvidence}
          onFilesChange={updateEvidenceFiles}
        />
      </Card>
      ) : preview ? (
        <div className="space-y-4">
          <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur">
            <Button variant="outline" onClick={() => setPreview(false)}>
              <ArrowLeft className="mr-1.5 h-4 w-4" /> {t("expenseCreate.actions.backToEdit")}
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void downloadPdf()} disabled={downloading}>
                {downloading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
                {t("common.downloadPdf")}
              </Button>
              <Button variant="outline" onClick={() => void submit("draft")} disabled={Boolean(submitting)}>
                {submitting === "draft" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                {t("common.saveDraft")}
              </Button>
              <Button onClick={() => void submit("create")} disabled={Boolean(submitting)}>
                {submitting === "create" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
                {t("common.createDocument")}
              </Button>
            </div>
          </div>
          <ExpensePreview
            refEl={previewRef}
            title={title!}
            documentNumber={documentNumber}
            vendor={vendor}
            issueDate={issueDate}
            expectedDate={expectedDate}
            reference={reference || sourceDocumentNumber}
            project={data.projects.find((project) => project.id === projectId)?.name ?? ""}
            paymentMethod={paymentMethod}
            lines={lines}
            subtotal={subtotal}
            vatGroups={totals.vatGroups}
            vatAmount={vatAmount}
            grandTotal={grandTotal}
            withholdingRate={withholdingRate}
            withholdingGroups={totals.withholdingGroups}
            withholdingAmount={withholdingAmount}
            amountDue={amountDue}
            taxLabels={taxText}
            notes={notes}
          />
        </div>
      ) : (
        <Card className="mx-auto max-w-6xl bg-white p-6 text-slate-950 shadow-xl">
          <div className="flex flex-wrap justify-between gap-6 border-b pb-5">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{title?.th}</h2>
                <p className="text-sm text-slate-500">{title?.en}</p>
              </div>
            </div>
            <div className="min-w-[240px] rounded-lg border border-slate-200 p-4 text-sm">
              <p className="text-xs text-slate-500">{t("expenseCreate.fields.documentNumber")}</p>
              <p className="font-mono text-lg font-bold text-primary">{documentNumber}</p>
              {selectedType === "expense" ? (
                <p className="mt-2 text-xs text-slate-500">
                  {t("expenseCreate.fields.source")}: {t(sourceDocumentOptions.find((option) => option.id === sourceDocumentType)?.labelKey ?? "expenseCreate.sourceDocuments.other")}
                </p>
              ) : null}
            </div>
          </div>

          {taxGuidanceMessages.length ? (
            <Alert className="mt-4 border-amber-300 bg-amber-50 text-amber-950">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-semibold">{t("taxGuidance.title")}</p>
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  {taxGuidanceMessages.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <PaperField label={t("expenseCreate.fields.vendorRequired")}>
              <Select value={vendor} onValueChange={setVendor}>
                <SelectTrigger><SelectValue placeholder={t("expenseCreate.fields.selectSupplier")} /></SelectTrigger>
                <SelectContent>
                  {data.vendors.map((item) => (
                    <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PaperField>
            <PaperField label={t("reports.projects.fields.project")}>
              <Select value={projectId || "none"} onValueChange={(value) => setProjectId(value === "none" ? "" : value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("expenseCreate.fields.noProject")}</SelectItem>
                  {data.projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>{project.code} - {project.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PaperField>
            <PaperField label={selectedType === "expense" ? t("expenseCreate.fields.expenseDateRequired") : t("expenseCreate.fields.issueDateRequired")}>
              <Input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
            </PaperField>
            <PaperField label={selectedType === "expense" ? t("expenseCreate.fields.paymentDueDate") : t("expenseCreate.fields.expectedReceiveDate")}>
              <Input type="date" value={expectedDate} onChange={(event) => setExpectedDate(event.target.value)} />
            </PaperField>
            <PaperField label={t("expenseCreate.fields.referenceDocument")}>
              <Select value={reference || "none"} onValueChange={(value) => setReference(value === "none" ? "" : value)}>
                <SelectTrigger><SelectValue placeholder={t("expenseCreate.fields.linkExistingDocument")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("expenseCreate.fields.noReference")}</SelectItem>
                  {references.map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PaperField>
            {selectedType === "expense" ? (
              <PaperField label={t("expenseCreate.fields.sourceDocumentNumber")}>
                <Input value={sourceDocumentNumber} onChange={(event) => setSourceDocumentNumber(event.target.value)} />
              </PaperField>
            ) : (
              <PaperField label={t("expenseCreate.fields.creditPaymentTerm")}>
                <Input type="number" min={0} value={paymentTerm} onChange={(event) => setPaymentTerm(event.target.value)} />
              </PaperField>
            )}
            {selectedType === "expense" ? (
              <>
                <PaperField label={t("expenseCreate.fields.expenseCategory")}>
                  <Input value={category} onChange={(event) => setCategory(event.target.value)} />
                </PaperField>
                <PaperField label={t("expenseCreate.fields.paymentStatus")}>
                  <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unpaid">{t("paymentStatus.unpaid")}</SelectItem>
                      <SelectItem value="paid">{t("paymentStatus.paid")}</SelectItem>
                      <SelectItem value="partial">{t("paymentStatus.partial")}</SelectItem>
                    </SelectContent>
                  </Select>
                </PaperField>
                <PaperField label={t("payment.fields.paymentMethod")}>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bank Transfer">{t("payment.methods.bankTransfer")}</SelectItem>
                      <SelectItem value="Cash">{t("payment.methods.cash")}</SelectItem>
                      <SelectItem value="Credit Card">{t("payment.methods.creditCard")}</SelectItem>
                      <SelectItem value="Cheque">{t("payment.methods.cheque")}</SelectItem>
                      <SelectItem value="Other">{t("expenseCreate.fields.other")}</SelectItem>
                    </SelectContent>
                  </Select>
                </PaperField>
              </>
            ) : null}
            <PaperField label={t("expenseCreate.fields.vatSetting")}>
              <Select
                value={effectiveVatEnabled ? "vat" : "none"}
                onValueChange={(value) => setVatEnabled(companyVatRegistered && value === "vat")}
                disabled={!companyVatRegistered}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vat">{t("expenseCreate.fields.includeVat")}</SelectItem>
                  <SelectItem value="none">{t("expenseCreate.fields.noVat")}</SelectItem>
                </SelectContent>
              </Select>
              {!companyVatRegistered ? (
                <p className="mt-1 text-xs text-amber-700">
                  {taxText.vatDisabled}
                </p>
              ) : null}
            </PaperField>
          </div>

          <LineTable
            lines={lines}
            products={data.products}
            vatEnabled={effectiveVatEnabled}
            perLineWithholdingTax={perLineWithholdingTax}
            whtLabel={taxText.whtPercent}
            onChange={updateLine}
            onAdd={addLine}
            onRemove={removeLine}
          />

          <div className="mt-5 grid gap-5 md:grid-cols-[1fr_340px]">
            <div className="space-y-4">
              {selectedType === "expense" ? (
                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{t("expenseCreate.evidence.sourceDocuments")}</h3>
                      <p className="text-xs text-muted-foreground">
                        {t("expenseCreate.evidence.remainingTasksHelper")}
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setSourceDocumentModalOpen(true)}>
                      <Upload className="mr-1.5 h-4 w-4" /> {t("expenseCreate.evidence.attachSourceDocuments")}
                    </Button>
                  </div>
                  {missingEvidence.length ? (
                    <div className="mt-3 space-y-2">
                      {missingEvidence.map((type) => (
                        <Alert key={type} className="border-amber-300 bg-amber-50 text-amber-950">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>{t(sourceDocumentCategoryLabels[type].missingKey)}</AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 flex items-center gap-2 text-sm text-emerald-700">
                      <Check className="h-4 w-4" /> {t("expenseCreate.evidence.complete")}
                    </p>
                  )}
                </div>
              ) : null}
              <PaperField label={t("expenseCreate.fields.notes")}>
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder={t("expenseCreate.fields.notesPlaceholder")}
                />
              </PaperField>
              <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 p-4 text-center text-sm">
                <div className="min-h-28 pt-14">
                  <div className="border-t pt-2">{t("expenseCreate.preview.supplierReceiver")}</div>
                </div>
                <div className="min-h-28 pt-14">
                  <div className="border-t pt-2">{t("expenseCreate.preview.authorizedBy")}</div>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <SummaryLine label={t("expenseCreate.summary.subtotal")} value={subtotal} />
              <SummaryLine label={taxText.amountBeforeVat} value={amountBeforeVat} />
              {totals.vatGroups.map((group) => (
                <SummaryLine key={`purchase-vat-${group.rate}`} label={`VAT ${group.rate}%`} value={group.taxAmount} />
              ))}
              <SummaryLine label={t("expenseCreate.summary.grandTotal")} value={grandTotal} strong />
              {!perLineWithholdingTax ? (
                <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
                  <Label className="text-xs text-muted-foreground">{taxText.whtPercent}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    inputMode="numeric"
                    value={sanitizeWholePercent(withholdingRate)}
                    onChange={(event) => setWithholdingRate(sanitizeWholePercent(event.target.value))}
                    className="h-8 w-24 text-right"
                  />
                </div>
              ) : null}
              {totals.withholdingGroups.map((group) => (
                <SummaryLine key={`purchase-wht-${group.rate}`} label={`${taxText.whtPercent.replace("%", "").trim()} ${group.rate}%`} value={group.taxAmount} />
              ))}
              {withholdingAmount > 0 ? <SummaryLine label={taxText.totalWithholdingTax} value={withholdingAmount} /> : null}
              <SummaryLine label={taxText.amountAfterWithholding} value={amountDue} strong />
            </div>
          </div>

          <SourceDocumentModal
            open={sourceDocumentModalOpen}
            onOpenChange={setSourceDocumentModalOpen}
            evidenceFiles={evidenceFiles}
            missingEvidence={missingEvidence}
            onFilesChange={updateEvidenceFiles}
          />

          <div className="sticky bottom-0 -mx-6 mt-8 flex items-center justify-between border-t bg-white/95 px-6 py-3 backdrop-blur">
            <div className="text-sm">
              <span className="font-semibold">{t("expenseCreate.summary.amountDue")}: THB {fmt(amountDue)}</span>
              {missingEvidence.length ? (
                <span className="ml-3 text-amber-700">{t("expenseCreate.evidence.warningCount", { count: missingEvidence.length })}</span>
              ) : null}
            </div>
            <Button onClick={() => validateForPreview() && setPreview(true)}>
              <Eye className="mr-1.5 h-4 w-4" /> {t("common.preview")}
            </Button>
          </div>
        </Card>
      )}
    </AppShell>
  );
};

const PaperField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <Label className="text-xs text-slate-500">{label}</Label>
    <div className="mt-1.5">{children}</div>
  </div>
);

const SummaryLine = ({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) => (
  <div className={`flex justify-between py-1 text-sm ${strong ? "font-bold" : ""}`}>
    <span className="text-muted-foreground">{label}</span>
    <span className="tabular-nums">THB {fmt(value)}</span>
  </div>
);

const LineTable = ({
  lines,
  products,
  vatEnabled,
  perLineWithholdingTax,
  whtLabel,
  onChange,
  onAdd,
  onRemove,
}: {
  lines: ExpenseLine[];
  products: Product[];
  vatEnabled: boolean;
  perLineWithholdingTax: boolean;
  whtLabel: string;
  onChange: (id: string, key: keyof ExpenseLine, value: string | number) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) => {
  const { t } = useTranslation();
  return (
  <div className="mt-5 overflow-x-auto">
    <datalist id="expense-product-codes">
      {products.map((product) => (
        <option key={product.sku} value={product.sku}>{product.name}</option>
      ))}
    </datalist>
    <datalist id="expense-product-names">
      {products.map((product) => (
        <option key={product.sku} value={product.name}>{product.sku}</option>
      ))}
    </datalist>
    <table className="w-full min-w-[920px] text-sm">
      <thead className="bg-slate-100 text-xs uppercase text-slate-600">
        <tr>
          <th className="px-2 py-2 text-left">{t("expenseCreate.lineTable.code")}</th>
          <th className="px-2 py-2 text-left">{t("expenseCreate.lineTable.descriptionDetail")}</th>
          <th className="px-2 py-2 text-right">{t("expenseCreate.lineTable.qty")}</th>
          <th className="px-2 py-2">{t("expenseCreate.lineTable.unit")}</th>
          <th className="px-2 py-2 text-right">{t("expenseCreate.lineTable.unitPrice")}</th>
          <th className="px-2 py-2 text-right">{t("expenseCreate.lineTable.vatPercent")}</th>
          {perLineWithholdingTax ? <th className="px-2 py-2 text-right">{whtLabel}</th> : null}
          <th className="px-2 py-2 text-right">{t("expenseCreate.lineTable.total")}</th>
          <th className="w-10" />
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => {
          const lineVat = vatEnabled ? sanitizeWholePercent(line.vatRate ?? line.vat ?? 0) : 0;
          const lineTotal = line.qty * line.price * (1 + lineVat / 100);
          return (
            <tr key={line.id} className="border-b">
              <td className="px-2 py-2 align-top">
                <Input
                  list="expense-product-codes"
                  value={line.sku}
                  onChange={(event) => onChange(line.id, "sku", event.target.value)}
                  className="h-8"
                />
              </td>
              <td className="px-2 py-2 align-top">
                <Input
                  list="expense-product-names"
                  value={line.desc}
                  onChange={(event) => onChange(line.id, "desc", event.target.value)}
                  className="h-8"
                />
                <Input
                  value={line.detail}
                  onChange={(event) => onChange(line.id, "detail", event.target.value)}
                  placeholder={t("expenseCreate.lineTable.detailPlaceholder")}
                  className="mt-1 h-7 text-xs"
                />
              </td>
              <td className="px-2 py-2 align-top">
                <Input
                  type="number"
                  value={line.qty}
                  onChange={(event) => onChange(line.id, "qty", event.target.value)}
                  className="h-8 text-right"
                />
              </td>
              <td className="px-2 py-2 align-top">
                <Input value={line.unit} onChange={(event) => onChange(line.id, "unit", event.target.value)} className="h-8" />
              </td>
              <td className="px-2 py-2 align-top">
                <Input
                  type="number"
                  value={line.price}
                  onChange={(event) => onChange(line.id, "price", event.target.value)}
                  className="h-8 text-right"
                />
              </td>
              <td className="px-2 py-2 align-top">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  inputMode="numeric"
                  value={lineVat}
                  disabled={!vatEnabled}
                  onChange={(event) => onChange(line.id, "vat", event.target.value)}
                  className="h-8 text-right"
                />
              </td>
              {perLineWithholdingTax ? (
                <td className="px-2 py-2 align-top">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    inputMode="numeric"
                    value={sanitizeWholePercent(line.withholdingRate ?? 0)}
                    onChange={(event) => onChange(line.id, "withholdingRate", event.target.value)}
                    className="h-8 text-right"
                  />
                </td>
              ) : null}
              <td className="px-2 py-2 text-right align-top font-semibold">THB {fmt(lineTotal)}</td>
              <td className="px-2 py-2 align-top">
                <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(line.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
    <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onAdd}>
      <Plus className="mr-1.5 h-4 w-4" /> {t("common.addLine")}
    </Button>
  </div>
  );
};

const SourceDocumentModal = ({
  open,
  onOpenChange,
  evidenceFiles,
  missingEvidence,
  onFilesChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evidenceFiles: EvidenceFiles;
  missingEvidence: EvidenceType[];
  onFilesChange: (type: EvidenceType, files: FileList | null) => void;
}) => {
  const { t } = useTranslation();
  return (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-4xl">
      <DialogHeader>
        <DialogTitle>{t("expenseCreate.evidence.attachSourceDocuments")}</DialogTitle>
      </DialogHeader>
      <p className="text-sm text-muted-foreground">
        {t("expenseCreate.evidence.saveWithoutAllFiles")}
      </p>
      {missingEvidence.length ? (
        <div className="grid gap-2">
          {missingEvidence.map((type) => (
            <Alert key={type} className="border-amber-300 bg-amber-50 text-amber-950">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{t(sourceDocumentCategoryLabels[type].missingKey)}</AlertDescription>
            </Alert>
          ))}
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-emerald-700">
          <Check className="h-4 w-4" /> {t("expenseCreate.evidence.complete")}
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        {(Object.keys(sourceDocumentCategoryLabels) as EvidenceType[]).map((type) => (
          <EvidenceInput
            key={type}
            label={t(sourceDocumentCategoryLabels[type].labelKey)}
            type={type}
            files={evidenceFiles[type]}
            onFilesChange={onFilesChange}
          />
        ))}
      </div>
      <DialogFooter>
        <Button type="button" onClick={() => onOpenChange(false)}>{t("expenseCreate.evidence.saveSourceDocuments")}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  );
};

const EvidenceInput = ({
  label,
  type,
  files,
  onFilesChange,
}: {
  label: string;
  type: EvidenceType;
  files: File[];
  onFilesChange: (type: EvidenceType, files: FileList | null) => void;
}) => {
  const { t } = useTranslation();
  return (
  <div className="rounded-md border border-slate-200 p-3">
    <Label className="whitespace-pre-line text-xs text-slate-500">{label}</Label>
    <Input className="mt-2 text-xs" type="file" multiple onChange={(event) => onFilesChange(type, event.target.files)} />
    <p className="mt-1 text-[11px] text-muted-foreground">{files.length ? t("inventory.evidence.filesSelected", { count: files.length }) : t("expenseCreate.evidence.noFileSelected")}</p>
    {files.some((file) => file.type.startsWith("image/")) ? (
      <div className="mt-2 grid grid-cols-3 gap-1">
        {files
          .filter((file) => file.type.startsWith("image/"))
          .slice(0, 6)
          .map((file, index) => (
            <img
              key={`${file.name}-${index}`}
              src={URL.createObjectURL(file)}
              alt={file.name}
              className="h-14 w-full rounded border object-cover"
            />
          ))}
      </div>
    ) : null}
  </div>
  );
};

const ExpensePreview = ({
  refEl,
  title,
  documentNumber,
  vendor,
  issueDate,
  expectedDate,
  reference,
  project,
  paymentMethod,
  lines,
  subtotal,
  vatGroups,
  vatAmount,
  grandTotal,
  withholdingRate,
  withholdingGroups,
  withholdingAmount,
  amountDue,
  taxLabels,
  notes,
}: {
  refEl: React.RefObject<HTMLDivElement>;
  title: { en: string; th: string };
  documentNumber: string;
  vendor: string;
  issueDate: string;
  expectedDate: string;
  reference: string;
  project: string;
  paymentMethod: string;
  lines: ExpenseLine[];
  subtotal: number;
  vatGroups: TaxRateGroup[];
  vatAmount: number;
  grandTotal: number;
  withholdingRate: number;
  withholdingGroups: TaxRateGroup[];
  withholdingAmount: number;
  amountDue: number;
  taxLabels: typeof purchaseTaxCopy.en | typeof purchaseTaxCopy.th;
  notes: string;
}) => (
  <div ref={refEl} className="mx-auto max-w-[794px] bg-white p-8 text-slate-950 shadow-xl print:shadow-none">
    <div className="flex justify-between gap-6 border-b pb-5">
      <div className="flex gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded border bg-slate-50">
          <FileText className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">{title.th}</h2>
          <p className="text-sm text-slate-500">{title.en}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-mono text-lg font-bold text-primary">{documentNumber}</p>
        <p className="text-xs text-slate-500">Original / Copy</p>
      </div>
    </div>

    <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
      <div className="rounded border p-4">
        <p className="text-xs text-slate-500">Supplier / Vendor</p>
        <p className="font-semibold">{vendor}</p>
        {project ? <p className="mt-2 text-xs text-slate-500">Project: {project}</p> : null}
      </div>
      <div className="rounded border p-4">
        <PreviewInfo label="Issue date" value={issueDate} />
        <PreviewInfo label="Expected/Due date" value={expectedDate} />
        {reference ? <PreviewInfo label="Reference" value={reference} /> : null}
      </div>
    </div>

    <table className="mt-5 w-full text-sm">
      <thead className="bg-slate-100 text-xs uppercase text-slate-600">
        <tr>
          <th className="px-2 py-2 text-left">Code</th>
          <th className="px-2 py-2 text-left">Description</th>
          <th className="px-2 py-2 text-right">Qty</th>
          <th className="px-2 py-2 text-right">VAT %</th>
          {withholdingGroups.length ? <th className="px-2 py-2 text-right">{taxLabels.whtPercent}</th> : null}
          <th className="px-2 py-2 text-right">Unit price</th>
          <th className="px-2 py-2 text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          <tr key={line.id} className="border-b">
            <td className="px-2 py-2">{line.sku}</td>
            <td className="px-2 py-2">
              <p>{line.desc}</p>
              {line.detail ? <p className="text-xs text-slate-500">{line.detail}</p> : null}
            </td>
            <td className="px-2 py-2 text-right">{line.qty} {line.unit}</td>
            <td className="px-2 py-2 text-right">{sanitizeWholePercent(line.vatRate ?? line.vat ?? 0)}%</td>
            {withholdingGroups.length ? <td className="px-2 py-2 text-right">{sanitizeWholePercent(line.withholdingRate ?? 0)}%</td> : null}
            <td className="px-2 py-2 text-right">{fmt(line.price)}</td>
            <td className="px-2 py-2 text-right font-semibold">{fmt(line.qty * line.price * (1 + sanitizeWholePercent(line.vatRate ?? line.vat ?? 0) / 100))}</td>
          </tr>
        ))}
      </tbody>
    </table>

    <div className="mt-5 grid grid-cols-[1fr_280px] gap-5">
      <div className="rounded border p-4 text-sm">
        <p className="font-semibold">Payment</p>
        <p className="mt-1 text-slate-600">{paymentMethod}</p>
        {notes ? (
          <>
            <p className="mt-4 font-semibold">Notes</p>
            <p className="whitespace-pre-line text-slate-600">{notes}</p>
          </>
        ) : null}
      </div>
      <div className="rounded border p-4">
        <SummaryLine label="Subtotal" value={subtotal} />
        {vatGroups.length ? (
          vatGroups.map((group) => (
            <SummaryLine key={`preview-vat-${group.rate}`} label={`VAT ${group.rate}%`} value={group.taxAmount} />
          ))
        ) : (
          <SummaryLine label="VAT" value={vatAmount} />
        )}
        <SummaryLine label="Grand total" value={grandTotal} strong />
        {withholdingGroups.length
          ? withholdingGroups.map((group) => (
            <SummaryLine key={`preview-wht-${group.rate}`} label={`${taxLabels.whtPercent.replace("%", "").trim()} ${group.rate}%`} value={group.taxAmount} />
          ))
        : withholdingRate > 0
            ? <SummaryLine label={`${taxLabels.whtPercent.replace("%", "").trim()} ${sanitizeWholePercent(withholdingRate)}%`} value={withholdingAmount} />
            : null}
        {withholdingAmount > 0 ? <SummaryLine label={taxLabels.totalWithholdingTax} value={withholdingAmount} /> : null}
        <SummaryLine label={taxLabels.amountAfterWithholding} value={amountDue} strong />
      </div>
    </div>

    <div className="mt-10 grid grid-cols-2 items-stretch gap-8 text-center text-sm">
      <div className="min-h-32 rounded border p-5 pt-20">
        <div className="border-t pt-2">Supplier / Receiver</div>
        <p className="mt-2 text-xs text-slate-500">Date ____ / ____ / ____</p>
      </div>
      <div className="min-h-32 rounded border p-5 pt-20">
        <div className="border-t pt-2">Authorized / Approved by</div>
        <p className="mt-2 text-xs text-slate-500">Date ____ / ____ / ____</p>
      </div>
    </div>
  </div>
);

const PreviewInfo = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-3">
    <span className="text-slate-500">{label}</span>
    <span className="font-medium">{value}</span>
  </div>
);

export default PurchaseCreate;

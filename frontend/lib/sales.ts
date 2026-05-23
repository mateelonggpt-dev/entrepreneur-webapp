import { calculateDocumentTotals } from "@/lib/domain/totals";
import { isEditableAfterPayment, requiresResetBeforeDelete } from "@/lib/domain/rules";
import type {
  AppData,
  DocumentKind,
  DocumentLine,
  DocumentSummary,
  Invoice,
  RecordStatus,
  SalesDocumentRecord,
} from "@/lib/types";

export const SALES_KIND_LABELS: Record<DocumentKind, string> = {
  quotation: "Quotation",
  invoice: "Invoice",
  receipt: "Receipt",
  billing: "Billing",
  credit_note: "Credit Note",
  debit_note: "Debit Note",
  deposit: "Deposit",
  purchase_order: "Purchase Order",
  receive: "Receive",
  expense: "Expense",
  withholding_tax: "Withholding Tax",
};

export const getLocalDateInputValue = (value = new Date()) => {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

export const addDaysToDateInputValue = (dateText: string, days: number) => {
  const base = new Date(`${dateText}T00:00:00`);
  base.setDate(base.getDate() + days);
  return getLocalDateInputValue(base);
};

export const invoiceToSummary = (invoice: Invoice): DocumentSummary => ({
  id: invoice.id,
  party: invoice.customer,
  date: invoice.date,
  amount: invoice.amount,
  status: invoice.status,
  kind: "invoice",
  linkedDocumentIds: invoice.linkedDocumentIds,
  documentVariant: invoice.documentVariant,
  documentTypes: invoice.documentTypes,
  documentTitle:
    invoice.documentTitle ||
    (invoice.isTaxInvoice || invoice.invoiceTaxType === "tax" || invoice.documentTypes?.includes("tax_invoice")
      ? "Tax Invoice"
      : undefined),
  invoiceTaxType:
    invoice.invoiceTaxType ||
    (invoice.isTaxInvoice || invoice.documentTypes?.includes("tax_invoice") ? "tax" : "normal"),
  isTaxInvoice: Boolean(invoice.isTaxInvoice || invoice.invoiceTaxType === "tax" || invoice.documentTypes?.includes("tax_invoice")),
  invoicePaymentMode: invoice.invoicePaymentMode,
  depositType: invoice.depositType,
  depositValue: invoice.depositValue,
  depositAmount: invoice.depositAmount,
  depositSourceDocumentId: invoice.depositSourceDocumentId,
  depositSourceDocumentType: invoice.depositSourceDocumentType,
  invoicePaymentSchedule: invoice.invoicePaymentSchedule,
  sourceInvoiceIds: invoice.sourceInvoiceIds,
  sourceBillingId: invoice.sourceBillingId,
  parentQuotationId: invoice.parentQuotationId,
  attachments: invoice.attachments,
  attachmentCount: invoice.attachments?.length,
});

export const summaryToSalesRecord = (summary: DocumentSummary): SalesDocumentRecord => ({
  id: summary.id,
  customer: summary.party,
  date: summary.date,
  amount: summary.amount,
  status: summary.status,
  documentType: summary.kind,
  linkedDocumentIds: summary.linkedDocumentIds,
  documentVariant: summary.documentVariant,
  documentTypes: summary.documentTypes,
  documentTitle: summary.documentTitle,
  sourceInvoiceIds: summary.sourceInvoiceIds,
  sourceBillingId: summary.sourceBillingId,
  parentQuotationId: summary.parentQuotationId,
  attachments: summary.attachments,
  notes: "",
});

export const collectSalesSummaries = (data: AppData) => [
  ...data.invoices.map(invoiceToSummary),
  ...data.quotations,
  ...data.receipts,
  ...data.billings,
  ...data.creditNotes,
  ...data.debitNotes,
  ...data.deposits,
];

export const buildSummaryIndex = (data: AppData) =>
  Object.fromEntries(collectSalesSummaries(data).map((summary) => [summary.id, summary]));

export const collectLinkedSummaries = (data: AppData, documentId: string) => {
  const summaryIndex = buildSummaryIndex(data);
  return (data.linkedDocumentGraph?.[documentId] ?? [])
    .map((id) => summaryIndex[id])
    .filter((summary): summary is DocumentSummary => Boolean(summary));
};

export const filterSummaries = (
  summaries: DocumentSummary[],
  {
    query,
    statuses,
    variants,
  }: {
    query?: string;
    statuses?: string[];
    variants?: string[];
  }
) => {
  const queryValue = (query ?? "").trim().toLowerCase();
  return summaries.filter((summary) => {
    const matchesQuery =
      !queryValue ||
      summary.id.toLowerCase().includes(queryValue) ||
      summary.party.toLowerCase().includes(queryValue) ||
      (summary.documentVariant ?? "").toLowerCase().includes(queryValue);

    const matchesStatus = !statuses?.length || statuses.includes(summary.status);
    const matchesVariant = !variants?.length || variants.includes(summary.documentVariant ?? "");
    return matchesQuery && matchesStatus && matchesVariant;
  });
};

export const getDocumentAmount = (document: SalesDocumentRecord) =>
  document.amount ??
  calculateDocumentTotals(document.lines ?? [], { defaultTaxRate: 7 }).total;

export const buildDefaultTimeline = ({
  document,
  linkedIds,
  attachmentCount,
}: {
  document: SalesDocumentRecord;
  linkedIds: string[];
  attachmentCount: number;
}) => {
  const customTimeline = document.timeline ?? [];
  if (customTimeline.length > 0) {
    return customTimeline;
  }

  const fallback: Array<{
    who: string;
    what: string;
    time: string;
    type: string;
    amount?: number;
  }> = [
    {
      who: "System",
      what: `created ${document.id}`,
      time: document.date,
      type: document.documentType ?? "document",
      amount: document.amount,
    },
  ];

  if (linkedIds.length > 0) {
    fallback.push({
      who: "System",
      what: `linked ${linkedIds.length} downstream document(s)`,
      time: document.date,
      type: "link",
    });
  }

  if (attachmentCount > 0) {
    fallback.push({
      who: "System",
      what: `attached ${attachmentCount} file(s)`,
      time: document.date,
      type: "attachment",
    });
  }

  return fallback;
};

export const calculateReceiptFooter = (
  baseAmount: number,
  adjustments: Array<{
    type: "special_discount" | "commission" | "service_fee" | "rounding";
    amount: number;
  }>
) => {
  const summary = {
    specialDiscount: 0,
    commission: 0,
    serviceFee: 0,
    rounding: 0,
  };

  adjustments.forEach((adjustment) => {
    if (adjustment.type === "special_discount") {
      summary.specialDiscount += adjustment.amount;
    }
    if (adjustment.type === "commission") {
      summary.commission += adjustment.amount;
    }
    if (adjustment.type === "service_fee") {
      summary.serviceFee += adjustment.amount;
    }
    if (adjustment.type === "rounding") {
      summary.rounding += adjustment.amount;
    }
  });

  const netReceivable =
    baseAmount -
    summary.specialDiscount -
    summary.commission +
    summary.serviceFee +
    summary.rounding;

  return {
    summary,
    netReceivable,
  };
};

export const buildInstallmentPlan = ({
  documentId,
  lines,
  splitMode,
  installmentCount,
}: {
  documentId: string;
  lines: DocumentLine[];
  splitMode: "amount" | "quantity";
  installmentCount: number;
}) => {
  const safeCount = Math.max(1, installmentCount);
  const baseTotals = calculateDocumentTotals(lines, { defaultTaxRate: 7 }).total;

  if (splitMode === "amount") {
    const perInstallment = Number((baseTotals / safeCount).toFixed(2));
    return Array.from({ length: safeCount }, (_, index) => ({
      id: `${documentId}-inst-${index + 1}`,
      label: `Installment ${index + 1}`,
      amount: index === safeCount - 1 ? Number((baseTotals - perInstallment * (safeCount - 1)).toFixed(2)) : perInstallment,
      status: "draft" as RecordStatus,
    }));
  }

  const lineBuckets = Array.from({ length: safeCount }, (_, index) => ({
    id: `${documentId}-inst-${index + 1}`,
    label: `Installment ${index + 1}`,
    amount: 0,
    qty: 0,
    status: "draft" as RecordStatus,
  }));

  lines.forEach((line) => {
    const quantityPerInstallment = Number((line.qty / safeCount).toFixed(2));
    lineBuckets.forEach((bucket, index) => {
      const isLast = index === safeCount - 1;
      const allocatedQty = isLast
        ? Number((line.qty - quantityPerInstallment * (safeCount - 1)).toFixed(2))
        : quantityPerInstallment;
      const amount = Number((allocatedQty * line.price * (1 + line.tax / 100)).toFixed(2));
      bucket.amount += amount;
      bucket.qty = Number(((bucket.qty ?? 0) + allocatedQty).toFixed(2));
    });
  });

  return lineBuckets.map((bucket) => ({
    ...bucket,
    amount: Number(bucket.amount.toFixed(2)),
  }));
};

export const buildInstallmentLines = ({
  lines,
  splitMode,
  installmentCount,
  installmentIndex,
}: {
  lines: DocumentLine[];
  splitMode: "amount" | "quantity";
  installmentCount: number;
  installmentIndex: number;
}) => {
  const safeCount = Math.max(1, installmentCount);

  if (splitMode === "amount") {
    const totalAmount = calculateDocumentTotals(lines, { defaultTaxRate: 7 }).total;
    const amountPerInstallment = Number((totalAmount / safeCount).toFixed(2));
    return [
      {
        id: `${installmentIndex + 1}`,
        desc: `Installment ${installmentIndex + 1} from quotation`,
        qty: 1,
        price:
          installmentIndex === safeCount - 1
            ? Number((totalAmount - amountPerInstallment * (safeCount - 1)).toFixed(2))
            : amountPerInstallment,
        tax: 0,
      },
    ];
  }

  return lines
    .map((line) => {
      const quantityPerInstallment = Number((line.qty / safeCount).toFixed(2));
      const allocatedQty =
        installmentIndex === safeCount - 1
          ? Number((line.qty - quantityPerInstallment * (safeCount - 1)).toFixed(2))
          : quantityPerInstallment;
      return {
        id: line.id,
        desc: line.desc,
        qty: allocatedQty,
        price: line.price,
        tax: line.tax,
      };
    })
    .filter((line) => line.qty > 0);
};

export const getEligibleBillingInvoices = (data: AppData, customer?: string) =>
  data.invoices.filter((invoice) => {
    const matchesCustomer = !customer || invoice.customer === customer;
    return matchesCustomer && ["sent", "overdue", "partial", "pending"].includes(invoice.status);
  });

export const getEligibleReceiptInvoices = (data: AppData, customer?: string) =>
  data.invoices.filter((invoice) => {
    const matchesCustomer = !customer || invoice.customer === customer;
    return matchesCustomer && ["sent", "overdue", "partial", "pending"].includes(invoice.status);
  });

export const summarizeSelectedInvoices = (data: AppData, ids: string[]) =>
  data.invoices
    .filter((invoice) => ids.includes(invoice.id))
    .reduce((sum, invoice) => sum + invoice.amount, 0);

export const isSalesDocumentEditable = ({
  status,
  lockAfterPayment,
}: {
  status: RecordStatus;
  lockAfterPayment: boolean;
}) =>
  isEditableAfterPayment({
    status,
    lockAfterPayment,
  });

export const salesDeleteRequiresReset = ({
  status,
  linkedCount,
  attachmentCount,
}: {
  status: RecordStatus;
  linkedCount: number;
  attachmentCount: number;
}) =>
  requiresResetBeforeDelete({
    status,
    linkedCount,
    attachmentCount,
  });

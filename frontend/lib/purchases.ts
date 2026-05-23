import { isEditableAfterPayment, requiresResetBeforeDelete } from "@/lib/domain/rules";
import type {
  AppData,
  Attachment,
  DocumentKind,
  DocumentSummary,
  Expense,
  PayableSummary,
  PurchaseDocumentRecord,
  RecordStatus,
  VendorPayment,
} from "@/lib/types";

export const PURCHASE_KIND_LABELS: Record<"purchase_order" | "receive" | "expense", string> = {
  purchase_order: "Purchase Order",
  receive: "Goods Received",
  expense: "Expense",
};

const buildSummaryIndex = (data: AppData) => {
  const summaries: DocumentSummary[] = [
    ...data.purchaseOrders,
    ...data.receives,
    ...data.expenses.map((expense) => ({
      id: expense.id,
      party: expense.vendor,
      date: expense.date,
      amount: expense.amount,
      status: expense.status,
      kind: "expense" as DocumentKind,
      linkedDocumentIds: expense.linkedDocumentIds,
    })),
    ...data.withholdingTaxDocuments.map((document) => ({
      id: document.id,
      party: document.vendor,
      date: document.date,
      amount: document.amount,
      status: document.status,
      kind: "withholding_tax" as DocumentKind,
    })),
  ];

  return Object.fromEntries(summaries.map((summary) => [summary.id, summary]));
};

export const collectPurchaseLinkedSummaries = (data: AppData, documentId: string) => {
  const summaryIndex = buildSummaryIndex(data);
  return (data.linkedDocumentGraph?.[documentId] ?? [])
    .map((linkedId) => summaryIndex[linkedId])
    .filter((summary): summary is DocumentSummary => Boolean(summary));
};

export const normalizePaymentSummary = (
  amount: number,
  summary?: PurchaseDocumentRecord["paymentSummary"]
) => {
  const paid = Number(summary?.paid ?? 0);
  const remaining = Math.max(0, Number(summary?.remaining ?? amount - paid));
  const status =
    summary?.status ??
    (remaining <= 0 ? "paid" : paid > 0 ? "partial" : "unpaid");

  return {
    paid,
    remaining,
    status,
    lastPaymentDate: summary?.lastPaymentDate,
    lastPaymentMethod: summary?.lastPaymentMethod,
    lastPaymentId: summary?.lastPaymentId,
  } as const;
};

export const buildPayables = (data: AppData): PayableSummary[] => {
  const expenseRows = data.expenses
    .filter((expense) => !["draft", "cancelled", "void"].includes(expense.status))
    .map((expense) => {
      const paymentSummary = normalizePaymentSummary(expense.amount, expense.paymentSummary);
      return {
        id: expense.id,
        sourceType: "expense" as const,
        vendor: expense.vendor,
        date: expense.date,
        due: expense.due || expense.date,
        amount: expense.amount,
        paid: paymentSummary.paid,
        remaining: paymentSummary.remaining,
        currency: expense.currency || "THB",
        status: expense.status,
        paymentStatus: paymentSummary.status,
        category: expense.category,
        linkedDocumentIds: expense.linkedDocumentIds,
        sourceDocumentId: expense.sourceDocumentId,
      };
    });

  const receiveRows = data.receives
    .map((summary) => {
      const paymentSummary = normalizePaymentSummary(summary.amount, summary.paymentSummary);
      return {
        id: summary.id,
        sourceType: "receive" as const,
        vendor: summary.party,
        date: summary.date,
        due: summary.date,
        amount: summary.amount,
        paid: paymentSummary.paid,
        remaining: paymentSummary.remaining,
        currency: "THB",
        status: summary.status,
        paymentStatus: paymentSummary.status,
        linkedDocumentIds: summary.linkedDocumentIds,
        sourceDocumentId: summary.sourceDocumentId,
      };
    })
    .filter((row) => !["draft", "cancelled", "void"].includes(row.status));

  return [...expenseRows, ...receiveRows]
    .filter((row) => row.remaining > 0)
    .sort((left, right) => right.date.localeCompare(left.date));
};

export const buildPurchaseTimeline = ({
  document,
  linkedIds,
  attachmentCount,
  payments,
}: {
  document: Pick<PurchaseDocumentRecord, "id" | "date" | "amount" | "timeline">;
  linkedIds: string[];
  attachmentCount: number;
  payments?: VendorPayment[];
}) => {
  if (document.timeline?.length) {
    return document.timeline;
  }

  const timeline: Array<{
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
      type: "created",
      amount: document.amount,
    },
  ];

  if (linkedIds.length > 0) {
    timeline.push({
      who: "System",
      what: `linked ${linkedIds.length} related document(s)`,
      time: document.date,
      type: "link",
    });
  }

  if (attachmentCount > 0) {
    timeline.push({
      who: "System",
      what: `attached ${attachmentCount} file(s)`,
      time: document.date,
      type: "attachment",
    });
  }

  payments?.forEach((payment) => {
    timeline.push({
      who: payment.vendor,
      what: `recorded payment ${payment.id}`,
      time: payment.paymentDate,
      type: "payment",
      amount: payment.amount,
    });
  });

  return timeline;
};

export const isPurchaseDocumentEditable = ({
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

export const purchaseDeleteRequiresReset = ({
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

export const getPaymentsForDocument = (
  payments: VendorPayment[],
  documentId: string
) =>
  payments.filter(
    (payment) =>
      payment.sourceDocumentId === documentId ||
      payment.sourceDocumentIds?.includes(documentId) ||
      payment.allocations?.some((allocation) => allocation.documentId === documentId)
  );

export const getAttachmentCount = (attachments: Attachment[]) => attachments.length;

export const getPayableStatusTone = (paymentStatus: PayableSummary["paymentStatus"]) => {
  if (paymentStatus === "paid") {
    return "success";
  }
  if (paymentStatus === "partial") {
    return "warning";
  }
  return "info";
};

export const buildVendorPayableMap = (rows: PayableSummary[]) =>
  rows.reduce<Record<string, number>>((accumulator, row) => {
    accumulator[row.vendor] = Number((accumulator[row.vendor] ?? 0) + row.remaining);
    return accumulator;
  }, {});

export const getDocumentKindFromPayable = (row: PayableSummary) =>
  row.sourceType === "receive" ? "receive" : "expense";

export const filterPayables = (
  rows: PayableSummary[],
  {
    query,
    vendor,
    status,
    currency,
  }: {
    query?: string;
    vendor?: string;
    status?: string;
    currency?: string;
  }
) => {
  const normalizedQuery = (query ?? "").trim().toLowerCase();
  return rows.filter((row) => {
    const matchesQuery =
      !normalizedQuery ||
      row.id.toLowerCase().includes(normalizedQuery) ||
      row.vendor.toLowerCase().includes(normalizedQuery) ||
      (row.category ?? "").toLowerCase().includes(normalizedQuery);

    const matchesVendor = !vendor || vendor === "all" || row.vendor === vendor;
    const matchesStatus = !status || status === "all" || row.paymentStatus === status;
    const matchesCurrency = !currency || currency === "all" || row.currency === currency;
    return matchesQuery && matchesVendor && matchesStatus && matchesCurrency;
  });
};

export const isExpenseRecord = (
  record: PurchaseDocumentRecord | Expense | null
): record is Expense => Boolean(record && "category" in record);

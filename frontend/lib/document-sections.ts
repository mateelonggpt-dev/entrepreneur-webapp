import type { DocumentTypeOption } from "@/components/documents/DocumentTypeSelector";
import type { DocumentKind, DocumentSummary, Expense, Invoice } from "@/lib/types";

export type DocumentLanguage = "en" | "th";

export const SALES_DOCUMENT_PROCESS_ORDER = [
  "quotation",
  "billing_note",
  "invoice",
  "delivery_note",
  "tax_invoice",
  "receipt",
] as const;

export const SALES_DOCUMENT_LABELS: Record<string, Record<DocumentLanguage, string>> = {
  none: { en: "None", th: "ไม่เลือก" },
  quotation: { en: "Quotation", th: "ใบเสนอราคา" },
  billing_note: { en: "Billing Note / Invoice", th: "ใบวางบิล/ใบแจ้งหนี้" },
  invoice: { en: "Billing Note / Invoice", th: "ใบวางบิล/ใบแจ้งหนี้" },
  delivery_note: { en: "Delivery Note", th: "ใบส่งของ" },
  tax_invoice: { en: "Tax Invoice", th: "ใบกำกับภาษี" },
  receipt: { en: "Receipt", th: "ใบเสร็จรับเงิน" },
  others: { en: "Others", th: "อื่น ๆ" },
  credit_note: { en: "Credit Note", th: "ใบลดหนี้" },
  debit_note: { en: "Debit Note", th: "ใบเพิ่มหนี้" },
  cash_sale: { en: "Cash Sale", th: "ขายเงินสด" },
  short_tax_invoice: { en: "Short-form Tax Invoice", th: "ใบกำกับภาษีอย่างย่อ" },
  combined_billing_note: { en: "Combined Billing Note", th: "ใบวางบิลรวม" },
  combined_receipt: { en: "Combined Receipt", th: "ใบเสร็จรับเงินรวม" },
  deposit: { en: "Deposit", th: "มัดจำ" },
  installment: { en: "Installment / Split Payment", th: "ผ่อนชำระ / แบ่งชำระ" },
};

export const INCOMPATIBLE_DOCUMENT_TYPES: Record<string, string[]> = {
  quotation: [
    "delivery_note",
    "invoice",
    "tax_invoice",
    "billing_note",
    "receipt",
    "cash_sale",
    "short_tax_invoice",
    "credit_note",
    "debit_note",
    "combined_billing_note",
    "combined_receipt",
    "deposit",
  ],
};

export const QUOTATION_INCOMPATIBILITY_HELPER =
  "Quotation must be selected alone in the Income document workflow.";

export const SALE_DOCUMENT_TYPE_OPTIONS: DocumentTypeOption[] = [
  { id: "quotation", label: SALES_DOCUMENT_LABELS.quotation.en, thaiLabel: SALES_DOCUMENT_LABELS.quotation.th },
  { id: "invoice", label: SALES_DOCUMENT_LABELS.invoice.en, thaiLabel: SALES_DOCUMENT_LABELS.invoice.th },
  { id: "delivery_note", label: SALES_DOCUMENT_LABELS.delivery_note.en, thaiLabel: SALES_DOCUMENT_LABELS.delivery_note.th },
  { id: "tax_invoice", label: SALES_DOCUMENT_LABELS.tax_invoice.en, thaiLabel: SALES_DOCUMENT_LABELS.tax_invoice.th },
  { id: "receipt", label: SALES_DOCUMENT_LABELS.receipt.en, thaiLabel: SALES_DOCUMENT_LABELS.receipt.th },
  {
    id: "others",
    label: SALES_DOCUMENT_LABELS.others.en,
    thaiLabel: SALES_DOCUMENT_LABELS.others.th,
    children: [
      { id: "credit_note", label: SALES_DOCUMENT_LABELS.credit_note.en, thaiLabel: SALES_DOCUMENT_LABELS.credit_note.th },
      { id: "debit_note", label: SALES_DOCUMENT_LABELS.debit_note.en, thaiLabel: SALES_DOCUMENT_LABELS.debit_note.th },
    ],
  },
];

export const PURCHASE_DOCUMENT_TYPE_OPTIONS: DocumentTypeOption[] = [
  { id: "none", label: "None", thaiLabel: "ไม่เลือก" },
  { id: "expense", label: "Expense", thaiLabel: "บันทึกรายจ่าย" },
  { id: "purchase_order", label: "Purchase Order", thaiLabel: "ใบสั่งซื้อ" },
  { id: "receive", label: "Goods Receipt", thaiLabel: "ใบรับสินค้า" },
  { id: "vendor_invoice", label: "Vendor Invoice", thaiLabel: "ใบแจ้งหนี้ผู้ขาย" },
  { id: "supplier_payment", label: "Supplier Payment", thaiLabel: "ชำระเงินผู้ขาย" },
  { id: "advance_payment", label: "Advance Payment", thaiLabel: "จ่ายเงินล่วงหน้า" },
  { id: "withholding_tax", label: "Withholding Tax", thaiLabel: "หนังสือรับรองหัก ณ ที่จ่าย" },
  {
    id: "others",
    label: "Others",
    thaiLabel: "อื่น ๆ",
    children: [
      { id: "purchase_credit_note", label: "Purchase Credit Note", thaiLabel: "ใบลดหนี้ซื้อ" },
      { id: "purchase_debit_note", label: "Purchase Debit Note", thaiLabel: "ใบเพิ่มหนี้ซื้อ" },
    ],
  },
];

export const SALE_DOCUMENT_TYPE_THAI_LABELS = Object.fromEntries(
  Object.entries(SALES_DOCUMENT_LABELS).map(([key, labels]) => [key, labels.th])
) as Record<string, string>;

export const SALES_DOCUMENT_KIND_LABELS: Record<string, string> = {
  all: "All income documents",
  quotation: "Quotations",
  invoice: "Billing Notes / Invoices",
  tax_invoice: "Tax Invoices",
  delivery_note: "Delivery Notes",
  billing_note: "Billing Notes / Invoices",
  receipt: "Receipts",
  billing: "Billing Notes / Invoices",
  credit_note: "Credit Notes",
  debit_note: "Debit Notes",
  deposit: "Deposits",
  cash_sale: "Cash Sales",
  short_tax_invoice: "Short-form Tax Invoices",
  combined_billing_note: "Combined Billing Notes",
  combined_receipt: "Combined Receipts",
};

export const PURCHASE_DOCUMENT_KIND_LABELS: Record<string, string> = {
  all: "All expense documents",
  supplier_payment: "Supplier Payments",
  advance_payment: "Advance Payments",
  purchase_order: "Purchase Orders",
  receive: "Goods Receipts",
  vendor_invoice: "Vendor Invoices",
  expense: "Expenses",
  withholding_tax: "Withholding Tax Certificates",
};

const flattenOptions = (options: DocumentTypeOption[]) =>
  options.flatMap((option) => (option.children?.length ? [option, ...option.children] : [option]));

export const SALE_DOCUMENT_TYPE_LABELS = Object.fromEntries(
  flattenOptions(SALE_DOCUMENT_TYPE_OPTIONS).map((option) => [
    option.id,
    SALES_DOCUMENT_LABELS[option.id] ?? { en: option.label, th: option.thaiLabel },
  ])
) as Record<string, Record<DocumentLanguage, string>>;

export const PURCHASE_DOCUMENT_TYPE_LABELS = Object.fromEntries(
  flattenOptions(PURCHASE_DOCUMENT_TYPE_OPTIONS).map((option) => [
    option.id,
    { en: option.label, th: option.thaiLabel },
  ])
) as Record<string, Record<DocumentLanguage, string>>;

export const getRealDocumentTypes = (selectedTypes: string[]) =>
  selectedTypes.filter((type) => type !== "none" && type !== "others");

const invoiceLikeTypes = new Set(["invoice", "tax_invoice", "billing_note"]);
const normalizeBillingInvoiceType = (type: string) => (type === "billing_note" ? "invoice" : type);
const normalizeCombinationType = (type: string) =>
  type === "tax_invoice" || type === "billing_note" ? "invoice" : type;

export const isSalesDocumentCombinationAllowed = (currentTypes: string[], candidateType: string) => {
  const nextTypes = Array.from(new Set([...currentTypes, candidateType].filter((type) => !["none", "others"].includes(type))));
  if (nextTypes.length <= 1) return true;
  if (nextTypes.includes("quotation")) return false;
  const standaloneTypes = [
    "cash_sale",
    "short_tax_invoice",
    "credit_note",
    "debit_note",
    "combined_billing_note",
    "combined_receipt",
    "deposit",
  ];
  if (nextTypes.some((type) => standaloneTypes.includes(type))) return false;

  const allowedPairs = new Set([
    "delivery_note|invoice",
    "delivery_note|receipt",
    "invoice|receipt",
  ]);
  const normalizedTypes = nextTypes.map(normalizeCombinationType);

  return normalizedTypes.every((left, leftIndex) =>
    normalizedTypes.slice(leftIndex + 1).every((right) => left === right || allowedPairs.has([left, right].sort().join("|")))
  );
};

export const sortSalesDocumentTypes = (selectedTypes: string[]) => {
  const realTypes = Array.from(new Set(getRealDocumentTypes(selectedTypes)));
  const processTypes = SALES_DOCUMENT_PROCESS_ORDER.filter((type) => realTypes.includes(type));
  const otherTypes = realTypes.filter(
    (type) => !SALES_DOCUMENT_PROCESS_ORDER.includes(type as (typeof SALES_DOCUMENT_PROCESS_ORDER)[number])
  );
  return [...processTypes, ...otherTypes];
};

export const sanitizeSalesDocumentTypes = (selectedTypes: string[]) => {
  const realTypes = getRealDocumentTypes(selectedTypes).map(normalizeBillingInvoiceType);
  if (realTypes.length === 0) {
    return selectedTypes.includes("none") ? ["none"] : [];
  }

  if (realTypes.includes("quotation")) {
    return ["quotation"];
  }

  const uniqueTypes = Array.from(new Set(realTypes.filter((type) => type !== "quotation")));
  const standaloneTypes = [
    "cash_sale",
    "short_tax_invoice",
    "credit_note",
    "debit_note",
    "combined_billing_note",
    "combined_receipt",
    "deposit",
  ];
  const selectedStandalone = uniqueTypes.find((type) => standaloneTypes.includes(type));
  if (selectedStandalone) {
    return [selectedStandalone];
  }

  return sortSalesDocumentTypes(uniqueTypes.filter((type) => isSalesDocumentCombinationAllowed(uniqueTypes, type)));
};

export const getDisabledSalesDocumentTypes = (selectedTypes: string[]) => {
  const realTypes = getRealDocumentTypes(selectedTypes);
  const disabled: Record<string, string> = {};
  if (realTypes.includes("quotation")) {
    for (const type of INCOMPATIBLE_DOCUMENT_TYPES.quotation) {
      disabled[type] = QUOTATION_INCOMPATIBILITY_HELPER;
    }
  }
  if (realTypes.some((type) => INCOMPATIBLE_DOCUMENT_TYPES.quotation.includes(type))) {
    disabled.quotation = QUOTATION_INCOMPATIBILITY_HELPER;
  }
  if (realTypes.length > 0 && !realTypes.includes("quotation")) {
    flattenOptions(SALE_DOCUMENT_TYPE_OPTIONS).forEach((option) => {
      if (["none", "others"].includes(option.id) || realTypes.includes(option.id)) return;
      if (!isSalesDocumentCombinationAllowed(realTypes, option.id)) {
        disabled[option.id] = "This document type cannot be combined with the current Income document selection.";
      }
    });
  }
  return disabled;
};

export const buildSalesDocumentTitle = (
  selectedTypes: string[],
  language: DocumentLanguage = "th"
) => {
  const realTypes = Array.from(new Set(sortSalesDocumentTypes(selectedTypes).map(normalizeBillingInvoiceType)));
  if (realTypes.length === 0) {
    return "";
  }

  return realTypes
    .map((type) => SALE_DOCUMENT_TYPE_LABELS[type]?.[language] ?? type)
    .join("/");
};

const SALES_NUMBER_PRIORITY = [
  "tax_invoice",
  "short_tax_invoice",
  "invoice",
  "cash_sale",
  "delivery_note",
  "combined_billing_note",
  "billing_note",
  "combined_receipt",
  "receipt",
  "quotation",
  "credit_note",
  "debit_note",
  "deposit",
] as const;

export const getPrimarySalesDocumentType = (selectedTypes: string[]) => {
  const realTypes = getRealDocumentTypes(selectedTypes).map(normalizeBillingInvoiceType);
  return SALES_NUMBER_PRIORITY.find((type) => realTypes.includes(type)) ?? realTypes[0] ?? "invoice";
};

export const getSalesDocumentNumberPrefix = (selectedTypes: string[]) => {
  const prefixMap: Record<string, string> = {
    tax_invoice: "INV",
    short_tax_invoice: "STI",
    invoice: "INV",
    cash_sale: "CS",
    delivery_note: "DN",
    billing_note: "BN",
    combined_billing_note: "CBN",
    receipt: "RCT",
    combined_receipt: "CR",
    credit_note: "CN",
    debit_note: "DN",
    deposit: "INV",
  };

  return prefixMap[getPrimarySalesDocumentType(selectedTypes)] ?? "DOC";
};

export const inferSalesDocumentTypes = (summary: DocumentSummary) => {
  if (summary.documentTypes?.length) {
    return summary.documentTypes;
  }
  if (summary.kind === "billing") {
    return ["billing_note"];
  }
  if (summary.kind === "invoice") {
    return summary.isTaxInvoice || summary.invoiceTaxType === "tax" ? ["tax_invoice"] : ["invoice"];
  }
  return [summary.kind];
};

export const salesSummaryMatchesDocumentTypes = (
  summary: DocumentSummary,
  selectedTypes: string[]
) => {
  const realTypes = getRealDocumentTypes(selectedTypes);
  if (realTypes.length === 0) {
    return true;
  }

  const summaryTypes = inferSalesDocumentTypes(summary);
  return realTypes.some((type) =>
    summaryTypes.includes(type) ||
    (invoiceLikeTypes.has(type) && summaryTypes.some((summaryType) => invoiceLikeTypes.has(summaryType)))
  );
};

export const inferPurchaseDocumentTypes = (summary: DocumentSummary) => {
  if (summary.documentTypes?.length) {
    return summary.documentTypes;
  }
  return [summary.kind];
};

export const purchaseSummaryMatchesDocumentTypes = (
  summary: DocumentSummary,
  selectedTypes: string[]
) => {
  const realTypes = getRealDocumentTypes(selectedTypes);
  if (realTypes.length === 0) {
    return true;
  }

  const summaryTypes = inferPurchaseDocumentTypes(summary);
  return realTypes.some((type) => summaryTypes.includes(type));
};

export const saleDocumentRoute = (summary: DocumentSummary) => {
  if (summary.kind === "invoice") {
    return `/sales/invoices/${summary.id}`;
  }

  const routeMap: Partial<Record<DocumentKind, string>> = {
    quotation: "/sales/quotations",
    receipt: "/sales/receipts",
    billing: "/sales/billing",
    credit_note: "/sales/credit-notes",
    debit_note: "/sales/debit-notes",
    deposit: "/sales/quotations",
  };

  return routeMap[summary.kind] ?? "/income/documents";
};

export const purchaseDocumentRoute = (summary: DocumentSummary) => {
  if (summary.kind === "expense") {
    return `/expense/documents?document=${encodeURIComponent(summary.id)}`;
  }

  const routeMap: Partial<Record<DocumentKind, string>> = {
    purchase_order: "/expense/documents",
    receive: "/expense/documents",
    withholding_tax: "/expense/documents",
  };

  return routeMap[summary.kind] ?? "/purchases";
};

export const invoiceToSalesSummary = (invoice: Invoice): DocumentSummary => {
  const isTaxInvoice = Boolean(invoice.isTaxInvoice || invoice.invoiceTaxType === "tax" || invoice.documentTypes?.includes("tax_invoice"));
  return {
    id: invoice.id,
    party: invoice.customer,
    date: invoice.date,
    amount: invoice.amount,
    status: invoice.status,
    kind: "invoice",
    linkedDocumentIds: invoice.linkedDocumentIds,
    relatedDocumentIds: invoice.relatedDocumentIds,
    referenceDocuments: invoice.referenceDocuments,
    documentVariant: invoice.documentVariant,
    documentTypes: invoice.documentTypes?.length ? invoice.documentTypes : [isTaxInvoice ? "tax_invoice" : "invoice"],
    documentTitle: invoice.documentTitle || (isTaxInvoice ? "ใบกำกับภาษี" : undefined),
    invoiceTaxType: invoice.invoiceTaxType || (isTaxInvoice ? "tax" : "normal"),
    isTaxInvoice,
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
    sourceDocumentId: invoice.sourceDocumentId,
    sourceDocumentType: invoice.sourceDocumentType,
    sourceDocumentNumber: invoice.sourceDocumentId,
    createdBy: invoice.createdBy,
    salesperson: invoice.salesperson,
    sellerUserInfo: invoice.sellerUserInfo,
    paymentSummary: invoice.paymentSummary
      ? {
          paid: invoice.paymentSummary.received ?? 0,
          remaining: invoice.paymentSummary.remaining ?? 0,
          status: invoice.paymentSummary.remaining > 0 ? "partial" : "paid",
        }
      : undefined,
    attachments: invoice.attachments,
    attachmentCount: invoice.attachments?.length,
  };
};

export const expenseToPurchaseSummary = (expense: Expense): DocumentSummary => ({
  id: expense.id,
  party: expense.vendor,
  date: expense.date,
  amount: expense.amount,
  status: expense.status,
  kind: "expense",
  linkedDocumentIds: expense.linkedDocumentIds,
  documentVariant: expense.category,
  documentTypes: expense.documentTypes,
  documentTitle: expense.documentTitle,
  sourceDocumentId: expense.sourceDocumentId,
  sourceDocumentType: expense.sourceDocumentType,
});

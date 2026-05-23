export type DocumentFormKind =
  | "quotation"
  | "invoice"
  | "receipt"
  | "credit_note"
  | "debit_note"
  | "purchase_order"
  | "receive"
  | "billing"
  | "deposit"
  | "installment";

export type DocumentPartyType = "customer" | "vendor";

export type DocumentWorkflowGroup =
  | "sales"
  | "purchase"
  | "adjustment"
  | "special_workflow";

export type DocumentFormModel = {
  kind: DocumentFormKind;
  group: DocumentWorkflowGroup;
  title: string;
  createTitle: string;
  editTitle?: string;
  description: string;
  createButtonLabel: string;
  saveButtonLabel?: string;
  draftButtonLabel: string;
  partyType: DocumentPartyType;
  partyLabel: string;
  numberLabel?: string;
  dateLabel: string;
  dueDateLabel?: string;
  sourceDocumentLabel?: string;
  sourceDocumentRequired: boolean;
  paymentSection: "hidden" | "shown" | "workflow_specific";
  lineItemsEditable: boolean;
  defaultStatus?: string;
  notesLabel: string;
  termsLabel?: string;
  summaryTitle: string;
  subtotalLabel: string;
  taxLabel: string;
  totalLabel: string;
};

const salesShared = {
  partyType: "customer",
  partyLabel: "Customer",
  draftButtonLabel: "Save Draft",
  notesLabel: "Notes",
  summaryTitle: "Summary",
  subtotalLabel: "Subtotal",
  taxLabel: "VAT 7%",
  totalLabel: "Grand Total",
} as const;

const purchaseShared = {
  partyType: "vendor",
  partyLabel: "Vendor",
  draftButtonLabel: "Save Draft",
  notesLabel: "Notes",
  summaryTitle: "Summary",
  subtotalLabel: "Subtotal",
  taxLabel: "VAT",
  totalLabel: "Total",
} as const;

/**
 * Sales documents
 * These share customer-facing document behavior.
 */
export const SALES_DOCUMENT_FORM_MODELS = {
  quotation: {
    ...salesShared,
    kind: "quotation",
    group: "sales",
    title: "Quotation",
    createTitle: "New Quotation",
    editTitle: "Edit Quotation",
    description: "Draft a price proposal and keep it ready for conversion.",
    createButtonLabel: "Create Quotation",
    saveButtonLabel: "Save Changes",
    numberLabel: "Quotation Number",
    dateLabel: "Quotation Date",
    dueDateLabel: "Expiry Date",
    sourceDocumentRequired: false,
    paymentSection: "hidden",
    lineItemsEditable: true,
    defaultStatus: "pending",
  },
  invoice: {
    ...salesShared,
    kind: "invoice",
    group: "sales",
    title: "Invoice",
    createTitle: "New Invoice",
    description: "Bill a customer and move the document into your real backend flow.",
    createButtonLabel: "Create Invoice",
    numberLabel: "Invoice Number",
    dateLabel: "Invoice Date",
    dueDateLabel: "Due Date",
    sourceDocumentRequired: false,
    paymentSection: "hidden",
    lineItemsEditable: true,
    defaultStatus: "pending",
    termsLabel: "Payment Terms",
  },
  receipt: {
    ...salesShared,
    kind: "receipt",
    group: "sales",
    title: "Receipt",
    createTitle: "New Receipt",
    description: "Record an incoming payment and update the linked invoice.",
    createButtonLabel: "Create Receipt",
    numberLabel: "Receipt Number",
    dateLabel: "Receipt Date",
    sourceDocumentLabel: "Related Invoice",
    sourceDocumentRequired: true,
    paymentSection: "shown",
    lineItemsEditable: false,
    defaultStatus: "paid",
    totalLabel: "Amount Received",
  },
} satisfies Record<string, DocumentFormModel>;

/**
 * Purchase documents
 * These use vendor-facing document behavior.
 */
export const PURCHASE_DOCUMENT_FORM_MODELS = {
  purchase_order: {
    ...purchaseShared,
    kind: "purchase_order",
    group: "purchase",
    title: "Purchase Order",
    createTitle: "New Purchase Order",
    editTitle: "Edit Purchase Order",
    description: "Create a real vendor order with structured lines, totals, and conversion-ready data.",
    createButtonLabel: "Create Purchase Order",
    saveButtonLabel: "Save Purchase Order",
    dateLabel: "Issue date",
    dueDateLabel: "Due date",
    sourceDocumentRequired: false,
    paymentSection: "hidden",
    lineItemsEditable: true,
    defaultStatus: "pending",
    termsLabel: "Payment terms",
  },
  receive: {
    ...purchaseShared,
    kind: "receive",
    group: "purchase",
    title: "Goods Received",
    createTitle: "New Goods Received",
    editTitle: "Edit Goods Received",
    description: "Capture items received from a vendor and connect them to purchase orders or expense flows.",
    createButtonLabel: "Create Goods Received",
    saveButtonLabel: "Save Goods Received",
    dateLabel: "Receive date",
    sourceDocumentLabel: "Source purchase order",
    sourceDocumentRequired: false,
    paymentSection: "hidden",
    lineItemsEditable: true,
    defaultStatus: "pending",
  },
} satisfies Record<string, DocumentFormModel>;

/**
 * Adjustment documents
 * These are linked to existing invoices and should not be treated as normal standalone forms.
 */
export const ADJUSTMENT_DOCUMENT_FORM_MODELS = {
  credit_note: {
    ...salesShared,
    kind: "credit_note",
    group: "adjustment",
    title: "Credit Note",
    createTitle: "Create Credit Note",
    description: "Create a linked invoice credit or a separate credit note for already-paid or closed cases.",
    createButtonLabel: "Create Credit Note",
    numberLabel: "Credit Note Number",
    dateLabel: "Document date",
    sourceDocumentLabel: "Invoice source",
    sourceDocumentRequired: false,
    paymentSection: "workflow_specific",
    lineItemsEditable: false,
    defaultStatus: "draft",
    notesLabel: "Reason",
    totalLabel: "Credit amount",
  },
  debit_note: {
    ...salesShared,
    kind: "debit_note",
    group: "adjustment",
    title: "Debit Note",
    createTitle: "Create Debit Note",
    description: "Increase invoice value or create a standalone sales adjustment with stock-cut policy support.",
    createButtonLabel: "Create Debit Note",
    numberLabel: "Debit Note Number",
    dateLabel: "Document date",
    sourceDocumentLabel: "Source invoice",
    sourceDocumentRequired: false,
    paymentSection: "workflow_specific",
    lineItemsEditable: false,
    defaultStatus: "draft",
    notesLabel: "Reason",
    totalLabel: "Debit adjustment",
  },
} satisfies Record<string, DocumentFormModel>;

/**
 * Special workflow documents
 * These remain separate because they create or update multiple records.
 */
export const SPECIAL_WORKFLOW_DOCUMENT_FORM_MODELS = {
  billing: {
    ...salesShared,
    kind: "billing",
    group: "special_workflow",
    title: "Billing",
    createTitle: "Create Billing",
    description: "Collect one or more sales documents into a billing workflow.",
    createButtonLabel: "Create Billing",
    dateLabel: "Billing date",
    sourceDocumentLabel: "Source documents",
    sourceDocumentRequired: true,
    paymentSection: "workflow_specific",
    lineItemsEditable: false,
    defaultStatus: "pending",
  },
  deposit: {
    ...salesShared,
    kind: "deposit",
    group: "special_workflow",
    title: "Deposit",
    createTitle: "Create Deposit",
    description: "Collect a deposit against a quotation or sales workflow.",
    createButtonLabel: "Create Deposit",
    dateLabel: "Deposit date",
    sourceDocumentLabel: "Source quotation",
    sourceDocumentRequired: true,
    paymentSection: "workflow_specific",
    lineItemsEditable: false,
    defaultStatus: "paid",
  },
  installment: {
    ...salesShared,
    kind: "installment",
    group: "special_workflow",
    title: "Installment",
    createTitle: "Create Installments",
    description: "Create linked installment invoices from a parent quotation.",
    createButtonLabel: "Create Installments",
    dateLabel: "Start date",
    sourceDocumentLabel: "Source quotation",
    sourceDocumentRequired: true,
    paymentSection: "workflow_specific",
    lineItemsEditable: false,
    defaultStatus: "pending",
  },
} satisfies Record<string, DocumentFormModel>;

export const DOCUMENT_FORM_MODELS = {
  ...SALES_DOCUMENT_FORM_MODELS,
  ...PURCHASE_DOCUMENT_FORM_MODELS,
  ...ADJUSTMENT_DOCUMENT_FORM_MODELS,
  ...SPECIAL_WORKFLOW_DOCUMENT_FORM_MODELS,
} satisfies Record<DocumentFormKind, DocumentFormModel>;

export const DOCUMENT_FORM_CONFIG = DOCUMENT_FORM_MODELS;

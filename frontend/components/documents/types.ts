import type { BrandingSettings, DocumentSettings } from "@/lib/types";

export type SalesDocumentLanguage = "en" | "th";
export type SalesDocumentCopyKind = "original" | "copy";
export type SalesDocumentCopyGeneration = "both" | "original" | "copy";

export type SalesDocumentParty = {
  code?: string;
  name?: string;
  address?: string;
  taxId?: string;
  branch?: string;
  contactPerson?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  website?: string;
};

export type SalesDocumentLine = {
  id: string;
  sku?: string;
  inventoryId?: string;
  originalInventoryCode?: string;
  displayCode?: string;
  desc: string;
  details?: string;
  qty: number;
  unit?: string;
  price: number;
  discountType?: "percent" | "amount";
  discountValue?: number;
  discountAmount?: number;
  discount?: number;
  tax: number;
  vatRate?: number;
  vatAmount?: number;
  withholdingRate?: number;
  withholdingAmount?: number;
  sourceDocumentId?: string;
  sourceDocumentType?: string;
  sourceLineId?: string;
};

export type SalesDocumentTaxGroup = {
  rate: number;
  taxableBase: number;
  taxAmount: number;
};

export type SalesDocumentSellerUser = {
  id?: string;
  name?: string;
  email?: string;
};

export type SalesDocumentTotals = {
  subtotalBeforeDiscount: number;
  totalDiscount: number;
  amountBeforeVat: number;
  vatAmount: number;
  grandTotal: number;
  withholdingAmount: number;
  amountPaid: number;
  remainingDue: number;
  vatGroups?: SalesDocumentTaxGroup[];
  withholdingGroups?: SalesDocumentTaxGroup[];
  totalWithholdingTax?: number;
};

export type SalesDocumentBankAccount = {
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  branch?: string;
  promptPayId?: string;
  swiftCode?: string;
};

export type SalesDocumentPaymentDetails = {
  bankAccount?: string;
  accountName?: string;
  accountNumber?: string;
  chequeNumber?: string;
  chequeBankName?: string;
  chequeDate?: string;
  cardType?: string;
  approvalCode?: string;
  promptPayId?: string;
  otherNote?: string;
};

export type SalesDocumentTemplateData = {
  title: string;
  titleEn?: string;
  documentTypes: string[];
  copyGeneration: SalesDocumentCopyGeneration;
  language: SalesDocumentLanguage;
  status?: string;
  documentNumber: string;
  seller: SalesDocumentParty;
  customer: SalesDocumentParty;
  branding: Partial<BrandingSettings>;
  documentSettingsSnapshot?: DocumentSettings;
  issueDate: string;
  dueDate: string;
  creditTerms: string;
  reference: string;
  relatedDocument?: string;
  referenceDocuments?: Array<{
    id: string;
    number?: string;
    type?: string;
    kind: string;
    documentTypes?: string[];
    party?: string;
    date?: string;
    amount?: number;
    total?: number;
    status?: string;
  }>;
  documentContact: string;
  sellerUser?: SalesDocumentSellerUser;
  lines: SalesDocumentLine[];
  totals: SalesDocumentTotals;
  discountRate: number;
  withholdingRate: number;
  currency: string;
  paymentMethod: string;
  paymentDetails: SalesDocumentPaymentDetails;
  selectedBankAccount: SalesDocumentBankAccount | null;
  paymentTerms: string;
  notes: string;
  amountWordsThai: string;
  amountWordsEnglish: string;
  showAmountPaid: boolean;
  invoicePaymentMode?: "full_payment" | "partial_payment" | "deposit";
  invoiceDeductions?: Array<{
    id: string;
    label: string;
    amount: number;
    type: "deposit" | "paid";
  }>;
  invoicePaymentSchedule?: Array<{
    id: string;
    label: string;
    type: "percent" | "amount";
    value: number;
    percent?: number;
    amount: number;
    dueDate?: string;
  }>;
  receiptAdjustments?: Array<{
    id: string;
    type: "special_discount" | "commission" | "service_fee" | "rounding";
    amount: number;
    note?: string;
  }>;
};

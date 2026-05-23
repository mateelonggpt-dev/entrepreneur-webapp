import type {
  AccountingEventType,
  DocumentStatus,
  DocumentType,
  FinancialAccountType,
  NumberingMode,
  PaymentMethod,
  PaymentStatus,
  StockAdjustmentType,
  TaxMode,
} from "@/lib/domain/enums";

export interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  taxId?: string;
  address?: string;
  contactPerson?: string;
}

export interface Customer extends Contact {
  balance: number;
  status: DocumentStatus;
}

export interface Vendor extends Contact {
  balance: number;
  status: DocumentStatus;
}

export interface Product {
  sku: string;
  name: string;
  productType: string;
  price: number;
  stock: number | null;
  status: DocumentStatus;
}

export interface InventoryItem {
  sku: string;
  onHand: number;
  reserved?: number;
  available?: number;
  adjustmentType?: StockAdjustmentType;
}

export interface FinancialAccount {
  name: string;
  number: string;
  balance: number;
  accountType?: FinancialAccountType;
  primary?: boolean;
}

export interface Project {
  id: string;
  name: string;
  code?: string;
  status?: string;
}

export interface Currency {
  code: string;
  exchangeRate: number;
  base?: boolean;
  snapshotDate?: string;
}

export interface DocumentLine {
  id: string;
  desc: string;
  qty: number;
  price: number;
  tax: number;
  vatRate?: number;
  vatAmount?: number;
  withholdingRate?: number;
  withholdingAmount?: number;
  amount: number;
  discount?: number;
  discountMode?: TaxMode;
}

export interface TaxRateGroup {
  rate: number;
  taxableBase: number;
  taxAmount: number;
}

export interface SalesDocument {
  id: string;
  documentType: DocumentType;
  status: DocumentStatus;
  customer: string;
  date: string;
  due?: string;
  currency: string;
  reference?: string;
  paymentTerms?: string;
  notes?: string;
  subtotal?: number;
  taxAmount?: number;
  amount: number;
  lines?: DocumentLine[];
}

export interface PurchaseDocument {
  id: string;
  documentType: DocumentType;
  status: DocumentStatus;
  vendor: string;
  date: string;
  due?: string;
  currency: string;
  reference?: string;
  paymentTerms?: string;
  notes?: string;
  subtotal?: number;
  taxAmount?: number;
  amount: number;
  lines?: DocumentLine[];
}

export interface Payment {
  id: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  amount: number;
  currency: string;
  paymentDate: string;
  sourceDocumentId?: string;
  sourceDocumentType?: DocumentType;
  chequeDate?: string;
}

export interface WithholdingTaxDocument {
  id: string;
  rate: number;
  amount: number;
  sourceDocumentId: string;
  filingPeriod?: string;
}

export interface Attachment {
  id: string;
  entityType: string;
  entityId: string;
  name: string;
  category: string;
  note: string;
  attachedBy: string;
  uploadedAt: string;
  tags: string[];
  downloadUrl: string;
  relativePath: string;
  storedName: string;
  contentType: string;
  sizeBytes: number;
}

export interface TimelineEvent {
  who: string;
  what: string;
  amount?: number;
  time: string;
  type: string;
}

export interface AmountSummary {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  withholdingAmount: number;
  totalWithholdingTax: number;
  grandTotal: number;
  remainingDue: number;
  total: number;
  vatGroups: TaxRateGroup[];
  withholdingGroups: TaxRateGroup[];
}

export interface TaxSummary {
  mode: TaxMode;
  rate: number;
  taxableBase: number;
  taxAmount: number;
  withholdingRate?: number;
  withholdingAmount?: number;
}

export interface JournalLine {
  account: string;
  side: "debit" | "credit";
  amount: number;
}

export interface JournalEntry {
  id: string;
  date: string;
  sourceType: string;
  sourceId: string;
  description: string;
  currency: string;
  amount: number;
  lines: JournalLine[];
}

export interface AccountingEvent {
  sourceDocumentId: string;
  sourceType: DocumentType;
  eventType: AccountingEventType;
  eventDate: string;
  amountSummary: AmountSummary;
  taxSummary: TaxSummary;
  linkedProjectId?: string;
  linkedContactId?: string;
  linkedAccountId?: string;
  linkedDocumentIds?: string[];
  journalPayload?: Array<Record<string, unknown>>;
}

export interface NumberingPolicy {
  mode: NumberingMode;
  prefix: string;
  startAt: number;
}

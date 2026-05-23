export const DOCUMENT_TYPES = [
  "quotation",
  "invoice",
  "receipt",
  "billing",
  "credit_note",
  "debit_note",
  "deposit",
  "purchase_order",
  "receive",
  "expense",
  "withholding_tax",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_STATUSES = [
  "active",
  "approved",
  "billed",
  "cancelled",
  "draft",
  "inactive",
  "invoiced",
  "overdue",
  "paid",
  "partial",
  "pending_bill",
  "pending",
  "rejected",
  "sent",
  "void",
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const PAYMENT_METHODS = [
  "Bank transfer",
  "Bank Transfer",
  "Cash",
  "Petty Cash",
  "Cheque",
  "Credit Card",
  "Card",
  "PromptPay",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = [
  "unpaid",
  "partial",
  "paid",
  "overdue",
  "refunded",
  "void",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const FINANCIAL_ACCOUNT_TYPES = [
  "bank",
  "petty_cash",
  "cheque_payable",
  "credit_card_payable",
  "payment_gateway",
] as const;

export type FinancialAccountType = (typeof FINANCIAL_ACCOUNT_TYPES)[number];

export const STOCK_ADJUSTMENT_TYPES = [
  "sale",
  "purchase",
  "return",
  "write_off",
  "manual",
  "transfer",
] as const;

export type StockAdjustmentType = (typeof STOCK_ADJUSTMENT_TYPES)[number];

export const TAX_MODES = ["exclusive", "inclusive", "exempt"] as const;

export type TaxMode = (typeof TAX_MODES)[number];

export const NUMBERING_MODES = ["continuous", "year_month_reset", "yearly_reset"] as const;

export type NumberingMode = (typeof NUMBERING_MODES)[number];

export const ACCOUNTING_EVENT_TYPES = [
  "document_issued",
  "payment_recorded",
  "expense_approved",
  "receive_captured",
  "status_changed",
] as const;

export type AccountingEventType = (typeof ACCOUNTING_EVENT_TYPES)[number];

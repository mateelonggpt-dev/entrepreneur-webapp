import type {
  AccountingEvent as DomainAccountingEvent,
  Attachment as DomainAttachment,
  Customer as DomainCustomer,
  DocumentLine as DomainDocumentLine,
  FinancialAccount as DomainFinancialAccount,
  JournalEntry as DomainJournalEntry,
  Payment as DomainPayment,
  Project as DomainProject,
  Product as DomainProduct,
  PurchaseDocument,
  SalesDocument,
  WithholdingTaxDocument as DomainWithholdingTaxDocument,
} from "@/lib/domain/models";
import type {
  DocumentStatus,
  DocumentType,
  PaymentMethod,
  PaymentStatus,
} from "@/lib/domain/enums";

export * from "@/lib/domain";

export type RecordStatus = DocumentStatus;
export type DocumentKind = Extract<
  DocumentType,
  | "quotation"
  | "invoice"
  | "receipt"
  | "billing"
  | "credit_note"
  | "debit_note"
  | "deposit"
  | "purchase_order"
  | "receive"
  | "expense"
  | "withholding_tax"
>;

export interface DocumentLine extends DomainDocumentLine {
  sku?: string;
  inventoryId?: string;
  originalInventoryCode?: string;
  displayCode?: string;
  details?: string;
  unit?: string;
  vatRate?: number;
  amountBeforeVat?: number;
  vatAmount?: number;
  withholdingRate?: number;
  withholdingAmount?: number;
  totalAmount?: number;
  sourceDocumentId?: string;
  sourceDocumentType?: DocumentKind | string;
  sourceLineId?: string;
}

export interface DocumentSummary {
  id: string;
  party: string;
  date: string;
  amount: number;
  status: RecordStatus;
  kind: DocumentKind;
  linkedDocumentIds?: string[];
  relatedDocumentIds?: string[];
  referenceDocuments?: ReferenceDocument[];
  documentVariant?: string;
  documentTypes?: string[];
  documentTitle?: string;
  invoiceTaxType?: "normal" | "tax";
  isTaxInvoice?: boolean;
  invoicePaymentMode?: "full_payment" | "partial_payment" | "deposit";
  depositType?: "percent" | "amount";
  depositValue?: number;
  depositPercent?: number;
  depositAmount?: number;
  depositSourceDocumentId?: string;
  depositSourceDocumentType?: string;
  invoicePaymentSchedule?: Array<{
    id: string;
    label: string;
    type: "percent" | "amount";
    value: number;
    percent?: number;
    amount: number;
    dueDate?: string;
  }>;
  invoiceDeductions?: Array<{
    id: string;
    label: string;
    amount: number;
    type: "deposit" | "paid";
  }>;
  sourceInvoiceIds?: string[];
  sourceBillingId?: string;
  parentQuotationId?: string;
  sourceDocumentId?: string;
  sourceDocumentNumber?: string;
  sourceDocumentType?: DocumentKind;
  createdBy?: string;
  salesperson?: string;
  sellerUserInfo?: {
    id?: string;
    name?: string;
    email?: string;
    role?: string;
  };
  projectId?: string;
  projectName?: string;
  baseCurrency?: string;
  exchangeRate?: number;
  snapshotDate?: string;
  paymentSummary?: {
    paid: number;
    remaining: number;
    status: PaymentStatus;
    lastPaymentDate?: string;
    lastPaymentMethod?: PaymentMethod | string;
    lastPaymentId?: string;
  };
  attachments?: string[];
  attachmentCount?: number;
  workflowId?: string;
  sourceDocumentIds?: string[];
  convertedFromId?: string | null;
  convertedToIds?: string[];
  workflowMode?: "strict" | "guided" | "free";
  overrideReason?: string | null;
  paymentStatus?: PaymentStatus | string;
  deliveryStatus?: string;
  amountPaid?: number;
  amountDue?: number;
  withholdingAmount?: number;
  taxPointDate?: string | null;
  taxPointReason?: string | null;
  taxInvoiceRequired?: boolean;
  vatReportingPeriod?: string | null;
  taxGuidance?: TaxGuidanceMessage[];
  vatAuditSnapshot?: VatAuditSnapshot;
  transactionType?: "goods" | "service" | string;
  deliveryDate?: string | null;
  ownershipTransferDate?: string | null;
  serviceCompletedDate?: string | null;
  paymentDate?: string | null;
  taxOverrideReason?: string | null;
}

export interface DocumentWorkflowAction {
  type: string;
  labelKey: string;
  targetKind: string;
  recommended?: boolean;
  requiresReference?: boolean;
  warningKey?: string;
}

export interface DocumentWorkflowNextActions {
  documentId: string;
  kind: string;
  status: string;
  nextActions: DocumentWorkflowAction[];
}

export interface DocumentWorkflowRules {
  workflowModes: Array<"strict" | "guided" | "free">;
  allowedTransitions: Record<string, string[]>;
  defaultMode: "strict" | "guided" | "free";
}

export interface TaxGuidanceMessage {
  severity: "info" | "warning" | "error";
  messageKey: string;
}

export interface VatAuditSnapshot {
  kind?: string;
  documentTypes?: string[];
  taxAmount?: number;
  vatGroups?: TaxRateGroup[];
  taxPointDate?: string | null;
  taxPointReason?: string | null;
  vatReportingPeriod?: string | null;
  taxInvoiceRequired?: boolean;
  sourceEvents?: Record<string, string>;
}

export interface Attachment extends DomainAttachment {}

export interface SalesDocumentRecord
  extends Omit<SalesDocument, "documentType" | "customer" | "lines" | "currency"> {
  documentType?: DocumentKind;
  id: string;
  customer: string;
  due?: string;
  expiryDate?: string;
  createdBy?: string;
  salesperson?: string;
  sellerUserInfo?: {
    id?: string;
    name?: string;
    email?: string;
    role?: string;
  };
  currency?: string;
  baseCurrency?: string;
  exchangeRate?: number;
  snapshotDate?: string;
  projectId?: string;
  projectName?: string;
  lines?: DocumentLine[];
  attachments?: string[];
  relatedInvoice?: string;
  relatedDocument?: string;
  relatedBilling?: string;
  sourceInvoiceIds?: string[];
  sourceBillingId?: string;
  relatedDocumentIds?: string[];
  linkedDocumentIds?: string[];
  sourceDocumentId?: string;
  sourceDocumentType?: DocumentKind;
  referenceDocuments?: ReferenceDocument[];
  parentQuotationId?: string;
  installmentSourceId?: string;
  installmentIndex?: number;
  installmentCount?: number;
  installmentSplitMode?: "amount" | "quantity";
  installmentPlan?: Array<{
    id: string;
    label: string;
    amount: number;
    qty?: number;
    relatedDocumentId?: string;
    status?: RecordStatus | string;
  }>;
  installmentHistory?: Array<{
    id: string;
    action: string;
    createdAt: string;
    createdDocumentId?: string;
    amount?: number;
  }>;
  receiptAdjustments?: Array<{
    id: string;
    type: "special_discount" | "commission" | "service_fee" | "rounding";
    amount: number;
    note?: string;
  }>;
  splitReceives?: Array<{
    id: string;
    amount: number;
    paymentMethod?: PaymentMethod | string;
    receivedAt: string;
    note?: string;
  }>;
  billingStatus?: "draft" | "pending_bill" | "billed" | "invoiced";
  documentVariant?: string;
  documentTypes?: string[];
  documentTitle?: string;
  invoiceTaxType?: "normal" | "tax";
  isTaxInvoice?: boolean;
  invoicePaymentMode?: "full_payment" | "partial_payment" | "deposit";
  depositType?: "percent" | "amount";
  depositValue?: number;
  depositPercent?: number;
  depositAmount?: number;
  depositSourceDocumentId?: string;
  depositSourceDocumentType?: string;
  invoicePaymentSchedule?: Array<{
    id: string;
    label: string;
    type: "percent" | "amount";
    value: number;
    percent?: number;
    amount: number;
    dueDate?: string;
  }>;
  invoiceDeductions?: Array<{
    id: string;
    label: string;
    amount: number;
    type: "deposit" | "paid";
  }>;
  stockCutBehavior?: "follow_policy" | "cut_stock" | "no_stock_cut";
  documentSettingsSnapshot?: DocumentSettings;
  vatGroups?: TaxRateGroup[];
  withholdingGroups?: TaxRateGroup[];
  totalWithholdingTax?: number;
  taxPointDate?: string | null;
  taxPointReason?: string | null;
  taxInvoiceRequired?: boolean;
  vatReportingPeriod?: string | null;
  taxGuidance?: TaxGuidanceMessage[];
  vatAuditSnapshot?: VatAuditSnapshot;
  transactionType?: "goods" | "service" | string;
  deliveryDate?: string | null;
  ownershipTransferDate?: string | null;
  serviceCompletedDate?: string | null;
  paymentDate?: string | null;
  taxOverrideReason?: string | null;
  paymentSummary?: {
    received: number;
    remaining: number;
    netReceivable: number;
  };
  netReceivable?: number;
  adjustmentSummary?: {
    specialDiscount?: number;
    commission?: number;
    serviceFee?: number;
    rounding?: number;
  };
  reason?: string;
  timeline?: Array<{
    who: string;
    what: string;
    time: string;
    type: string;
    amount?: number;
  }>;
}

export interface Invoice extends SalesDocumentRecord {
  due: string;
}

export interface PurchaseDocumentRecord
  extends Omit<PurchaseDocument, "documentType" | "vendor" | "lines" | "currency"> {
  documentType?: DocumentKind;
  id: string;
  vendor: string;
  date: string;
  status: RecordStatus;
  currency?: string;
  baseCurrency?: string;
  exchangeRate?: number;
  snapshotDate?: string;
  projectId?: string;
  projectName?: string;
  due?: string;
  lines?: DocumentLine[];
  attachments?: string[];
  relatedDocument?: string;
  sourceDocumentId?: string;
  sourceDocumentType?: DocumentKind;
  relatedDocumentIds?: string[];
  linkedDocumentIds?: string[];
  documentTypes?: string[];
  documentTitle?: string;
  deliveryTo?: string;
  requestedBy?: string;
  department?: string;
  deliveryTerms?: string;
  receiveType?: "inventory" | "operating_expense";
  receiveMode?: "standalone" | "from_purchase_order";
  itemFlow?: "inventory" | "expense";
  relatedPurchaseOrderId?: string;
  approvalStatus?: string;
  verifiedBy?: string;
  internalRemark?: string;
  tags?: string[];
  evidenceCount?: number;
  taxPointDate?: string | null;
  taxPointReason?: string | null;
  taxInvoiceRequired?: boolean;
  vatReportingPeriod?: string | null;
  taxGuidance?: TaxGuidanceMessage[];
  vatAuditSnapshot?: VatAuditSnapshot;
  transactionType?: "goods" | "service" | string;
  deliveryDate?: string | null;
  ownershipTransferDate?: string | null;
  serviceCompletedDate?: string | null;
  paymentDate?: string | null;
  taxOverrideReason?: string | null;
  sourceDocuments?: {
    invoiceReceipt?: string[];
    paymentEvidence?: string[];
    deliveryEvidence?: string[];
    withholdingTaxEvidence?: string[];
  };
  accountantCategory?: string;
  paymentSummary?: {
    paid: number;
    remaining: number;
    status: PaymentStatus;
    lastPaymentDate?: string;
    lastPaymentMethod?: PaymentMethod | string;
    lastPaymentId?: string;
  };
  timeline?: Array<{
    who: string;
    what: string;
    time: string;
    type: string;
    amount?: number;
  }>;
}

export interface Expense extends PurchaseDocumentRecord {
  category: string;
  paymentMethod?: PaymentMethod | string;
  reference?: string;
  notes?: string;
}

export interface VendorPayment extends Omit<DomainPayment, "sourceDocumentType"> {
  id: string;
  vendor: string;
  amount: number;
  currency: string;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  sourceDocumentType?: DocumentKind | "expense";
  sourceDocumentIds?: string[];
  allocations?: Array<{
    documentId: string;
    documentType: DocumentKind | "expense";
    amount: number;
  }>;
  accountName?: string;
  accountNumber?: string;
  note?: string;
  chequeDate?: string;
  chequeCutDate?: string;
  chequeDepositDate?: string;
  chequeClearedDate?: string;
  withholdingTaxId?: string;
  withholdingTaxEnabled?: boolean;
  withholdingTaxAmount?: number;
  remainingBalance?: number;
}

export interface WithholdingTaxDocument
  extends Omit<DomainWithholdingTaxDocument, "sourceDocumentId"> {
  id: string;
  sourceDocumentId: string;
  relatedExpenseId?: string;
  relatedPaymentId?: string;
  vendor: string;
  date: string;
  incomeType: string;
  taxableAmount: number;
  filingMonth: string;
  status: RecordStatus;
  currency?: string;
}

export interface PayableSummary {
  id: string;
  sourceType: "expense" | "receive";
  vendor: string;
  date: string;
  due?: string;
  amount: number;
  paid: number;
  remaining: number;
  currency: string;
  status: RecordStatus;
  paymentStatus: PaymentStatus;
  category?: string;
  linkedDocumentIds?: string[];
  sourceDocumentId?: string;
}

export interface Customer extends Omit<DomainCustomer, "contactPerson"> {
  contact: string;
  contactPerson?: string;
  taxId?: string;
  address?: string;
}

export interface Product extends Omit<DomainProduct, "productType"> {
  type: string;
  productType?: "service" | "stock-counted" | "non-stock";
  openingStockQty?: number;
  openingCost?: number;
  openingDate?: string;
  averageCost?: number;
  lastMovementDate?: string;
  stockStatus?: "in_stock" | "low_stock" | "out_of_stock" | "negative_stock" | "inactive";
  stockSummary?: string;
}

export interface Project extends DomainProject {
  customer?: string;
  description?: string;
  revenue?: number;
  cost?: number;
  profit?: number;
  margin?: number;
  documentCount?: number;
  lastActivityDate?: string;
}

export interface AccountMovement {
  id: string;
  date: string;
  accountNumber: string;
  accountName: string;
  accountType?: FinanceAccount["accountType"];
  accountStatus?: FinanceAccount["status"];
  currency: string;
  direction: "in" | "out";
  amount: number;
  sourceType: string;
  sourceId: string;
  movementType: string;
  memo: string;
  counterparty?: string;
  counterAccountName?: string;
  status?: string;
  sourceRoute?: string;
}

export interface InventoryItem {
  sku: string;
  name: string;
  currentQty: number;
  unitCost: number;
  averageCost: number;
  stockStatus: "in_stock" | "low_stock" | "out_of_stock" | "negative_stock" | "inactive";
  lastMovementDate?: string;
  warehouse: string;
  status?: "active" | "inactive";
}

export interface InventoryMovement {
  id: string;
  sku: string;
  productName: string;
  sourceType: string;
  sourceDocumentId: string;
  sourceLabel?: string;
  qtyIn: number;
  qtyOut: number;
  beforeQty: number;
  afterQty: number;
  unitCost: number;
  averageCost?: number;
  effectiveDate: string;
  reason?: string;
  notes?: string;
  warehouse?: string;
}

export type ImportMode = "contacts" | "products" | "sales_documents";

export interface ImportPreviewRow {
  rowNumber: number;
  raw: Record<string, string>;
  mapped: Record<string, unknown>;
  errors: string[];
  valid: boolean;
}

export interface ImportPreview {
  mode: ImportMode;
  fileName: string;
  detectedColumns: string[];
  fileType: string;
  rows: ImportPreviewRow[];
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
  };
}

export interface ImportConfirmResult {
  mode: ImportMode;
  batchId: string;
  importedCount: number;
  secondaryCount: number;
  importedIds: string[];
  secondaryIds: string[];
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
  };
}

export interface Vendor extends Omit<DomainCustomer, "contactPerson"> {
  contact: string;
  contactPerson?: string;
  taxId?: string;
  address?: string;
}

export interface TopCustomerChartPoint {
  name: string;
  revenue: number;
}

export interface CashFlowPoint {
  month: string;
  in: number;
  out: number;
}

export interface RecentActivityItem {
  who: string;
  what: string;
  amount?: number;
  time: string;
  type: string;
}

export interface FinanceAccount extends DomainFinancialAccount {
  accountType?:
    | "bank"
    | "petty_cash"
    | "cheque_payable"
    | "credit_card_payable"
    | "payment_gateway";
  status?: "active" | "inactive";
  institution?: string;
  currency?: string;
}

export interface CompanySettings {
  name: string;
  taxId: string;
  branch: string;
  address: string;
  phone: string;
  email: string;
  contactName: string;
  website: string;
  vatRegistrationMode: "registered" | "not_registered";
  taxDefaults: {
    vatRate: number;
    taxMode: "exclusive" | "inclusive" | "exempt";
    withholdingRate: number;
  };
  bankAccounts?: Array<{
    id: string;
    bankName: string;
    accountName: string;
    accountNumber: string;
    branch?: string;
    promptPayId?: string;
    swiftCode?: string;
    isDefault?: boolean;
  }>;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: "active" | "inactive" | "pending";
  lastSeen: string;
  permissions?: UserPermission[];
  inviteToken?: string;
  inviteUrl?: string;
}

export type UserRole = "owner" | "employee";

export type UserPermission =
  | "dashboard"
  | "sales_documents"
  | "purchases_inventory"
  | "customers_vendors"
  | "reports_settings";

export interface OnboardingInviteRow {
  email: string;
  role: string;
}

export interface OnboardingDraft {
  step: number;
  companyName: string;
  companyTaxId: string;
  companyBranch: string;
  companyAddress: string;
  logoName: string;
  vatRegistration: string;
  vatRate: string;
  taxFrequency: string;
  issueWht: boolean;
  customerName: string;
  customerTaxId: string;
  customerEmail: string;
  productType: string;
  productSku: string;
  productName: string;
  productPrice: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  invites: OnboardingInviteRow[];
}

export interface OnboardingState {
  draft: OnboardingDraft;
  completed: boolean;
  completedAt?: string | null;
  updatedAt?: string | null;
}

export interface UsersSettings {
  inviteMessage: string;
  members: TeamMember[];
  permissionNotes: string[];
}

export interface DocumentSettings {
  headerTitle: string;
  quotationHeaderTitle: string;
  receiptHeaderTitle: string;
  footerNote: string;
  defaultTerms: string;
  taxMode: "exclusive" | "inclusive";
  showSignatureLine: boolean;
  perLineVat: boolean;
  perLineDiscount: boolean;
  showWhtFooter: boolean;
  perLineWithholdingTax: boolean;
  receiptAdjustmentFooter: boolean;
  accountantExpenseCategory: boolean;
  compactReceiptMode: boolean;
}

export interface TaxSettings {
  vatRegistered: boolean;
  vatRate: number;
  outputTaxRecognition: "invoice" | "payment";
  inputTaxRecognition: "expense" | "payment";
  stockDeductionTiming: "invoice" | "delivery";
  lockDocumentsAfterPayment: boolean;
  receiptVariant: string;
  withholdingEnabled: boolean;
  withholdingRate: number;
}

export interface BrandingSettings {
  logoUrl: string;
  logoPath?: string;
  logoContentType?: string;
  stampUrl: string;
  stampPath?: string;
  stampContentType?: string;
  signatureUrl: string;
  signaturePath?: string;
  signatureContentType?: string;
  signatureLabel: string;
  stampLabel: string;
  accentColor: string;
  documentTagline: string;
}

export interface NumberingSettings {
  mode: "continuous" | "year_month_reset" | "yearly_reset";
  serialDigits: 4 | 5;
  invoicePrefix: string;
  quotationPrefix: string;
  receiptPrefix: string;
  purchaseOrderPrefix: string;
  receivePrefix: string;
  expensePrefix: string;
  invoiceHeader: string;
  quotationHeader: string;
  receiptHeader: string;
  purchaseOrderHeader: string;
  receiveHeader: string;
  expenseHeader: string;
  backdatedInsertionWarning: string;
}

export interface CurrencySettings {
  baseCurrency: string;
  multiCurrencyEnabled: boolean;
  defaultExchangeRate: number;
  enabledCurrencies: string[];
  exchangeRateSource: "manual" | "bank_of_thailand" | "custom";
  manualRates: Record<string, number>;
  documentSnapshot: {
    useDocumentDate: boolean;
    fallbackRate: number;
    note: string;
  };
}

export type IntegrationStatus =
  | "connected"
  | "disconnected"
  | "coming_soon"
  | "needs_configuration";

export interface IntegrationConnection {
  key: string;
  name: string;
  description: string;
  status: IntegrationStatus;
  category: "marketplace" | "pos" | "delivery" | "tax" | "api";
  importMode?: ImportMode | "";
  lastSync?: string;
  config: Record<string, string>;
}

export interface IntegrationSettings {
  bankFeedsEnabled: boolean;
  emailDeliveryEnabled: boolean;
  eTaxEnabled: boolean;
  genericApi: {
    baseUrl: string;
    apiKeyLabel: string;
    webhookSecretLabel: string;
    notes: string;
  };
  connections: IntegrationConnection[];
}

export type SettingsSection =
  | "company"
  | "users"
  | "documents"
  | "taxes"
  | "branding"
  | "numbering"
  | "currency"
  | "integrations";

export interface ReportItem {
  key?: string;
  name: string;
  desc: string;
  icon: string;
}

export interface ReportGroup {
  cat: string;
  items: ReportItem[];
}

export interface DashboardSummary {
  revenue: number;
  expenses: number;
  netProfit: number;
  receivables: number;
  payables: number;
  cash: number;
  openInvoices: number;
  pendingExpenses: number;
  overdueInvoices: number;
  vatPayable: number;
}

export interface VatSummary {
  vatRegistered: boolean;
  filingPeriod: string;
  outputTax: number;
  inputTax: number;
  netVatPayable: number;
}

export interface AgingBucket {
  bucket: string;
  amount: number;
  count: number;
}

export interface CashMovement {
  date: string;
  direction: "in" | "out";
  amount: number;
  account: string;
  counterparty: string;
  sourceType: string;
  sourceId: string;
  description: string;
}

export interface TrialBalanceLine {
  account: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface ProfitAndLossSummary {
  revenue: number;
  expenses: number;
  grossProfit: number;
  netProfit: number;
}

export interface BalanceSheetSummary {
  cash: number;
  accountsReceivable: number;
  accountsPayable: number;
  inputVatRecoverable: number;
  outputVatPayable: number;
  assets: number;
  liabilities: number;
  equity: number;
}

export interface FinanceSummary {
  totalCash: number;
  bankAccounts: number;
  pendingPayouts: number;
  postingCoverage: number;
  cashIn: number;
  cashOut: number;
}

export interface PolicySummary {
  vatRegistered: boolean;
  vatRate: number;
  outputTaxRecognition: string;
  inputTaxRecognition: string;
  stockDeductionTiming: string;
  lockDocumentsAfterPayment: boolean;
  receiptVariant: string;
  withholdingEnabled: boolean;
  withholdingRate: number;
  baseCurrency: string;
  multiCurrencyEnabled: boolean;
  defaultExchangeRate: number;
  numbering: NumberingSettings;
  documents: DocumentSettings;
}

export interface TaxFilingRecord {
  id: string;
  filingType: "vat_summary" | "wht_filing" | "close_tax_period" | "payment_posting";
  period: string;
  status: string;
  note?: string;
  paymentDate?: string;
  paymentReference?: string;
  createdAt: string;
  summary: Record<string, string | number>;
}

export interface TaxOverview {
  vatSummary: VatSummary;
  pendingWhtDocuments: number;
  filingCount: number;
}

export interface PayrollEmployee {
  id: string;
  name: string;
  email: string;
  department?: string;
  position?: string;
  baseSalary: number;
  paymentMethod: "bank_transfer" | "cash" | "cheque";
  bankAccountHint?: string;
  status: "active" | "inactive";
}

export interface PayrollSettingsShell {
  defaultPayDate: string;
  salaryExpenseAccount: string;
  salaryPayableAccount: string;
  withholdingEnabled: boolean;
  socialSecurityEnabled: boolean;
  socialSecurityRate: number;
  notes: string;
}

export interface PayrollRunLine {
  employeeId: string;
  employeeName: string;
  grossPay: number;
  socialSecurity: number;
  withholdingTax: number;
  netPay: number;
}

export interface PayrollRun {
  id: string;
  period: string;
  status: string;
  payDate: string;
  notes?: string;
  createdAt: string;
  employeeCount: number;
  grossPay: number;
  deductions: number;
  netPay: number;
  lines: PayrollRunLine[];
}

export interface SupportRequestRecord {
  id: string;
  type: string;
  firstName: string;
  lastName?: string;
  email: string;
  company?: string;
  phone?: string;
  topic?: string;
  message: string;
  status: string;
  createdAt: string;
}

export interface AuthUser {
  name: string;
  email: string;
  company: string;
  role?: UserRole;
  permissions?: UserPermission[];
}

export interface AuthSession {
  user: AuthUser | null;
  isAuthed: boolean;
}

export interface AuthShellResponse {
  ok: boolean;
  supported: boolean;
  email: string;
  message: string;
  resetToken?: string;
}

export interface JournalLine {
  account: string;
  side: "debit" | "credit";
  amount: number;
}

export interface JournalEntry extends Omit<DomainJournalEntry, "lines"> {
  lines: JournalLine[];
  memo?: string;
  journalType?: "JV" | "UV" | "SV" | "PV" | "RV";
  status?: string;
  sourceRoute?: string;
  ruleExplanation?: string;
  projectId?: string;
  projectName?: string;
}

export interface AccountingOverview {
  dashboardSummary: DashboardSummary;
  topCustomersChart: TopCustomerChartPoint[];
  cashFlow: CashFlowPoint[];
  vatSummary: VatSummary;
  receivablesAging: AgingBucket[];
  payablesAging: AgingBucket[];
  linkedDocumentGraph?: Record<string, string[]>;
  cashMovements: CashMovement[];
  trialBalance: TrialBalanceLine[];
  profitAndLoss: ProfitAndLossSummary;
  balanceSheet: BalanceSheetSummary;
  financeSummary: FinanceSummary;
  policySummary: PolicySummary;
}

export interface AppData {
  invoices: Invoice[];
  expenses: Expense[];
  customers: Customer[];
  vendors: Vendor[];
  products: Product[];
  inventory: InventoryItem[];
  inventoryMovements: InventoryMovement[];
  quotations: DocumentSummary[];
  receipts: DocumentSummary[];
  billings: DocumentSummary[];
  creditNotes: DocumentSummary[];
  debitNotes: DocumentSummary[];
  deposits: DocumentSummary[];
  purchaseOrders: DocumentSummary[];
  receives: DocumentSummary[];
  vendorPayments: VendorPayment[];
  withholdingTaxDocuments: WithholdingTaxDocument[];
  topCustomersChart: TopCustomerChartPoint[];
  cashFlow: CashFlowPoint[];
  recentActivity: RecentActivityItem[];
  financeAccounts: FinanceAccount[];
  accountMovements: AccountMovement[];
  projects: Project[];
  reports: ReportGroup[];
  dashboardSummary: DashboardSummary;
  vatSummary: VatSummary;
  receivablesAging: AgingBucket[];
  payablesAging: AgingBucket[];
  linkedDocumentGraph?: Record<string, string[]>;
  cashMovements: CashMovement[];
  trialBalance: TrialBalanceLine[];
  profitAndLoss: ProfitAndLossSummary;
  balanceSheet: BalanceSheetSummary;
  financeSummary: FinanceSummary;
  policySummary: PolicySummary;
  currencySettings: CurrencySettings;
}

export interface CreateDocumentPayload {
  id?: string;
  number?: string;
  customer?: string;
  vendor?: string;
  receivedFrom?: string;
  date: string;
  due?: string;
  expiryDate?: string;
  reference?: string;
  paymentTerms?: string;
  paymentMethod?: PaymentMethod | string;
  paymentDetails?: Record<string, unknown>;
  documentSettingsSnapshot?: DocumentSettings;
  taxMode?: "exclusive" | "inclusive";
  relatedInvoice?: string;
  relatedDocument?: string;
  currency?: string;
  exchangeRate?: number;
  projectId?: string;
  projectName?: string;
  notes?: string;
  internalNote?: string;
  customerAcknowledgement?: string;
  description?: string;
  status?: RecordStatus;
  createdBy?: string;
  amount?: number;
  taxAmount?: number;
  netAmount?: number;
  subtotal?: number;
  discountType?: "percent" | "amount" | string;
  discountValue?: number;
  vatEnabled?: boolean;
  withholdingEnabled?: boolean;
  deliveryTo?: string;
  requestedBy?: string;
  department?: string;
  deliveryTerms?: string;
  approvalStatus?: string;
  verifiedBy?: string;
  internalRemark?: string;
  category?: string;
  accountantCategory?: string;
  relatedPurchaseOrderId?: string;
  receiveType?: "inventory" | "operating_expense";
  receiveMode?: "standalone" | "from_purchase_order";
  itemFlow?: "inventory" | "expense";
  documentVariant?: string;
  documentTypes?: string[];
  documentTitle?: string;
  sourceInvoiceIds?: string[];
  sourceBillingId?: string;
  sourceDocumentId?: string;
  sourceDocumentNumber?: string;
  sourceDocumentType?: DocumentKind;
  sourceDocumentDate?: string;
  sourceDocumentCustomer?: string;
  relatedDocumentIds?: string[];
  linkedDocumentIds?: string[];
  referenceDocuments?: ReferenceDocument[];
  parentQuotationId?: string;
  installmentSourceId?: string;
  installmentIndex?: number;
  installmentCount?: number;
  installmentSplitMode?: "amount" | "quantity";
  installmentPlan?: Array<{
    id: string;
    label: string;
    amount: number;
    qty?: number;
    relatedDocumentId?: string;
    status?: RecordStatus | string;
  }>;
  installmentHistory?: Array<{
    id: string;
    action: string;
    createdAt: string;
    createdDocumentId?: string;
    amount?: number;
  }>;
  receiptAdjustments?: Array<{
    id: string;
    type: "special_discount" | "commission" | "service_fee" | "rounding";
    amount: number;
    note?: string;
  }>;
  splitReceives?: Array<{
    id: string;
    amount: number;
    paymentMethod?: PaymentMethod | string;
    receivedAt: string;
    note?: string;
  }>;
  billingStatus?: "draft" | "pending_bill" | "billed" | "invoiced";
  paymentSummary?: {
    received: number;
    remaining: number;
    netReceivable: number;
  };
  adjustmentSummary?: {
    specialDiscount?: number;
    commission?: number;
    serviceFee?: number;
    rounding?: number;
  };
  netReceivable?: number;
  stockCutBehavior?: "follow_policy" | "cut_stock" | "no_stock_cut";
  reason?: string;
  timeline?: Array<{
    who: string;
    what: string;
    time: string;
    type: string;
    amount?: number;
  }>;
  tags?: string[];
  lines?: Array<{
    id?: string;
    sku?: string;
    inventoryId?: string;
    originalInventoryCode?: string;
    displayCode?: string;
    desc: string;
    details?: string;
    qty: number;
    unit?: string;
    price: number;
    tax: number;
    vatRate?: number;
    discount?: number;
    amountBeforeVat?: number;
    vatAmount?: number;
    withholdingRate?: number;
    withholdingAmount?: number;
    totalAmount?: number;
    availableStock?: number;
    stockOverrideAcknowledged?: boolean;
    sourceDocumentId?: string;
    sourceDocumentType?: string;
    sourceLineId?: string;
  }>;
  relatedDocumentNumber?: string;
  documentLanguage?: "th" | "en" | string;
  documentCopy?: "original" | "copy" | string;
  copyGeneration?: "both" | "original" | "copy" | string;
  primaryDocumentType?: string;
  documentNumberPrefix?: string;
  sellerInfo?: {
    code?: string;
    name?: string;
    address?: string;
    taxId?: string;
    branch?: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    website?: string;
    note?: string;
  };
  sellerUserId?: string;
  sellerUserInfo?: {
    id?: string;
    name?: string;
    email?: string;
    role?: string;
  };
  customerInfo?: {
    code?: string;
    name?: string;
    address?: string;
    taxId?: string;
    branch?: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    website?: string;
    note?: string;
  };
  salesperson?: string;
  documentContact?: string;
  brandingSnapshot?: Record<string, string>;
  subtotalBeforeDiscount?: number;
  totalDiscount?: number;
  amountBeforeVat?: number;
  vatRate?: number;
  withholdingRate?: number;
  withholdingAmount?: number;
  vatGroups?: TaxRateGroup[];
  withholdingGroups?: TaxRateGroup[];
  totalWithholdingTax?: number;
  amountPaid?: number;
  amountDue?: number;
  transactionType?: "goods" | "service" | string;
  deliveryDate?: string | null;
  ownershipTransferDate?: string | null;
  serviceCompletedDate?: string | null;
  paymentDate?: string | null;
  taxPointDate?: string | null;
  taxPointReason?: string | null;
  taxInvoiceRequired?: boolean;
  vatReportingPeriod?: string | null;
  taxGuidance?: TaxGuidanceMessage[];
  vatAuditSnapshot?: VatAuditSnapshot;
  taxOverrideReason?: string | null;
  amountInWordsThai?: string;
  amountInWordsEnglish?: string;
}

export interface TaxRateGroup {
  rate: number;
  taxableBase: number;
  taxAmount: number;
}

export interface ReferenceDocument {
  id: string;
  number?: string;
  type?: DocumentKind | string;
  kind: DocumentKind | string;
  documentTypes?: string[];
  party?: string;
  date?: string;
  amount?: number;
  total?: number;
  status?: string;
}

export interface Payment extends DomainPayment {
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
}

export interface AccountingEvent extends DomainAccountingEvent {}

export type CustomerRecord = Customer;
export type PurchaseRecord = PurchaseDocumentRecord;

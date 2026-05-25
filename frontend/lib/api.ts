import type {
  AccountingOverview,
  AccountMovement,
  AppData,
  Attachment,
  AuthSession,
  BrandingSettings,
  CurrencySettings,
  CompanySettings,
  CreateDocumentPayload,
  DocumentKind,
  DocumentWorkflowNextActions,
  DocumentWorkflowRules,
  DocumentSettings,
  DocumentSummary,
  Expense,
  FinanceAccount,
  Invoice,
  IntegrationSettings,
  ImportConfirmResult,
  ImportMode,
  ImportPreview,
  InventoryItem,
  InventoryMovement,
  AuthShellResponse,
  JournalEntry,
  NumberingSettings,
  OnboardingDraft,
  OnboardingState,
  PayableSummary,
  PayrollEmployee,
  PayrollRun,
  PayrollSettingsShell,
  Project,
  Customer,
  Product,
  SettingsSection,
  SupportRequestRecord,
  TaxFilingRecord,
  TaxOverview,
  UsersSettings,
  TaxSettings,
  VendorPayment,
  Vendor,
  WithholdingTaxDocument,
} from "@/lib/types";

const DEFAULT_API_PORT = "5000";

export const getApiBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:${DEFAULT_API_PORT}`;
  }

  return `http://localhost:${DEFAULT_API_PORT}`;
};

export const buildApiUrl = (path: string) => `${getApiBaseUrl()}${path}`;

const extractResponseErrorMessage = (status: number, rawBody: string, parsedBody: unknown) => {
  const errorPayload =
    parsedBody && typeof parsedBody === "object" && "error" in parsedBody
      ? (parsedBody as { error?: { message?: string } }).error
      : null;

  return (
    errorPayload?.message ||
    (parsedBody &&
    typeof parsedBody === "object" &&
    "message" in parsedBody &&
    typeof (parsedBody as { message?: unknown }).message === "string"
      ? ((parsedBody as { message: string }).message as string)
      : null) ||
    (rawBody && !rawBody.trim().startsWith("<") ? rawBody : null) ||
    `API request failed with status ${status}`
  );
};

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const rawBody = await response.text();
  let parsedBody: unknown = null;

  if (rawBody) {
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      parsedBody = null;
    }
  }

  if (!response.ok) {
    throw new Error(extractResponseErrorMessage(response.status, rawBody, parsedBody));
  }

  if (!rawBody) {
    return null as T;
  }

  if (parsedBody === null) {
    throw new Error("API returned an invalid JSON response.");
  }

  return parsedBody as T;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const response = await fetch(buildApiUrl(path), {
    cache: "no-store",
    ...init,
    credentials: "include",
    headers,
  });

  return parseJsonResponse<T>(response);
}

const extractFilename = (response: Response, fallback: string) => {
  const contentDisposition = response.headers.get("content-disposition");
  if (!contentDisposition) {
    return fallback;
  }

  const match = contentDisposition.match(/filename="?([^"]+)"?/i);
  return match?.[1] ?? fallback;
};

export async function downloadApiFile(path: string, fallbackName: string) {
  const response = await fetch(buildApiUrl(path), {
    cache: "no-store",
    credentials: "include",
  });
  if (!response.ok) {
    const rawBody = await response.text();
    let parsedBody: unknown = null;
    if (rawBody) {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        parsedBody = null;
      }
    }

    throw new Error(extractResponseErrorMessage(response.status, rawBody, parsedBody));
  }

  const blob = await response.blob();
  const downloadName = extractFilename(response, fallbackName);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = downloadName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function downloadApiFileFromPost(path: string, payload: unknown, fallbackName: string) {
  const response = await fetch(buildApiUrl(path), {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const rawBody = await response.text();
    let parsedBody: unknown = null;
    if (rawBody) {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        parsedBody = null;
      }
    }
    throw new Error(extractResponseErrorMessage(response.status, rawBody, parsedBody));
  }

  const blob = await response.blob();
  const downloadName = extractFilename(response, fallbackName);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = downloadName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export const fetchBootstrapData = () => fetchJson<AppData>("/api/bootstrap");

export const fetchAuthSession = () => fetchJson<AuthSession>("/api/auth/session");

export const createAuthSession = (payload?: {
  email?: string;
  name?: string;
  company?: string;
}) =>
  fetchJson<AuthSession>("/api/auth/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload ?? {}),
  });

export const clearAuthSession = () =>
  fetchJson<AuthSession>("/api/auth/session", {
    method: "DELETE",
  });

export const fetchOnboardingState = () => fetchJson<OnboardingState>("/api/onboarding/draft");

export const saveOnboardingDraft = (payload: OnboardingDraft) =>
  fetchJson<OnboardingState>("/api/onboarding/draft", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

export const completeOnboarding = (payload: OnboardingDraft) =>
  fetchJson<OnboardingState>("/api/onboarding/complete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

export const fetchAccountingOverview = () =>
  fetchJson<AccountingOverview>("/api/accounting/overview");

export const fetchJournalEntries = () =>
  fetchJson<JournalEntry[]>("/api/accounting/journal");

export const createDocument = (kind: DocumentKind, payload: CreateDocumentPayload) =>
  fetchJson<Invoice | DocumentSummary>(`/api/documents/${kind}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

export const fetchDocument = <T>(kind: DocumentKind, id: string) =>
  fetchJson<T>(`/api/documents/${kind}/${id}`);

export const removeDocument = (
  kind: DocumentKind,
  id: string,
  payload: { mode: "delete" | "void" | "remove"; reason?: string; preserveAuditTrail?: boolean }
) =>
  fetchJson<Invoice | DocumentSummary>(`/api/documents/${encodeURIComponent(kind)}/${encodeURIComponent(id)}/remove`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

export const fetchDocumentWorkflowRules = () =>
  fetchJson<DocumentWorkflowRules>("/api/document-workflow/rules");

export const fetchDocumentNextActions = (kind: string, id: string) =>
  fetchJson<DocumentWorkflowNextActions>(
    `/api/documents/${encodeURIComponent(kind)}/${encodeURIComponent(id)}/next-actions`
  );

export const validateDocumentFlow = (kind: string, payload: {
  sourceKind?: string;
  targetKind?: string;
  workflowMode?: "strict" | "guided" | "free";
  overrideReason?: string;
}) =>
  fetchJson<{
    valid: boolean;
    allowed: boolean;
    severity: "info" | "warning" | "error";
    warning?: { messageKey: string; sourceKind?: string; targetKind?: string } | null;
    requiresOverrideReason?: boolean;
    overrideReason?: string;
  }>(`/api/documents/${encodeURIComponent(kind)}/validate-flow`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

export const convertDocumentWorkflow = (kind: string, id: string, payload: {
  targetKind: string;
  workflowMode?: "strict" | "guided" | "free";
  overrideReason?: string;
  overrides?: Record<string, unknown>;
}) =>
  fetchJson<Invoice | DocumentSummary | VendorPayment>(
    `/api/documents/${encodeURIComponent(kind)}/${encodeURIComponent(id)}/convert`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

export const linkDocumentWorkflow = (kind: string, id: string, payload: {
  targetDocumentId: string;
  relationType?: string;
}) =>
  fetchJson<{ source: DocumentSummary; target: DocumentSummary }>(
    `/api/documents/${encodeURIComponent(kind)}/${encodeURIComponent(id)}/link`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

export const overrideWorkflowWarning = (kind: string, id: string, payload: {
  overrideReason: string;
  workflowMode?: "strict" | "guided" | "free";
}) =>
  fetchJson<DocumentSummary>(
    `/api/documents/${encodeURIComponent(kind)}/${encodeURIComponent(id)}/override-workflow-warning`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

export const fetchInvoiceDetail = (id: string) => fetchJson<Invoice>(`/api/invoices/${id}`);

export const fetchExpenseDetail = (id: string) => fetchJson<Expense>(`/api/expenses/${id}`);

export const createExpense = (payload: {
  id?: string;
  vendor: string;
  category: string;
  date: string;
  amount: number;
  paymentMethod: string;
  currency?: string;
  exchangeRate?: number;
  projectId?: string;
  projectName?: string;
  due?: string;
  reference?: string;
  notes?: string;
  accountantCategory?: string;
  status?: string;
  sourceDocumentId?: string;
  sourceDocumentType?: string;
  sourceDocuments?: {
    invoiceReceipt?: string[];
    paymentEvidence?: string[];
    deliveryEvidence?: string[];
    withholdingTaxEvidence?: string[];
  };
  linkedDocumentIds?: string[];
  paymentSummary?: {
    paid: number;
    remaining: number;
    status: string;
    lastPaymentDate?: string;
    lastPaymentMethod?: string;
    lastPaymentId?: string;
  };
}) =>
  fetchJson<Expense>("/api/expenses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

export const updateExpense = (
  expenseId: string,
  payload: {
    vendor: string;
    category: string;
    date: string;
    amount: number;
    paymentMethod: string;
    currency?: string;
    exchangeRate?: number;
    projectId?: string;
    projectName?: string;
    due?: string;
    reference?: string;
    notes?: string;
    accountantCategory?: string;
    status?: string;
    linkedDocumentIds?: string[];
  }
) =>
  fetchJson<Expense>(`/api/expenses/${encodeURIComponent(expenseId)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

export const createCustomer = (payload: {
  id?: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  taxId?: string;
  address?: string;
  balance?: number;
  status?: string;
  [key: string]: unknown;
}) =>
  fetchJson<Customer>("/api/customers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

export const updateCustomer = (
  customerId: string,
  payload: {
    id?: string;
    name: string;
    contact: string;
    email: string;
    phone: string;
    taxId?: string;
    address?: string;
    balance?: number;
    status?: string;
    [key: string]: unknown;
  }
) =>
  fetchJson<Customer>(`/api/customers/${encodeURIComponent(customerId)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

export const createVendor = (payload: {
  id?: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  taxId?: string;
  address?: string;
  balance?: number;
  status?: string;
  [key: string]: unknown;
}) =>
  fetchJson<Vendor>("/api/vendors", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

export const updateVendor = (
  vendorId: string,
  payload: {
    name: string;
    contact: string;
    email: string;
    phone: string;
    taxId?: string;
    address?: string;
    balance?: number;
    status?: string;
    [key: string]: unknown;
  }
) =>
  fetchJson<Vendor>(`/api/vendors/${encodeURIComponent(vendorId)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

export const createProduct = (payload: {
  sku?: string;
  name: string;
  type: string;
  productType?: string;
  price: number;
  stock: number | null;
  openingStockQty?: number;
  openingCost?: number;
  openingDate?: string;
  status?: string;
}) =>
  fetchJson<Product>("/api/products", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

export const updateProduct = (
  sku: string,
  payload: {
    name: string;
    type: string;
    productType?: string;
    price: number;
    stock: number | null;
    openingStockQty?: number;
    openingCost?: number;
    openingDate?: string;
    status?: string;
  }
) =>
  fetchJson<Product>(`/api/products/${encodeURIComponent(sku)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

export const fetchInventorySnapshot = () => fetchJson<InventoryItem[]>("/api/inventory");

export const fetchInventoryMovements = (sku?: string) =>
  fetchJson<InventoryMovement[]>(
    sku ? `/api/inventory/movements?sku=${encodeURIComponent(sku)}` : "/api/inventory/movements"
  );

export const createStockAdjustment = (payload: {
  sku: string;
  adjustmentType: "increase" | "decrease";
  qty: number;
  effectiveDate: string;
  reason: string;
  notes?: string;
}) =>
  fetchJson<{ movement: InventoryMovement; inventoryItem: InventoryItem | null }>(
    "/api/inventory/adjustments",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

export const createFinanceAccount = (payload: {
  name: string;
  number?: string;
  balance: number;
  accountType?: string;
  status?: string;
  institution?: string;
  currency?: string;
  primary?: boolean;
}) =>
  fetchJson<FinanceAccount>("/api/finance/accounts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

export const updateFinanceAccount = (
  accountNumber: string,
  payload: {
    name: string;
    balance: number;
    accountType?: string;
    status?: string;
    institution?: string;
    currency?: string;
    primary?: boolean;
  }
) =>
  fetchJson<FinanceAccount>(`/api/finance/accounts/${encodeURIComponent(accountNumber)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

export const fetchFinanceAccountMovements = (accountNumber?: string) =>
  fetchJson<AccountMovement[]>(
    accountNumber
      ? `/api/finance/movements?accountNumber=${encodeURIComponent(accountNumber)}`
      : "/api/finance/movements"
  );

export const createFinanceMovement = (payload: {
  movementType: "top_up" | "transfer";
  sourceAccountNumber: string;
  destinationAccountNumber: string;
  amount: number;
  date: string;
  note?: string;
}) =>
  fetchJson<AccountMovement>("/api/finance/movements", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

export const fetchProjects = () => fetchJson<Project[]>("/api/projects");

export const createProject = (payload: {
  id?: string;
  code?: string;
  name: string;
  status?: string;
  customer?: string;
  description?: string;
}) =>
  fetchJson<Project>("/api/projects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

export const updateProject = (
  projectId: string,
  payload: {
    code?: string;
    name: string;
    status?: string;
    customer?: string;
    description?: string;
  }
) =>
  fetchJson<Project>(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

export const deleteProject = async (projectId: string) => {
  const response = await fetch(buildApiUrl(`/api/projects/${encodeURIComponent(projectId)}`), {
    method: "DELETE",
    credentials: "include",
  });
  return parseJsonResponse<{ ok: boolean }>(response);
};

export const sendInvoiceToCustomer = (id: string) =>
  fetchJson<Invoice>(`/api/invoices/${id}/send`, {
    method: "POST",
  });

export const sendPaymentReminders = () =>
  fetchJson<{ count: number }>(`/api/invoices/reminders`, {
    method: "POST",
  });

export const approveExpenseRecord = (id: string) =>
  fetchJson<Expense>(`/api/expenses/${id}/approve`, {
    method: "POST",
  });

export const fetchPayables = () => fetchJson<PayableSummary[]>("/api/payables");

export const fetchVendorPayments = () => fetchJson<VendorPayment[]>("/api/payments");

export const createVendorPayment = (payload: {
  vendor: string;
  amount: number;
  currency: string;
  paymentDate: string;
  paymentMethod: string;
  paymentStatus?: string;
  note?: string;
  accountName?: string;
  accountNumber?: string;
  chequeDate?: string;
  chequeCutDate?: string;
  chequeDepositDate?: string;
  chequeClearedDate?: string;
  allocations: Array<{
    documentId: string;
    documentType: string;
    amount: number;
  }>;
  autoCreateWht?: boolean;
  whtRate?: number;
  taxableAmount?: number;
  incomeType?: string;
  filingMonth?: string;
}) =>
  fetchJson<VendorPayment>("/api/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

export const updateVendorPayment = (
  paymentId: string,
  payload: {
    paymentDate: string;
    paymentMethod: string;
    paymentStatus?: string;
    note?: string;
    accountName?: string;
    accountNumber?: string;
    chequeDate?: string;
    chequeCutDate?: string;
    chequeDepositDate?: string;
    chequeClearedDate?: string;
  }
) =>
  fetchJson<VendorPayment>(`/api/payments/${encodeURIComponent(paymentId)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

export const fetchWithholdingTaxDocuments = () =>
  fetchJson<WithholdingTaxDocument[]>("/api/withholding-tax");

export const createWithholdingTaxDocument = (payload: {
  relatedExpenseId?: string;
  relatedPaymentId?: string;
  sourceDocumentId: string;
  vendor: string;
  incomeType: string;
  taxableAmount: number;
  rate: number;
  amount: number;
  filingMonth: string;
  status?: string;
  date?: string;
}) =>
  fetchJson<WithholdingTaxDocument>("/api/withholding-tax", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

export const fetchCompanySettings = () => fetchJson<CompanySettings>("/api/settings/company");

export const saveCompanySettings = (payload: CompanySettings) =>
  fetchJson<CompanySettings>("/api/settings/company", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

type SettingsPayloadMap = {
  company: CompanySettings;
  users: UsersSettings;
  documents: DocumentSettings;
  taxes: TaxSettings;
  branding: BrandingSettings;
  numbering: NumberingSettings;
  currency: CurrencySettings;
  integrations: IntegrationSettings;
};

export const fetchSettingsSection = <T extends SettingsSection>(section: T) =>
  fetchJson<SettingsPayloadMap[T]>(`/api/settings/${section}`);

export const saveSettingsSection = <T extends SettingsSection>(
  section: T,
  payload: SettingsPayloadMap[T]
) =>
  fetchJson<SettingsPayloadMap[T]>(`/api/settings/${section}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

export const uploadBrandingAsset = async (assetKey: "logo" | "stamp" | "signature", file: File) => {
  const body = new FormData();
  body.append("file", file);

  const response = await fetch(buildApiUrl(`/api/settings/branding/assets/${assetKey}`), {
    method: "POST",
    body,
    credentials: "include",
  });

  return parseJsonResponse<BrandingSettings>(response);
};

export const fetchAttachments = (entityType: string, entityId: string) =>
  fetchJson<Attachment[]>(
    `/api/attachments?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`
  );

export const uploadAttachments = async ({
  entityType,
  entityId,
  files,
  category,
  note,
  attachedBy,
  tags,
}: {
  entityType: string;
  entityId: string;
  files: File[];
  category: string;
  note?: string;
  attachedBy?: string;
  tags?: string[];
}) => {
  const body = new FormData();
  body.append("entityType", entityType);
  body.append("entityId", entityId);
  body.append("category", category);
  body.append("note", note ?? "");
  body.append("attachedBy", attachedBy ?? "Matter Acc.");
  body.append("tags", (tags ?? []).join(","));
  files.forEach((file) => body.append("files", file));

  const response = await fetch(buildApiUrl("/api/attachments"), {
    method: "POST",
    body,
    credentials: "include",
  });

  return parseJsonResponse<Attachment[]>(response);
};

export const downloadDocumentPdf = (kind: DocumentKind, id: string) =>
  downloadApiFile(`/api/documents/${kind}/${id}/pdf`, `${id}.pdf`);

export const downloadPreviewDocumentPdf = (kind: DocumentKind, payload: CreateDocumentPayload, fallbackName: string) =>
  downloadApiFileFromPost(`/api/documents/${kind}/preview-pdf`, payload, fallbackName);

export const downloadPreviewImagesPdf = async (payload: { images: string[]; filename: string }) => {
  const response = await fetch(buildApiUrl("/api/documents/preview-image-pdf"), {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const rawBody = await response.text();
    let parsedBody: unknown = null;
    if (rawBody) {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        parsedBody = null;
      }
    }
    throw new Error(extractResponseErrorMessage(response.status, rawBody, parsedBody));
  }

  const blob = await response.blob();
  const downloadName = extractFilename(response, payload.filename || "document.pdf");
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = downloadName.endsWith(".pdf") ? downloadName : `${downloadName}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export const exportResource = (resource: string) =>
  downloadApiFile(`/api/exports/${resource}.csv`, `${resource}.csv`);

export const downloadReport = (reportKey: string) =>
  downloadApiFile(`/api/reports/${reportKey}/download`, `${reportKey}.csv`);

export const downloadExpenseReceipt = (id: string) =>
  downloadApiFile(`/api/expenses/${id}/receipt`, `${id}-receipt.pdf`);

export const downloadWithholdingTaxText = (id: string) =>
  downloadApiFile(`/api/withholding-tax/${encodeURIComponent(id)}/download`, `${id}.txt`);

export const downloadAttachment = (attachment: Attachment) =>
  downloadApiFile(attachment.downloadUrl, attachment.name);

export const deleteAttachment = async (attachment: Attachment) => {
  const response = await fetch(buildApiUrl(`/api/attachments/${encodeURIComponent(attachment.id)}`), {
    method: "DELETE",
    credentials: "include",
  });
  return parseJsonResponse<{ ok: boolean }>(response);
};

export const downloadImportTemplate = (mode: ImportMode) =>
  downloadApiFile(`/api/import/templates/${encodeURIComponent(mode)}`, `${mode}-template.csv`);

export const fetchTaxOverview = () => fetchJson<TaxOverview>("/api/tax/overview");

export const fetchTaxFilings = () => fetchJson<TaxFilingRecord[]>("/api/tax/filings");

export const createTaxFiling = (payload: {
  filingType: TaxFilingRecord["filingType"];
  period: string;
  status?: string;
  note?: string;
  paymentDate?: string;
  paymentReference?: string;
}) =>
  fetchJson<TaxFilingRecord>("/api/tax/filings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

export const downloadTaxFiling = (filingId: string) =>
  downloadApiFile(`/api/tax/filings/${encodeURIComponent(filingId)}/download`, `${filingId}.txt`);

export const fetchPayrollSettings = () => fetchJson<PayrollSettingsShell>("/api/payroll/settings");

export const savePayrollSettings = (payload: PayrollSettingsShell) =>
  fetchJson<PayrollSettingsShell>("/api/payroll/settings", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

export const fetchPayrollEmployees = () => fetchJson<PayrollEmployee[]>("/api/payroll/employees");

export const savePayrollEmployee = (payload: {
  id?: string;
  name: string;
  email: string;
  department?: string;
  position?: string;
  baseSalary: number;
  paymentMethod: PayrollEmployee["paymentMethod"];
  bankAccountHint?: string;
  status?: PayrollEmployee["status"];
}) =>
  fetchJson<PayrollEmployee>("/api/payroll/employees", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

export const fetchPayrollRuns = () => fetchJson<PayrollRun[]>("/api/payroll/runs");

export const createPayrollRun = (payload: {
  period: string;
  payDate?: string;
  notes?: string;
  status?: string;
  employeeIds?: string[];
}) =>
  fetchJson<PayrollRun>("/api/payroll/runs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

export const downloadPayrollRun = (runId: string) =>
  downloadApiFile(`/api/payroll/runs/${encodeURIComponent(runId)}/download`, `${runId}.csv`);

export const submitContactRequest = (payload: {
  firstName: string;
  lastName?: string;
  email: string;
  company?: string;
  phone?: string;
  topic?: string;
  message: string;
}) =>
  fetchJson<SupportRequestRecord>("/api/support/contact", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

export const submitDemoRequest = (payload: {
  firstName: string;
  lastName?: string;
  email: string;
  company?: string;
  phone?: string;
  topic?: string;
  message: string;
}) =>
  fetchJson<SupportRequestRecord>("/api/support/demo", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

export const requestPasswordReset = (payload: { email: string }) =>
  fetchJson<AuthShellResponse>("/api/auth/forgot-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

export const resetPasswordRequest = (payload: { token: string; password: string }) =>
  fetchJson<AuthShellResponse>("/api/auth/reset-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

export const previewImportFile = async (mode: ImportMode, file: File) => {
  const body = new FormData();
  body.append("mode", mode);
  body.append("file", file);

  const response = await fetch(buildApiUrl("/api/import/preview"), {
    method: "POST",
    body,
    credentials: "include",
  });

  return parseJsonResponse<ImportPreview>(response);
};

export const confirmImportRows = (mode: ImportMode, rows: ImportPreview["rows"]) =>
  fetchJson<ImportConfirmResult>("/api/import/confirm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ mode, rows }),
  });

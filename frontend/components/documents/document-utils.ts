import { buildApiUrl } from "@/lib/api";
import type {
  SalesDocumentBankAccount,
  SalesDocumentCopyKind,
  SalesDocumentLanguage,
  SalesDocumentLine,
  SalesDocumentPaymentDetails,
  SalesDocumentTaxGroup,
} from "@/components/documents/types";

export const BRAND_ACCENT = "#2DD4BF";

export const resolveDocumentAssetUrl = (value = "") =>
  !value ? "" : value.startsWith("http") ? value : buildApiUrl(value);

export const formatDocumentNumber = (value: number) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const formatDocumentQuantity = (value: number | null | undefined) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const normalizeDocumentPercent = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(Math.max(Math.trunc(numeric), 0), 100);
};

export const formatDocumentPercent = (value: number) => `${normalizeDocumentPercent(value)}%`;
const normalizeWithholdingPercent = (value: unknown) => {
  const rate = normalizeDocumentPercent(value);
  return [0, 1, 2, 3, 5].includes(rate) ? rate : 0;
};

export const formatDocumentMoney = (amount: number, currency: string) =>
  `${currency} ${formatDocumentNumber(amount)}`;

export const getCopyLabel = (kind: SalesDocumentCopyKind, language: SalesDocumentLanguage) => {
  if (language === "th") return kind === "original" ? "ต้นฉบับ" : "สำเนา";
  return kind === "original" ? "Original" : "Copy";
};

export const validDocumentLines = (lines: SalesDocumentLine[]) =>
  lines.filter((line) => line.desc.trim() && Number(line.qty) > 0);

export const getLineAmountBeforeVat = (line: SalesDocumentLine) =>
  Number(line.qty || 0) * Number(line.price || 0);

export const getLineDiscountAmount = (line: SalesDocumentLine) =>
  Math.min(
    line.discountType === "amount"
      ? Number(line.discountValue ?? line.discountAmount ?? line.discount) || 0
      : Number(line.qty || 0) * Number(line.price || 0) * ((Number(line.discountValue ?? line.discount) || 0) / 100),
    getLineAmountBeforeVat(line)
  );

export const getLineTaxableBase = (line: SalesDocumentLine, perLineDiscount = true) =>
  Math.max(getLineAmountBeforeVat(line) - (perLineDiscount ? getLineDiscountAmount(line) : 0), 0);

export const getLineDisplayTotal = (
  line: SalesDocumentLine,
  { perLineDiscount = true }: { taxMode?: "exclusive" | "inclusive"; perLineDiscount?: boolean } = {}
) => {
  const gross = Number(line.qty || 0) * Number(line.price || 0);
  const discount = perLineDiscount ? getLineDiscountAmount(line) : 0;
  return Math.max(gross - discount, 0);
};

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const addGroup = (
  groups: Map<number, SalesDocumentTaxGroup>,
  rate: number,
  taxableBase: number,
  taxAmount: number
) => {
  const current = groups.get(rate) ?? { rate, taxableBase: 0, taxAmount: 0 };
  groups.set(rate, {
    rate,
    taxableBase: roundMoney(current.taxableBase + taxableBase),
    taxAmount: roundMoney(current.taxAmount + taxAmount),
  });
};

const sortGroups = (groups: Map<number, SalesDocumentTaxGroup>) =>
  Array.from(groups.values()).sort((left, right) => right.rate - left.rate);

export const groupVatTotalsByRate = (
  lines: SalesDocumentLine[],
  {
    taxMode = "exclusive",
    defaultTaxRate = 0,
    vatEnabled = true,
    perLineDiscount = true,
    includeZeroRate = false,
  }: {
    taxMode?: "exclusive" | "inclusive";
    defaultTaxRate?: number;
    vatEnabled?: boolean;
    perLineDiscount?: boolean;
    includeZeroRate?: boolean;
  } = {}
) => {
  const groups = new Map<number, SalesDocumentTaxGroup>();
  validDocumentLines(lines).forEach((line) => {
    const rate = vatEnabled ? normalizeDocumentPercent(line.vatRate ?? line.tax ?? defaultTaxRate) : 0;
    const taxableInput = getLineTaxableBase(line, perLineDiscount);
    const taxableBase = roundMoney(taxableInput);
    const taxAmount = rate > 0 ? roundMoney(taxableBase * (rate / 100)) : 0;
    if (rate > 0 || includeZeroRate) {
      addGroup(groups, rate, taxableBase, taxAmount);
    }
  });
  return sortGroups(groups);
};

export const groupWithholdingTotalsByRate = (
  lines: SalesDocumentLine[],
  {
    defaultWithholdingRate = 0,
    perLineWithholding = false,
    perLineDiscount = true,
    includeZeroRate = false,
  }: {
    defaultWithholdingRate?: number;
    perLineWithholding?: boolean;
    perLineDiscount?: boolean;
    includeZeroRate?: boolean;
  } = {}
) => {
  const groups = new Map<number, SalesDocumentTaxGroup>();
  validDocumentLines(lines).forEach((line) => {
    const rate = normalizeWithholdingPercent(perLineWithholding ? line.withholdingRate : defaultWithholdingRate);
    const taxableBase = roundMoney(getLineTaxableBase(line, perLineDiscount));
    const taxAmount = roundMoney(taxableBase * (rate / 100));
    if (rate > 0 || includeZeroRate) {
      addGroup(groups, rate, taxableBase, taxAmount);
    }
  });
  return sortGroups(groups);
};

export const getDominantVatRate = (lines: SalesDocumentLine[]) => {
  const validLines = validDocumentLines(lines);
  if (!validLines.length) return 0;
  const rates = validLines.map((line) => Number(line.tax) || 0);
  const rateCounts = rates.reduce<Record<string, number>>((acc, rate) => {
    const key = String(rate);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  return Number(
    Object.entries(rateCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? rates[0] ?? 0
  );
};

export const formatPaymentDetailsForDocument = (
  method: string,
  details: SalesDocumentPaymentDetails,
  selectedBankAccount?: SalesDocumentBankAccount | null
) => {
  if (method === "Bank Transfer" && selectedBankAccount) {
    return [
      selectedBankAccount.bankName,
      selectedBankAccount.accountName,
      selectedBankAccount.accountNumber,
      selectedBankAccount.branch ? `Branch: ${selectedBankAccount.branch}` : "",
      selectedBankAccount.swiftCode ? `SWIFT: ${selectedBankAccount.swiftCode}` : "",
      selectedBankAccount.promptPayId ? `PromptPay: ${selectedBankAccount.promptPayId}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (method === "Bank Transfer") {
    return [details.bankAccount, details.accountName, details.accountNumber].filter(Boolean).join("\n");
  }

  if (method === "Cheque") {
    return [
      details.chequeNumber ? `Cheque: ${details.chequeNumber}` : "",
      details.chequeBankName,
      details.chequeDate,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (method === "Credit Card") {
    return [details.cardType, details.approvalCode ? `Approval: ${details.approvalCode}` : ""]
      .filter(Boolean)
      .join("\n");
  }

  if (method === "PromptPay") return details.promptPayId || selectedBankAccount?.promptPayId || "";
  if (method === "Other") return details.otherNote || "";
  return method;
};


import type { TaxMode } from "@/lib/domain/enums";
import type { AmountSummary, DocumentLine, TaxRateGroup } from "@/lib/domain/models";

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const sanitizeWholePercent = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.min(Math.max(Math.trunc(numeric), 0), 100);
};

export const calculateLineSubtotal = (qty: number, price: number) =>
  roundMoney((qty || 0) * (price || 0));

export const calculateLineDiscount = (
  qty: number,
  price: number,
  discount = 0,
  asPercent = true
) => {
  const subtotal = calculateLineSubtotal(qty, price);
  if (subtotal <= 0) {
    return 0;
  }
  if (asPercent) {
    return roundMoney(subtotal * ((discount || 0) / 100));
  }
  return roundMoney(Math.min(discount || 0, subtotal));
};

export const calculateVat = (
  amount: number,
  ratePercent: number,
  mode: TaxMode = "exclusive"
) => {
  const safeAmount = roundMoney(amount);
  const rate = sanitizeWholePercent(ratePercent) / 100;
  if (safeAmount <= 0 || rate <= 0 || mode === "exempt") {
    return { taxableBase: safeAmount, taxAmount: 0 };
  }
  if (mode === "inclusive") {
    const taxableBase = roundMoney(safeAmount / (1 + rate));
    return { taxableBase, taxAmount: roundMoney(safeAmount - taxableBase) };
  }
  return { taxableBase: safeAmount, taxAmount: roundMoney(safeAmount * rate) };
};

const resolveLineBase = (
  line: Partial<DocumentLine> & { qty: number; price: number },
  perLineDiscount = true
) => {
  const rawSubtotal = calculateLineSubtotal(line.qty || 0, line.price || 0);
  const discount = perLineDiscount
    ? calculateLineDiscount(line.qty || 0, line.price || 0, line.discount || 0, true)
    : 0;
  return roundMoney(Math.max(rawSubtotal - discount, 0));
};

const addRateGroup = (
  groups: Map<number, TaxRateGroup>,
  rate: number,
  taxableBase: number,
  taxAmount: number
) => {
  const existing = groups.get(rate) ?? { rate, taxableBase: 0, taxAmount: 0 };
  groups.set(rate, {
    rate,
    taxableBase: roundMoney(existing.taxableBase + taxableBase),
    taxAmount: roundMoney(existing.taxAmount + taxAmount),
  });
};

const sortGroups = (groups: Map<number, TaxRateGroup>) =>
  Array.from(groups.values()).sort((left, right) => right.rate - left.rate);

export const groupVatTotalsByRate = (
  lines: Array<Partial<DocumentLine> & { qty: number; price: number }>,
  {
    defaultTaxRate = 0,
    taxMode = "exclusive" as TaxMode,
    vatEnabled = true,
    includeZeroRate = false,
    perLineDiscount = true,
  } = {}
): TaxRateGroup[] => {
  const groups = new Map<number, TaxRateGroup>();

  for (const line of lines) {
    const taxableInput = resolveLineBase(line, perLineDiscount);
    const rate = vatEnabled ? sanitizeWholePercent(line.vatRate ?? line.tax ?? defaultTaxRate) : 0;
    const vat = calculateVat(taxableInput, rate, taxMode);
    if (rate > 0 || includeZeroRate) {
      addRateGroup(groups, rate, vat.taxableBase, vat.taxAmount);
    }
  }

  return sortGroups(groups);
};

export const groupWithholdingTotalsByRate = (
  lines: Array<Partial<DocumentLine> & { qty: number; price: number }>,
  {
    defaultWithholdingRate = 0,
    perLineWithholding = false,
    includeZeroRate = false,
    perLineDiscount = true,
  } = {}
): TaxRateGroup[] => {
  const groups = new Map<number, TaxRateGroup>();

  for (const line of lines) {
    const taxableBase = resolveLineBase(line, perLineDiscount);
    const rawRate = perLineWithholding ? line.withholdingRate : defaultWithholdingRate;
    const rate = sanitizeWholePercent(rawRate ?? 0);
    const taxAmount = roundMoney(taxableBase * (rate / 100));
    if (rate > 0 || includeZeroRate) {
      addRateGroup(groups, rate, taxableBase, taxAmount);
    }
  }

  return sortGroups(groups);
};

export const calculateDocumentTotals = (
  lines: Array<Partial<DocumentLine> & { qty: number; price: number }>,
  {
    defaultTaxRate = 0,
    taxMode = "exclusive" as TaxMode,
    withholdingRate = 0,
    vatEnabled = true,
    perLineWithholding = false,
    perLineDiscount = true,
  } = {}
): AmountSummary => {
  let subtotal = 0;
  let discountAmount = 0;
  let taxAmount = 0;

  for (const line of lines) {
    const rawSubtotal = calculateLineSubtotal(line.qty || 0, line.price || 0);
    const lineDiscount = perLineDiscount
      ? calculateLineDiscount(line.qty || 0, line.price || 0, line.discount || 0, true)
      : 0;
    const lineBase = roundMoney(rawSubtotal - lineDiscount);
    const lineVat = vatEnabled
      ? calculateVat(lineBase, line.vatRate ?? line.tax ?? defaultTaxRate, taxMode)
      : calculateVat(lineBase, 0, taxMode);
    subtotal = roundMoney(subtotal + lineVat.taxableBase);
    discountAmount = roundMoney(discountAmount + lineDiscount);
    taxAmount = roundMoney(taxAmount + lineVat.taxAmount);
  }

  const vatGroups = groupVatTotalsByRate(lines, {
    defaultTaxRate,
    taxMode,
    vatEnabled,
    perLineDiscount,
  });
  const withholdingGroups = groupWithholdingTotalsByRate(lines, {
    defaultWithholdingRate: withholdingRate,
    perLineWithholding,
    perLineDiscount,
  });
  const withholdingAmount = roundMoney(
    withholdingGroups.reduce((sum, group) => sum + group.taxAmount, 0)
  );
  const grandTotal = roundMoney(subtotal + taxAmount);
  const remainingDue = roundMoney(grandTotal - withholdingAmount);
  return {
    subtotal,
    discountAmount,
    taxAmount,
    withholdingAmount,
    totalWithholdingTax: withholdingAmount,
    grandTotal,
    remainingDue,
    total: remainingDue,
    vatGroups,
    withholdingGroups,
  };
};

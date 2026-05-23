import type { CurrencySettings } from "@/lib/types";

export const formatMoney = (amount: number, currency = "THB") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "THB",
    currencyDisplay: "code",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));

export const getEnabledCurrencies = (settings?: CurrencySettings) => {
  const base = settings?.baseCurrency || "THB";
  const enabled = settings?.enabledCurrencies?.length ? settings.enabledCurrencies : [base];
  return Array.from(new Set([base, ...enabled])).filter(Boolean);
};

export const resolveExchangeRate = (settings: CurrencySettings | undefined, currency: string) => {
  if (!settings) {
    return currency === "THB" ? 1 : 1;
  }

  if (currency === settings.baseCurrency) {
    return 1;
  }

  return settings.manualRates?.[currency] ?? settings.documentSnapshot.fallbackRate ?? settings.defaultExchangeRate ?? 1;
};

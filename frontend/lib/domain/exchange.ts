import type { Currency } from "@/lib/domain/models";

export const snapshotExchangeRate = ({
  code,
  baseCurrency,
  exchangeRate,
  snapshotDate,
}: {
  code: string;
  baseCurrency: string;
  exchangeRate?: number;
  snapshotDate?: string;
}): Currency => ({
  code,
  base: code === baseCurrency,
  exchangeRate: code === baseCurrency ? 1 : exchangeRate ?? 1,
  snapshotDate: snapshotDate ?? new Date().toISOString().slice(0, 10),
});

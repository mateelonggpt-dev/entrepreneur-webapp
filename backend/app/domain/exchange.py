from __future__ import annotations

from datetime import datetime


def snapshot_exchange_rate(
    *,
    currency: str,
    base_currency: str,
    rate: float | None = None,
    snapshot_date: str | None = None,
) -> dict[str, str | float]:
    resolved_date = snapshot_date or datetime.now().strftime("%Y-%m-%d")
    resolved_rate = 1.0 if currency == base_currency else float(rate or 1.0)
    return {
        "currency": currency,
        "baseCurrency": base_currency,
        "exchangeRate": resolved_rate,
        "snapshotDate": resolved_date,
    }

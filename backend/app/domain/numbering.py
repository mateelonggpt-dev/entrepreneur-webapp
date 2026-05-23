from __future__ import annotations

from datetime import datetime
from typing import Any


def build_document_number(
    *,
    counters: dict[str, Any],
    counter_key: str,
    prefix: str,
    start_at: int = 1,
    date_text: str | None = None,
    mode: str = "yearly_reset",
    serial_digits: int = 4,
) -> str:
    now = datetime.now()
    year = now.strftime("%Y")
    month = now.strftime("%m")
    if date_text:
        try:
            parsed = datetime.fromisoformat(date_text)
            year = parsed.strftime("%Y")
            month = parsed.strftime("%m")
        except ValueError:
            pass

    counter_bucket = f"{counter_key}:{year}-{month}"
    current = int(counters.get(counter_bucket, max(start_at - 1, 0))) + 1
    counters[counter_bucket] = current

    return f"{prefix}-{year}-{month}{current:05d}"

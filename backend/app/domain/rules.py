from __future__ import annotations

from datetime import date, datetime


def reset_required_before_delete(*, status: str, linked_count: int = 0, attachment_count: int = 0) -> bool:
    normalized_status = str(status or "").lower()
    return normalized_status not in {"draft", "void", "cancelled"} or linked_count > 0 or attachment_count > 0


def editable_after_payment(*, status: str, lock_after_payment: bool) -> bool:
    normalized_status = str(status or "").lower()
    if not lock_after_payment:
        return normalized_status not in {"void", "cancelled"}
    return normalized_status not in {"paid", "partial", "approved", "void", "cancelled"}


def validate_cheque_date(
    cheque_date_text: str | None,
    *,
    payment_date_text: str | None = None,
    deposit_date_text: str | None = None,
    cut_date_text: str | None = None,
    cleared_date_text: str | None = None,
    allow_future_date: bool = True,
) -> tuple[bool, str]:
    if not cheque_date_text:
        return False, "Cheque date is required."

    try:
        cheque_date = datetime.fromisoformat(cheque_date_text).date()
    except ValueError:
        return False, "Cheque date must be a valid ISO date."

    if payment_date_text:
        try:
            payment_date = datetime.fromisoformat(payment_date_text).date()
        except ValueError:
            payment_date = None
        if payment_date and cheque_date < payment_date:
            return False, "Cheque date cannot be before the payment date."

    for label, raw_value in (
        ("Cheque cut date", cut_date_text),
        ("Cheque deposit date", deposit_date_text),
        ("Cheque cleared date", cleared_date_text),
    ):
        if not raw_value:
            continue
        try:
            parsed = datetime.fromisoformat(raw_value).date()
        except ValueError:
            return False, f"{label} must be a valid ISO date."
        if parsed < cheque_date:
            return False, f"{label} cannot be before the cheque date."

    if not allow_future_date and cheque_date > date.today():
        return False, "Cheque date cannot be in the future."

    return True, ""


def resolve_stock_deduction_policy(configured_timing: str, *, document_type: str, status: str) -> bool:
    normalized_timing = str(configured_timing or "").lower()
    normalized_type = str(document_type or "").lower()
    normalized_status = str(status or "").lower()

    if normalized_type not in {"invoice", "receipt", "purchase_order", "receive"}:
        return False
    if normalized_status in {"draft", "cancelled", "void"}:
        return False
    if normalized_timing == "delivery":
        return normalized_type in {"receive"}
    return normalized_type in {"invoice"}

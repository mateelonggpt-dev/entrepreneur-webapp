from __future__ import annotations

from typing import Any

from .enums import AccountingEventType, DocumentType, TaxMode
from .models import AccountingEvent, AmountSummary, TaxSummary
from .totals import round_money


def build_accounting_event(
    *,
    source_document_id: str,
    source_type: DocumentType,
    event_type: AccountingEventType,
    event_date: str,
    subtotal: float,
    tax_amount: float,
    total_amount: float,
    linked_document_ids: list[str] | tuple[str, ...] = (),
    linked_project_id: str = "",
    linked_contact_id: str = "",
    linked_account_id: str = "",
    journal_payload: list[dict[str, Any]] | tuple[dict[str, Any], ...] = (),
    tax_mode: TaxMode = TaxMode.EXCLUSIVE,
    withholding_rate: float = 0.0,
    withholding_amount: float = 0.0,
) -> AccountingEvent:
    taxable_base = round_money(subtotal)
    tax_value = round_money(tax_amount)
    total_value = round_money(total_amount)
    return AccountingEvent(
        source_document_id=source_document_id,
        source_type=source_type,
        event_type=event_type,
        event_date=event_date,
        amount_summary=AmountSummary(
            subtotal=taxable_base,
            discount_amount=0.0,
            tax_amount=tax_value,
            withholding_amount=round_money(withholding_amount),
            total=total_value,
        ),
        tax_summary=TaxSummary(
            mode=tax_mode,
            rate=round_money((tax_value / taxable_base) * 100) if taxable_base else 0.0,
            taxable_base=taxable_base,
            tax_amount=tax_value,
            withholding_rate=withholding_rate,
            withholding_amount=round_money(withholding_amount),
        ),
        linked_project_id=linked_project_id,
        linked_contact_id=linked_contact_id,
        linked_account_id=linked_account_id,
        linked_document_ids=tuple(linked_document_ids),
        journal_payload=tuple(journal_payload),
    )

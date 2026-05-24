from __future__ import annotations

from datetime import date, datetime
from typing import Any


GOODS_TAX_POINT_EVENTS = [
    "delivery",
    "ownership_transfer",
    "payment_received",
    "tax_invoice_issued",
]

SERVICE_TAX_POINT_EVENTS = [
    "payment_received",
    "tax_invoice_issued",
    "service_completed",
]

SALES_DOCUMENT_KINDS = {
    "quotation",
    "delivery_note",
    "invoice",
    "tax_invoice",
    "receipt",
    "cash_sale",
    "short_tax_invoice",
    "deposit_invoice",
    "prepayment_tax_invoice",
    "billing_note",
    "combined_billing_note",
    "combined_receipt",
    "credit_note",
    "debit_note",
}


def _parse_date(value: Any) -> date | None:
    if isinstance(value, date):
        return value
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text[:10]).date()
    except ValueError:
        return None


def _format_date(value: date | None) -> str | None:
    return value.isoformat() if value else None


def _normalize_kind(value: Any) -> str:
    return str(value or "").strip().lower().replace("-", "_")


def _document_kinds(record: dict[str, Any]) -> set[str]:
    kinds = {_normalize_kind(record.get("kind"))}
    kinds.update(_normalize_kind(item) for item in record.get("documentTypes", []) or [])
    if record.get("isTaxInvoice") or record.get("invoiceTaxType") == "tax":
        kinds.add("tax_invoice")
    return {item for item in kinds if item}


def _company_vat_registered(company_settings: dict[str, Any]) -> bool:
    company = company_settings.get("company", {}) if isinstance(company_settings.get("company"), dict) else {}
    taxes = company_settings.get("taxes", {}) if isinstance(company_settings.get("taxes"), dict) else {}
    if company.get("vatRegistrationMode") == "not_registered":
        return False
    return bool(taxes.get("vatRegistered", company_settings.get("vatRegistered", True)))


def _has_vat(record: dict[str, Any]) -> bool:
    if float(record.get("taxAmount", 0) or 0) > 0:
        return True
    if float(record.get("vatRate", 0) or 0) > 0 and bool(record.get("vatEnabled", True)):
        return True
    for group in record.get("vatGroups", []) or []:
        if float(group.get("taxAmount", 0) or 0) > 0 or float(group.get("rate", 0) or 0) > 0:
            return True
    return False


def get_vat_reporting_period(value: Any) -> str | None:
    parsed = _parse_date(value)
    return parsed.strftime("%Y-%m") if parsed else None


def determine_earliest_applicable_tax_point(
    *,
    transaction_type: str | None,
    document_kind: str | None,
    event_dates: dict[str, Any],
    policy: dict[str, Any] | None = None,
) -> dict[str, Any]:
    policy = policy or {}
    kind = _normalize_kind(document_kind)
    configured_events = policy.get("goodsEvents" if transaction_type == "goods" else "serviceEvents")
    default_events = GOODS_TAX_POINT_EVENTS if transaction_type != "service" else SERVICE_TAX_POINT_EVENTS
    events = [str(item) for item in configured_events] if isinstance(configured_events, list) and configured_events else default_events
    candidates: list[tuple[date, str]] = []
    for event in events:
        parsed = _parse_date(event_dates.get(event))
        if parsed:
            candidates.append((parsed, event))
    if not candidates and kind in {"tax_invoice", "short_tax_invoice", "cash_sale"}:
        parsed = _parse_date(event_dates.get("tax_invoice_issued") or event_dates.get("issue"))
        if parsed:
            candidates.append((parsed, "tax_invoice_issued"))
    if not candidates:
        return {"taxPointDate": None, "taxPointReason": None, "sourceEvents": {}}
    tax_point_date, reason = sorted(candidates, key=lambda item: item[0])[0]
    return {
        "taxPointDate": _format_date(tax_point_date),
        "taxPointReason": reason,
        "sourceEvents": {event: _format_date(_parse_date(value)) for event, value in event_dates.items() if _parse_date(value)},
    }


def requires_tax_invoice(record: dict[str, Any]) -> bool:
    kinds = _document_kinds(record)
    if kinds.intersection({"tax_invoice", "short_tax_invoice", "cash_sale"}):
        return True
    return _has_vat(record) and bool(record.get("taxPointDate"))


def _transaction_type(record: dict[str, Any]) -> str:
    explicit = _normalize_kind(record.get("transactionType"))
    if explicit in {"goods", "service"}:
        return explicit
    product_types = {_normalize_kind(line.get("productType") or line.get("unit")) for line in record.get("lines", []) or []}
    if product_types and product_types.issubset({"service"}):
        return "service"
    return "goods"


def determine_sales_tax_point(record: dict[str, Any], company_settings: dict[str, Any]) -> dict[str, Any]:
    kinds = _document_kinds(record)
    transaction_type = _transaction_type(record)
    event_dates = {
        "delivery": record.get("deliveryDate") or (record.get("date") if "delivery_note" in kinds else None),
        "ownership_transfer": record.get("ownershipTransferDate"),
        "payment_received": record.get("paymentDate") or (record.get("date") if kinds.intersection({"receipt", "cash_sale", "deposit_invoice", "prepayment_tax_invoice"}) else None),
        "tax_invoice_issued": record.get("date") if kinds.intersection({"tax_invoice", "short_tax_invoice", "cash_sale"}) else None,
        "service_completed": record.get("serviceCompletedDate"),
    }
    tax_point = determine_earliest_applicable_tax_point(
        transaction_type=transaction_type,
        document_kind=next(iter(kinds), ""),
        event_dates=event_dates,
        policy=company_settings.get("taxPointPolicy", {}),
    )
    tax_point["transactionType"] = transaction_type
    tax_point["taxInvoiceRequired"] = bool(_has_vat(record) and tax_point.get("taxPointDate"))
    tax_point["vatReportingPeriod"] = get_vat_reporting_period(tax_point.get("taxPointDate"))
    return tax_point


def determine_purchase_tax_point(record: dict[str, Any], company_settings: dict[str, Any]) -> dict[str, Any]:
    kinds = _document_kinds(record)
    event_dates = {
        "delivery": record.get("deliveryDate") or (record.get("date") if kinds.intersection({"goods_receive", "receive_inventory", "receive"}) else None),
        "ownership_transfer": record.get("ownershipTransferDate"),
        "payment_received": record.get("paymentDate"),
        "tax_invoice_issued": record.get("date") if kinds.intersection({"vendor_invoice", "expense"}) and _has_vat(record) else None,
        "service_completed": record.get("serviceCompletedDate"),
    }
    tax_point = determine_earliest_applicable_tax_point(
        transaction_type=_transaction_type(record),
        document_kind=next(iter(kinds), ""),
        event_dates=event_dates,
        policy=company_settings.get("taxPointPolicy", {}),
    )
    tax_point["transactionType"] = _transaction_type(record)
    tax_point["taxInvoiceRequired"] = bool(_has_vat(record) and tax_point.get("taxPointDate"))
    tax_point["vatReportingPeriod"] = get_vat_reporting_period(tax_point.get("taxPointDate"))
    return tax_point


def build_tax_guidance_messages(record: dict[str, Any], company_settings: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    company_settings = company_settings or {}
    messages: list[dict[str, Any]] = []
    if not _company_vat_registered(company_settings):
        messages.append({"severity": "warning", "messageKey": "taxGuidance.companyNotVatRegistered"})
    reason = record.get("taxPointReason")
    if reason == "delivery":
        messages.append({"severity": "warning", "messageKey": "taxGuidance.deliveryMayCreateTaxPoint"})
    if reason == "payment_received":
        messages.append({"severity": "warning", "messageKey": "taxGuidance.paymentBeforeDelivery"})
    if record.get("taxInvoiceRequired"):
        messages.append({"severity": "info", "messageKey": "taxGuidance.taxInvoiceRecommended"})
    return messages


def build_vat_audit_snapshot(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "kind": next(iter(_document_kinds(record)), ""),
        "documentTypes": sorted(_document_kinds(record)),
        "taxAmount": float(record.get("taxAmount", 0) or 0),
        "vatGroups": record.get("vatGroups", []) or [],
        "taxPointDate": record.get("taxPointDate"),
        "taxPointReason": record.get("taxPointReason"),
        "vatReportingPeriod": record.get("vatReportingPeriod"),
        "taxInvoiceRequired": bool(record.get("taxInvoiceRequired")),
        "sourceEvents": record.get("taxPointSourceEvents", {}) or {},
    }


def apply_tax_point_policy(record: dict[str, Any], company_settings: dict[str, Any], *, sales: bool | None = None) -> dict[str, Any]:
    kinds = _document_kinds(record)
    is_sales = bool(kinds.intersection(SALES_DOCUMENT_KINDS)) if sales is None else sales
    tax_point = determine_sales_tax_point(record, company_settings) if is_sales else determine_purchase_tax_point(record, company_settings)
    record["transactionType"] = record.get("transactionType") or tax_point.get("transactionType")
    record["taxPointDate"] = record.get("taxPointDate") or tax_point.get("taxPointDate")
    record["taxPointReason"] = record.get("taxPointReason") or tax_point.get("taxPointReason")
    record["taxInvoiceRequired"] = bool(record.get("taxInvoiceRequired") or tax_point.get("taxInvoiceRequired"))
    record["vatReportingPeriod"] = record.get("vatReportingPeriod") or tax_point.get("vatReportingPeriod")
    record["taxPointSourceEvents"] = record.get("taxPointSourceEvents") or tax_point.get("sourceEvents") or {}
    record["taxGuidance"] = build_tax_guidance_messages(record, company_settings)
    record["vatAuditSnapshot"] = build_vat_audit_snapshot(record)
    return record

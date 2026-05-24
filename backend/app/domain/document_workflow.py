from __future__ import annotations

from copy import deepcopy
from datetime import datetime
from enum import Enum
from typing import Any


class DocumentKind(str, Enum):
    QUOTATION = "quotation"
    DELIVERY_NOTE = "delivery_note"
    INVOICE = "invoice"
    TAX_INVOICE = "tax_invoice"
    RECEIPT = "receipt"
    CASH_SALE = "cash_sale"
    SHORT_TAX_INVOICE = "short_tax_invoice"
    DEPOSIT_INVOICE = "deposit_invoice"
    PREPAYMENT_TAX_INVOICE = "prepayment_tax_invoice"
    BILLING_NOTE = "billing_note"
    COMBINED_BILLING_NOTE = "combined_billing_note"
    COMBINED_RECEIPT = "combined_receipt"
    CREDIT_NOTE = "credit_note"
    DEBIT_NOTE = "debit_note"
    PURCHASE_ORDER = "purchase_order"
    GOODS_RECEIVE = "goods_receive"
    RECEIVE_INVENTORY = "receive_inventory"
    VENDOR_INVOICE = "vendor_invoice"
    EXPENSE = "expense"
    SUPPLIER_PAYMENT = "supplier_payment"
    ADVANCE_PAYMENT = "advance_payment"
    WITHHOLDING_TAX_CERTIFICATE = "withholding_tax_certificate"
    CREDIT_NOTE_FROM_VENDOR = "credit_note_from_vendor"
    DEBIT_NOTE_FROM_VENDOR = "debit_note_from_vendor"


class DocumentStatus(str, Enum):
    DRAFT = "draft"
    PENDING = "pending"
    APPROVED = "approved"
    SENT = "sent"
    PARTIAL = "partial"
    PAID = "paid"
    CANCELLED = "cancelled"
    VOID = "void"


class WorkflowMode(str, Enum):
    STRICT = "strict"
    GUIDED = "guided"
    FREE = "free"


class DocumentFlowEvent(str, Enum):
    CREATED = "created"
    CONVERTED = "converted"
    LINKED = "linked"
    OVERRIDDEN = "overridden"


class TaxPointReason(str, Enum):
    DELIVERY = "delivery"
    OWNERSHIP_TRANSFER = "ownership_transfer"
    PAYMENT_RECEIVED = "payment_received"
    TAX_INVOICE_ISSUED = "tax_invoice_issued"
    SERVICE_COMPLETED = "service_completed"


ALLOWED_TRANSITIONS: dict[str, list[str]] = {
    "quotation": [
        "delivery_note",
        "invoice",
        "tax_invoice",
        "deposit_invoice",
        "prepayment_tax_invoice",
        "billing_note",
        "receipt",
    ],
    "delivery_note": ["invoice", "tax_invoice", "receipt"],
    "invoice": ["receipt", "tax_invoice", "credit_note", "debit_note", "billing_note"],
    "tax_invoice": ["receipt", "credit_note", "debit_note"],
    "billing_note": ["receipt", "combined_receipt"],
    "receipt": ["credit_note"],
    "purchase_order": ["goods_receive", "receive_inventory", "vendor_invoice", "expense", "supplier_payment", "advance_payment"],
    "goods_receive": ["vendor_invoice", "expense", "supplier_payment", "advance_payment"],
    "receive_inventory": ["vendor_invoice", "expense", "supplier_payment", "advance_payment"],
    "vendor_invoice": ["supplier_payment", "withholding_tax_certificate", "credit_note_from_vendor", "debit_note_from_vendor"],
    "expense": ["supplier_payment", "advance_payment", "withholding_tax_certificate"],
    "advance_payment": ["vendor_invoice", "expense", "withholding_tax_certificate"],
    "supplier_payment": ["withholding_tax_certificate"],
}


CANONICAL_KIND_ALIASES = {
    "billing": "billing_note",
    "combined_billing": "combined_billing_note",
    "receive": "goods_receive",
    "withholding_tax": "withholding_tax_certificate",
    "payment": "supplier_payment",
    "vendor_payment": "supplier_payment",
    "advance_payment": "advance_payment",
    "purchase-order": "purchase_order",
    "credit-note": "credit_note",
    "debit-note": "debit_note",
}


LABEL_KEYS = {
    "quotation": "documentActions.createQuotation",
    "delivery_note": "documentActions.createDeliveryNote",
    "invoice": "documentActions.createInvoice",
    "tax_invoice": "documentActions.createTaxInvoice",
    "receipt": "documentActions.createReceipt",
    "billing_note": "documentActions.createBillingNote",
    "combined_receipt": "documentActions.createReceipt",
    "credit_note": "documentActions.createCreditNote",
    "debit_note": "documentActions.createDebitNote",
    "deposit_invoice": "documentActions.recordDeposit",
    "prepayment_tax_invoice": "documentActions.recordDeposit",
    "supplier_payment": "documentActions.payVendor",
    "advance_payment": "expenseCreate.documentTypes.advancePayment",
    "withholding_tax_certificate": "documentActions.createWhtCertificate",
    "goods_receive": "documentActions.convertToDeliveryNote",
    "receive_inventory": "documentActions.convertToDeliveryNote",
    "vendor_invoice": "documentActions.createInvoice",
    "expense": "common.expense",
}


def canonical_document_kind(kind: str | None) -> str:
    normalized = str(kind or "").strip().lower().replace("-", "_")
    return CANONICAL_KIND_ALIASES.get(normalized, normalized)


def infer_document_kind(document: dict[str, Any], fallback_kind: str | None = None) -> str:
    document_types = [canonical_document_kind(item) for item in document.get("documentTypes", []) or []]
    if "tax_invoice" in document_types or document.get("isTaxInvoice"):
        return "tax_invoice"
    if "combined_receipt" in document_types:
        return "combined_receipt"
    if "combined_billing_note" in document_types:
        return "combined_billing_note"
    if document_types:
        return document_types[0]
    return canonical_document_kind(document.get("kind") or fallback_kind)


def get_allowed_next_kinds(kind: str) -> list[str]:
    return list(ALLOWED_TRANSITIONS.get(canonical_document_kind(kind), []))


def validate_document_transition(source_kind: str, target_kind: str, mode: str = "guided", override_reason: str | None = None) -> dict[str, Any]:
    source = canonical_document_kind(source_kind)
    target = canonical_document_kind(target_kind)
    workflow_mode = mode if mode in {item.value for item in WorkflowMode} else WorkflowMode.GUIDED.value
    allowed = target in get_allowed_next_kinds(source)

    if allowed:
        return {"valid": True, "allowed": True, "severity": "info", "warning": None}

    warning = build_workflow_warning({"kind": source}, {"kind": target})
    if workflow_mode == WorkflowMode.STRICT.value:
        return {"valid": False, "allowed": False, "severity": "error", "warning": warning}
    if workflow_mode == WorkflowMode.GUIDED.value and not str(override_reason or "").strip():
        return {"valid": True, "allowed": False, "severity": "warning", "warning": warning, "requiresOverrideReason": True}
    return {"valid": True, "allowed": False, "severity": "warning", "warning": warning, "overrideReason": override_reason or ""}


def build_workflow_warning(source: dict[str, Any], target: dict[str, Any]) -> dict[str, Any]:
    return {
        "messageKey": "workflowWarnings.transitionNotStandard",
        "sourceKind": infer_document_kind(source),
        "targetKind": infer_document_kind(target),
    }


def calculate_payment_status(document: dict[str, Any]) -> str:
    summary = document.get("paymentSummary") if isinstance(document.get("paymentSummary"), dict) else {}
    amount = float(document.get("amount", 0) or 0)
    paid = float(document.get("amountPaid", summary.get("paid", 0)) or 0)
    due = float(document.get("amountDue", summary.get("remaining", max(amount - paid, 0))) or 0)
    if amount <= 0:
        return "unpaid"
    if due <= 0 or paid >= amount:
        return "paid"
    if paid > 0:
        return "partial"
    return "unpaid"


def calculate_delivery_status(document: dict[str, Any]) -> str:
    status = str(document.get("deliveryStatus") or "").strip()
    if status:
        return status
    kind = infer_document_kind(document)
    if kind in {"delivery_note", "goods_receive", "receive_inventory"}:
        return "delivered"
    if document.get("deliveryDate"):
        return "delivered"
    return "not_delivered"


def calculate_document_status(document: dict[str, Any]) -> str:
    status = str(document.get("status") or DocumentStatus.DRAFT.value)
    payment_status = calculate_payment_status(document)
    if payment_status == "paid" and infer_document_kind(document) in {"invoice", "tax_invoice", "receipt", "expense", "vendor_invoice"}:
        return "paid"
    if payment_status == "partial":
        return "partial"
    return status


def _workflow_year(document: dict[str, Any]) -> str:
    date_text = str(document.get("issueDate") or document.get("date") or "")
    return date_text[:4] if len(date_text) >= 4 else datetime.now().strftime("%Y")


def normalize_workflow_fields(document: dict[str, Any], *, kind: str | None = None, source: dict[str, Any] | None = None) -> dict[str, Any]:
    record = document
    inferred_kind = infer_document_kind(record, kind)
    record["kind"] = inferred_kind
    record.setdefault("workflowId", (source or {}).get("workflowId") or record.get("workflowSourceId") or f"WF-{_workflow_year(record)}-{record.get('id', 'DRAFT')}")
    record.setdefault("sourceDocumentIds", [])
    record.setdefault("linkedDocumentIds", [])
    record.setdefault("convertedFromId", record.get("sourceDocumentId") or None)
    record.setdefault("convertedToIds", [])
    record.setdefault("workflowMode", "guided")
    record.setdefault("overrideReason", None)
    amount = float(record.get("amount", 0) or 0)
    summary = record.get("paymentSummary") if isinstance(record.get("paymentSummary"), dict) else {}
    amount_paid = float(record.get("amountPaid", summary.get("paid", 0)) or 0)
    amount_due = float(record.get("amountDue", summary.get("remaining", max(amount - amount_paid, 0))) or 0)
    record["amountPaid"] = round(amount_paid, 2)
    record["amountDue"] = round(max(amount_due, 0), 2)
    record.setdefault("withholdingAmount", float(record.get("totalWithholdingTax", 0) or 0))
    record["paymentStatus"] = calculate_payment_status(record)
    record["deliveryStatus"] = calculate_delivery_status(record)
    return record


def link_documents(source: dict[str, Any], target: dict[str, Any], relation_type: str = "linked") -> tuple[dict[str, Any], dict[str, Any]]:
    source.setdefault("linkedDocumentIds", [])
    target.setdefault("linkedDocumentIds", [])
    if target.get("id") and target["id"] not in source["linkedDocumentIds"]:
        source["linkedDocumentIds"].append(target["id"])
    if source.get("id") and source["id"] not in target["linkedDocumentIds"]:
        target["linkedDocumentIds"].append(source["id"])
    if source.get("id"):
        target.setdefault("sourceDocumentIds", [])
        if source["id"] not in target["sourceDocumentIds"]:
            target["sourceDocumentIds"].append(source["id"])
    target.setdefault("workflowLinks", []).append(
        {
            "sourceDocumentId": source.get("id"),
            "targetDocumentId": target.get("id"),
            "relationType": relation_type,
        }
    )
    return source, target


def _action_type(target_kind: str) -> str:
    return f"create_{target_kind}"


def get_next_document_actions(document: dict[str, Any], db: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    kind = infer_document_kind(document)
    actions: list[dict[str, Any]] = []
    for target_kind in get_allowed_next_kinds(kind):
        label_key = LABEL_KEYS.get(target_kind, f"documentActions.{target_kind}")
        action = {
            "type": _action_type(target_kind),
            "labelKey": label_key,
            "targetKind": target_kind,
            "recommended": target_kind in {"delivery_note", "invoice", "tax_invoice", "receipt", "supplier_payment"},
            "requiresReference": True,
        }
        if target_kind in {"tax_invoice", "delivery_note", "prepayment_tax_invoice"}:
            action["warningKey"] = "taxWarnings.taxPointMayBeRequired"
        actions.append(action)
    return actions


def workflow_rules_payload() -> dict[str, Any]:
    return {
        "workflowModes": [item.value for item in WorkflowMode],
        "allowedTransitions": deepcopy(ALLOWED_TRANSITIONS),
        "defaultMode": WorkflowMode.GUIDED.value,
    }

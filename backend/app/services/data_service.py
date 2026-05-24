from __future__ import annotations

import csv
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any

from werkzeug.datastructures import FileStorage

from ..domain import (
    PaymentStatus,
    TaxMode,
    build_document_number,
    build_linked_document_graph,
    calculate_document_totals,
    resolve_stock_deduction_policy,
    round_money,
    sanitize_whole_percent,
    snapshot_exchange_rate,
    validate_cheque_date,
)
from ..domain.document_workflow import (
    canonical_document_kind,
    get_next_document_actions as build_next_document_actions,
    link_documents as apply_workflow_link,
    normalize_workflow_fields,
    validate_document_transition,
    workflow_rules_payload,
)
from ..domain.tax_policy import apply_tax_point_policy
from .accounting_policy import (
    SETTINGS_SECTIONS,
    build_policy_snapshot,
    get_setting_defaults,
    merge_settings_section,
)
from .import_service import (
    build_template_rows,
    preview_import_file,
    revalidate_import_rows,
)
from .ledger_service import (
    REPORT_GROUPS,
    build_account_movement_rows,
    build_accounting_events,
    build_accounting_overview,
    build_project_profitability_rows,
    build_report_rows,
)
from .image_pdf_service import generate_pdf_from_preview_images
from .pdf_service import generate_document_pdf
from .storage_service import (
    build_generated_path,
    clone_seed,
    load_database,
    mutate_database,
    next_counter,
    resolve_storage_path,
    save_upload,
)


DOCUMENT_CONFIG = {
    "quotation": {"key": "quotations", "prefix": "QT", "counter": "quotation", "start": 1},
    "invoice": {"key": "invoices", "prefix": "INV", "counter": "invoice", "start": 1},
    "receipt": {"key": "receipts", "prefix": "RE", "counter": "receipt", "start": 1},
    "billing": {"key": "billings", "prefix": "BL", "counter": "billing", "start": 1},
    "credit_note": {"key": "creditNotes", "prefix": "CN", "counter": "creditNote", "start": 1},
    "debit_note": {"key": "debitNotes", "prefix": "DN", "counter": "debitNote", "start": 1},
    "deposit": {"key": "deposits", "prefix": "INV", "counter": "deposit", "start": 1},
    "purchase_order": {"key": "purchaseOrders", "prefix": "PO", "counter": "purchaseOrder", "start": 1},
    "receive": {"key": "receives", "prefix": "RI", "counter": "receive", "start": 1},
    "expense": {"key": "expenses", "prefix": "EXP", "counter": "expense", "start": 1},
    "withholding_tax": {"key": "withholdingTaxDocuments", "prefix": "WHT", "counter": "withholdingTax", "start": 1},
}

DOCUMENT_COLLECTION_KEYS = tuple(config["key"] for config in DOCUMENT_CONFIG.values())

BRANDING_ASSET_FIELDS = {
    "logo": ("logoUrl", "logoPath", "logoContentType"),
    "stamp": ("stampUrl", "stampPath", "stampContentType"),
    "signature": ("signatureUrl", "signaturePath", "signatureContentType"),
}


SEED_DATABASE = {
    "counters": {
        "invoice": 143,
        "quotation": 418,
        "receipt": 418,
        "billing": 14,
        "creditNote": 6,
        "debitNote": 4,
        "deposit": 9,
        "purchaseOrder": 421,
        "receive": 142,
        "expense": 90,
        "payment": 1,
        "withholdingTax": 1,
        "attachment": 1,
        "export": 1,
        "customer": 6,
        "vendor": 4,
        "product": 1,
        "account": 1,
        "inventoryMovement": 1,
        "importBatch": 1,
        "project": 4,
        "financeMovement": 1,
    },
    "invoices": [
        {
            "id": "INV-2026-0142",
            "customer": "Bangkok Foods Co., Ltd.",
            "date": "2026-04-12",
            "due": "2026-04-26",
            "amount": 142800.0,
            "status": "paid",
            "currency": "THB",
            "paymentTerms": "Net 14",
            "reference": "PO-2026-0142",
            "notes": "Net 14 days. Bank transfer to Bangkok Bank 123-4-56789-0.",
            "projectId": "PRJ-001",
            "lines": [
                {"id": "1", "desc": "Accounting consulting", "qty": 24, "price": 2500, "tax": 7, "amount": 60000},
                {"id": "2", "desc": "Software license - Pro", "qty": 1, "price": 18000, "tax": 7, "amount": 18000},
                {"id": "3", "desc": "Custom report setup", "qty": 8, "price": 2500, "tax": 7, "amount": 20000},
                {"id": "4", "desc": "Premium support", "qty": 3, "price": 4800, "tax": 7, "amount": 14400},
            ],
            "attachments": [],
        },
        {
            "id": "INV-2026-0141",
            "customer": "Siam Digital Studio",
            "date": "2026-04-11",
            "due": "2026-04-25",
            "amount": 58500.0,
            "status": "sent",
            "currency": "THB",
            "paymentTerms": "Net 14",
            "reference": "SO-2026-0224",
            "notes": "Please settle by transfer.",
            "projectId": "PRJ-002",
            "lines": [
                {"id": "1", "desc": "Creative retainer", "qty": 1, "price": 50000, "tax": 7, "amount": 50000},
                {"id": "2", "desc": "Campaign reporting", "qty": 1, "price": 4672.9, "tax": 7, "amount": 4672.9},
            ],
            "attachments": [],
        },
        {"id": "INV-2026-0140", "customer": "Chiang Mai Crafts Ltd.", "date": "2026-04-10", "due": "2026-04-10", "amount": 27300.0, "status": "overdue", "currency": "THB", "paymentTerms": "Due on receipt", "reference": "", "notes": "", "lines": [], "attachments": []},
        {"id": "INV-2026-0139", "customer": "Phuket Resort Group", "date": "2026-04-09", "due": "2026-05-09", "amount": 312450.0, "status": "partial", "currency": "THB", "paymentTerms": "Net 30", "reference": "", "notes": "", "lines": [], "attachments": []},
        {"id": "INV-2026-0138", "customer": "Northern Logistics PCL", "date": "2026-04-08", "due": "2026-04-22", "amount": 89200.0, "status": "paid", "currency": "THB", "paymentTerms": "Net 14", "reference": "", "notes": "", "lines": [], "attachments": []},
        {"id": "INV-2026-0137", "customer": "Thai Coffee House", "date": "2026-04-07", "due": "2026-04-21", "amount": 14250.0, "status": "draft", "currency": "THB", "paymentTerms": "Net 14", "reference": "", "notes": "", "lines": [], "attachments": []},
        {"id": "INV-2026-0136", "customer": "Eastern Seaboard Mfg.", "date": "2026-04-05", "due": "2026-04-19", "amount": 458900.0, "status": "sent", "currency": "THB", "paymentTerms": "Net 14", "reference": "", "notes": "", "lines": [], "attachments": []},
        {"id": "INV-2026-0135", "customer": "Pattaya Hotels Group", "date": "2026-04-03", "due": "2026-04-17", "amount": 76500.0, "status": "paid", "currency": "THB", "paymentTerms": "Net 14", "reference": "", "notes": "", "lines": [], "attachments": []},
    ],
    "expenses": [
        {"id": "EXP-2026-0089", "vendor": "Office Plus Stationery", "category": "Office Supplies", "date": "2026-04-12", "amount": 4280.0, "status": "approved", "paymentMethod": "Bank transfer", "projectId": "PRJ-001", "attachments": []},
        {"id": "EXP-2026-0088", "vendor": "PEA - Provincial Electricity", "category": "Utilities", "date": "2026-04-10", "amount": 18500.0, "status": "approved", "paymentMethod": "Bank transfer", "projectId": "PRJ-002", "attachments": []},
        {"id": "EXP-2026-0087", "vendor": "True Corporation", "category": "Telecom", "date": "2026-04-09", "amount": 3200.0, "status": "pending", "paymentMethod": "Bank transfer", "attachments": []},
        {"id": "EXP-2026-0086", "vendor": "Grab Thailand", "category": "Travel", "date": "2026-04-08", "amount": 1850.0, "status": "approved", "paymentMethod": "Cash", "attachments": []},
        {"id": "EXP-2026-0085", "vendor": "AWS", "category": "Software", "date": "2026-04-05", "amount": 24500.0, "status": "approved", "paymentMethod": "Card", "attachments": []},
        {"id": "EXP-2026-0084", "vendor": "Bangkok Bank", "category": "Bank Fees", "date": "2026-04-03", "amount": 850.0, "status": "approved", "paymentMethod": "Bank transfer", "attachments": []},
    ],
    "quotations": [],
    "receipts": [],
    "billings": [],
    "creditNotes": [],
    "debitNotes": [],
    "deposits": [],
    "purchaseOrders": [],
    "receives": [],
    "payments": [],
    "withholdingTaxDocuments": [],
    "inventoryMovements": [],
    "financeMovements": [],
    "attachments": [],
    "customers": [
        {"id": "C-001", "name": "Bangkok Foods Co., Ltd.", "contact": "Khun Anchalee", "email": "ap@bangkokfoods.co.th", "phone": "02-123-4567", "balance": 0, "status": "active", "taxId": "0105557000111", "address": "คลองเตย กรุงเทพฯ"},
        {"id": "C-002", "name": "Siam Digital Studio", "contact": "Khun Pichai", "email": "billing@siamdigital.co", "phone": "02-234-5678", "balance": 58500, "status": "active", "taxId": "0105557000222", "address": "ลาดพร้าว กรุงเทพฯ"},
        {"id": "C-003", "name": "Chiang Mai Crafts Ltd.", "contact": "Khun Mali", "email": "mali@cmcrafts.com", "phone": "053-345-678", "balance": 27300, "status": "active", "taxId": "0505557000333", "address": "เมืองเชียงใหม่ เชียงใหม่"},
        {"id": "C-004", "name": "Phuket Resort Group", "contact": "Khun Damrong", "email": "ap@phuketresort.com", "phone": "076-456-789", "balance": 156225, "status": "active", "taxId": "0835557000444", "address": "เมืองภูเก็ต ภูเก็ต"},
        {"id": "C-005", "name": "Northern Logistics PCL", "contact": "Khun Surasak", "email": "finance@nlogistics.co.th", "phone": "02-567-8901", "balance": 0, "status": "active", "taxId": "0105557000555", "address": "บางนา กรุงเทพฯ"},
    ],
    "vendors": [
        {"id": "V-001", "name": "Northwood Office Supplies Co., Ltd.", "contact": "Khun Sasi", "email": "sales@northwood.co.th", "phone": "02-765-1100", "balance": 68536, "status": "active", "taxId": "0105558000111", "address": "บางพลี สมุทรปราการ"},
        {"id": "V-002", "name": "Office Plus Stationery", "contact": "Khun Nisa", "email": "ar@officeplus.co.th", "phone": "02-556-1200", "balance": 4280, "status": "active", "taxId": "0105558000222", "address": "ห้วยขวาง กรุงเทพฯ"},
        {"id": "V-003", "name": "PEA - Provincial Electricity", "contact": "Corporate Billing", "email": "billing@pea.co.th", "phone": "1129", "balance": 18500, "status": "active", "taxId": "0994000161650", "address": "ประเทศไทย"},
    ],
    "products": [
        {"sku": "SVC-CONS-01", "name": "Accounting Consulting (1h)", "type": "Service", "productType": "service", "price": 2500, "stock": None, "status": "active", "openingStockQty": 0, "openingCost": 0, "openingDate": "", "stockSummary": "Service item"},
        {"sku": "SW-LIC-PRO", "name": "Software License - Pro", "type": "Service", "productType": "non-stock", "price": 18000, "stock": None, "status": "active", "openingStockQty": 0, "openingCost": 0, "openingDate": "", "stockSummary": "Digital non-stock item"},
        {"sku": "GD-PKG-A", "name": "Premium Coffee Pack 500g", "type": "Stock Counted", "productType": "stock-counted", "price": 580, "stock": 248, "status": "active", "openingStockQty": 248, "openingCost": 330, "openingDate": "2026-01-01", "stockSummary": "248 on hand"},
        {"sku": "GD-PKG-B", "name": "Standard Coffee Pack 250g", "type": "Stock Counted", "productType": "stock-counted", "price": 290, "stock": 12, "status": "active", "openingStockQty": 24, "openingCost": 170, "openingDate": "2026-01-01", "stockSummary": "Low stock"},
        {"sku": "GD-MERCH-01", "name": "Branded Mug", "type": "Stock Counted", "productType": "stock-counted", "price": 350, "stock": 0, "status": "inactive", "openingStockQty": 40, "openingCost": 160, "openingDate": "2026-01-01", "stockSummary": "Out of stock"},
    ],
    "topCustomersChart": [
        {"name": "Bangkok Foods", "revenue": 542000},
        {"name": "Eastern Seaboard", "revenue": 458900},
        {"name": "Phuket Resort", "revenue": 312450},
        {"name": "Northern Logistics", "revenue": 189400},
        {"name": "Pattaya Hotels", "revenue": 152800},
    ],
    "cashFlow": [
        {"month": "Nov", "in": 820000, "out": 540000},
        {"month": "Dec", "in": 1120000, "out": 720000},
        {"month": "Jan", "in": 980000, "out": 610000},
        {"month": "Feb", "in": 1340000, "out": 820000},
        {"month": "Mar", "in": 1480000, "out": 910000},
        {"month": "Apr", "in": 1684500, "out": 952300},
    ],
    "recentActivity": [
        {"who": "Khun Anchalee", "what": "paid INV-2026-0142", "amount": 142800, "time": "2 minutes ago", "type": "paid"},
        {"who": "Somchai B.", "what": "created EXP-2026-0089", "amount": 4280, "time": "1 hour ago", "type": "expense"},
        {"who": "System", "what": "VAT P.P.30 reminder", "time": "3 hours ago", "type": "alert"},
        {"who": "Khun Pichai", "what": "viewed INV-2026-0141", "time": "5 hours ago", "type": "view"},
        {"who": "Niran W.", "what": "approved 3 expenses", "time": "yesterday", "type": "approve"},
        {"who": "System", "what": "Auto-reconciled 12 bank transactions", "time": "yesterday", "type": "system"},
    ],
    "financeAccounts": [
        {"name": "Bangkok Bank - Current", "number": "123-4-56789-0", "balance": 3120000, "primary": True, "accountType": "bank", "status": "active", "institution": "Bangkok Bank", "currency": "THB"},
        {"name": "SCB - Savings", "number": "789-0-12345-6", "balance": 980000, "accountType": "bank", "status": "active", "institution": "SCB", "currency": "THB"},
        {"name": "Krungsri - Business", "number": "456-7-89012-3", "balance": 110500, "accountType": "bank", "status": "active", "institution": "Krungsri", "currency": "THB"},
        {"name": "Petty Cash", "number": "Cash on hand", "balance": 12500, "accountType": "petty_cash", "status": "active", "institution": "Office", "currency": "THB"},
    ],
    "projects": [
        {"id": "PRJ-001", "code": "BKK-ROLL", "name": "Bangkok Foods Rollout", "status": "active", "customer": "Bangkok Foods Co., Ltd.", "description": "Retail channel accounting setup and stock reporting."},
        {"id": "PRJ-002", "code": "SDS-RET", "name": "Siam Digital Retainer", "status": "active", "customer": "Siam Digital Studio", "description": "Monthly accounting, tax, and reporting support."},
        {"id": "PRJ-003", "code": "OPS-INT", "name": "Internal Operations", "status": "active", "customer": "", "description": "Internal improvement work and operating expenses."},
    ],
    "reports": [
        {
            "cat": "Financial",
            "items": [
                {"name": "Profit & Loss", "desc": "Revenue, costs and net income", "icon": "TrendingUp"},
                {"name": "Balance Sheet", "desc": "Assets, liabilities and equity", "icon": "FileBarChart"},
                {"name": "Cash Flow Statement", "desc": "Operating, investing, financing", "icon": "Wallet"},
                {"name": "Trial Balance", "desc": "Account totals for the period", "icon": "BarChart3"},
            ],
        },
        {
            "cat": "Tax",
            "items": [
                {"name": "P.P.30 (VAT)", "desc": "Monthly VAT return summary", "icon": "Percent"},
                {"name": "P.N.D.3 / P.N.D.53", "desc": "Withholding tax filings", "icon": "Receipt"},
            ],
        },
        {
            "cat": "Operational",
            "items": [
                {"name": "Aging Receivables", "desc": "Outstanding invoices by bucket", "icon": "Receipt"},
                {"name": "Aging Payables", "desc": "Vendor bills by due bucket", "icon": "Wallet"},
                {"name": "Customer Statements", "desc": "Per-customer activity", "icon": "Users"},
                {"name": "Inventory Valuation", "desc": "Stock value and movements", "icon": "Package"},
            ],
        },
    ],
    "settings": {
        "company": {
            "name": "Siam Tech Co., Ltd.",
            "taxId": "0105561234567",
            "branch": "Head Office (00000)",
            "address": "123 Sukhumvit Rd., Klongtoey, Bangkok 10110",
            "phone": "02-123-4567",
            "email": "info@siamtech.co.th",
        },
        "users": get_setting_defaults("users"),
        "documents": get_setting_defaults("documents"),
        "taxes": get_setting_defaults("taxes"),
        "branding": get_setting_defaults("branding"),
        "numbering": get_setting_defaults("numbering"),
        "currency": get_setting_defaults("currency"),
        "integrations": get_setting_defaults("integrations"),
    },
}


def _seed_database() -> dict[str, Any]:
    return clone_seed(SEED_DATABASE)


def _humanize_product_type(product_type: str) -> str:
    mapping = {
        "service": "Service",
        "stock-counted": "Stock Counted",
        "non-stock": "Non-stock",
        "goods": "Stock Counted",
    }
    return mapping.get(product_type, product_type.title())


def _normalize_product_type(value: Any) -> str:
    normalized = str(value or "").strip().lower()
    aliases = {
        "goods": "stock-counted",
        "stock_counted": "stock-counted",
        "stock-counted": "stock-counted",
        "stock": "stock-counted",
        "service": "service",
        "services": "service",
        "non_stock": "non-stock",
        "non-stock": "non-stock",
        "digital": "non-stock",
    }
    return aliases.get(normalized, "service")


def _round_quantity(value: Any) -> float:
    return round(float(value or 0), 4)


def _display_quantity(value: float) -> int | float:
    if float(value).is_integer():
        return int(value)
    return value


def _validate_product_stock_fields(
    *,
    product_type: str,
    opening_stock_qty: Any,
    opening_cost: Any,
    opening_date: Any,
) -> None:
    normalized_type = _normalize_product_type(product_type)
    qty_text = str(opening_stock_qty if opening_stock_qty is not None else "").strip()
    cost_text = str(opening_cost if opening_cost is not None else "").strip()
    date_text = str(opening_date or "").strip()
    try:
        qty_value = None if qty_text in {"", "None", "null"} else float(qty_text)
        cost_value = None if cost_text in {"", "None", "null"} else float(cost_text)
    except ValueError as exc:
        raise ValueError("Opening qty and opening cost must be numeric.") from exc
    has_any_value = bool(date_text) or (qty_value not in {None, 0.0}) or (cost_value not in {None, 0.0})

    if normalized_type == "stock-counted":
        if not qty_text or not cost_text or not date_text:
            raise ValueError(
                "Stock-counted products require opening qty, opening cost, and opening date together."
            )
        if qty_value < 0 or cost_value < 0:
            raise ValueError("Opening qty and opening cost cannot be negative.")
        return

    if has_any_value:
        raise ValueError("Only stock-counted products can include opening stock fields.")


def _inventory_status_for_quantity(quantity: float, *, product_status: str = "active") -> str:
    if str(product_status or "").lower() == "inactive":
        return "inactive"
    if quantity < 0:
        return "negative_stock"
    if quantity == 0:
        return "out_of_stock"
    if quantity < 20:
        return "low_stock"
    return "in_stock"


def _inventory_summary_for_quantity(quantity: float, *, product_type: str, product_status: str = "active") -> str:
    normalized_type = _normalize_product_type(product_type)
    if normalized_type == "service":
        return "Service item"
    if normalized_type == "non-stock":
        return "Non-stock item"

    status = _inventory_status_for_quantity(quantity, product_status=product_status)
    if status == "inactive":
        return "Inactive stock item"
    if status == "negative_stock":
        return "Negative stock"
    if status == "out_of_stock":
        return "Out of stock"
    if status == "low_stock":
        return "Low stock"
    return f"{_display_quantity(quantity)} on hand"


def _normalize_inventory_movement(record: dict[str, Any]) -> dict[str, Any]:
    qty_value = _round_quantity(record.get("qty", 0))
    direction = str(record.get("direction", "in") or "in").strip().lower()
    if qty_value < 0:
        qty_value = abs(qty_value)
        direction = "out" if direction == "in" else "in"

    return {
        "id": str(record.get("id", "")).strip(),
        "sku": str(record.get("sku", "")).strip(),
        "productName": str(record.get("productName") or record.get("name") or "").strip(),
        "sourceType": str(record.get("sourceType", "manual_adjustment") or "manual_adjustment").strip(),
        "sourceDocumentId": str(record.get("sourceDocumentId", "")).strip(),
        "sourceLabel": str(record.get("sourceLabel", "")).strip(),
        "direction": "out" if direction == "out" else "in",
        "qty": _display_quantity(qty_value),
        "unitCost": round_money(float(record.get("unitCost", 0) or 0)),
        "effectiveDate": str(record.get("effectiveDate") or datetime.now().strftime("%Y-%m-%d")).strip(),
        "reason": str(record.get("reason", "")).strip(),
        "notes": str(record.get("notes", "")).strip(),
        "warehouse": str(record.get("warehouse", "Main Warehouse")).strip() or "Main Warehouse",
        "createdAt": str(record.get("createdAt") or datetime.now().strftime("%Y-%m-%d %H:%M")).strip(),
    }


def _normalize_account_type(value: Any, *, fallback_name: str = "") -> str:
    normalized = str(value or "").strip().lower().replace(" ", "_").replace("-", "_")
    aliases = {
        "bank": "bank",
        "cash": "petty_cash",
        "petty_cash": "petty_cash",
        "pettycash": "petty_cash",
        "cheque": "cheque_payable",
        "cheque_payable": "cheque_payable",
        "credit_card": "credit_card_payable",
        "credit_card_payable": "credit_card_payable",
        "card": "credit_card_payable",
        "gateway": "payment_gateway",
        "payment_gateway": "payment_gateway",
        "paymentgateway": "payment_gateway",
        "edc": "payment_gateway",
        "pos": "payment_gateway",
        "e_wallet": "payment_gateway",
    }
    resolved = aliases.get(normalized)
    if resolved:
        return resolved

    name_lower = fallback_name.lower()
    if "cash" in name_lower:
        return "petty_cash"
    if "card" in name_lower:
        return "credit_card_payable"
    if "cheque" in name_lower:
        return "cheque_payable"
    return "bank"


def _normalize_contact_record(record: dict[str, Any], *, prefix: str) -> dict[str, Any]:
    normalized = deepcopy(record)
    normalized["id"] = normalized.get("id") or prefix
    normalized["name"] = str(normalized.get("name", "")).strip()
    normalized["contact"] = str(normalized.get("contact") or normalized.get("contactPerson") or "").strip()
    normalized["email"] = str(normalized.get("email", "")).strip()
    normalized["phone"] = str(normalized.get("phone", "")).strip()
    normalized["taxId"] = str(normalized.get("taxId", "")).strip()
    normalized["address"] = str(normalized.get("address", "")).strip()
    normalized["balance"] = round(float(normalized.get("balance", 0) or 0), 2)
    normalized["status"] = str(normalized.get("status", "active") or "active")
    return normalized


def _normalize_product_record(record: dict[str, Any]) -> dict[str, Any]:
    normalized = deepcopy(record)
    product_type = _normalize_product_type(normalized.get("productType") or normalized.get("type"))
    stock_value = normalized.get("stock")
    opening_stock = normalized.get("openingStockQty", stock_value if stock_value not in (None, "", "null") else 0)
    opening_cost = normalized.get("openingCost", 0)
    opening_date = normalized.get("openingDate", "")
    if product_type == "stock-counted":
        seed_match = next(
            (item for item in SEED_DATABASE.get("products", []) if str(item.get("sku", "")).strip() == str(normalized.get("sku", "")).strip()),
            None,
        )
        opening_stock_text = str(opening_stock if opening_stock is not None else "").strip()
        opening_cost_text = str(opening_cost if opening_cost is not None else "").strip()
        opening_date_text = str(opening_date or "").strip()
        has_legacy_shape = bool(stock_value not in (None, "", "null")) and (
            not opening_stock_text or not opening_cost_text or not opening_date_text
        )
        if has_legacy_shape:
            opening_stock = (
                seed_match.get("openingStockQty")
                if seed_match and seed_match.get("openingStockQty") not in (None, "", "null")
                else opening_stock
            )
            opening_cost = (
                seed_match.get("openingCost")
                if seed_match and seed_match.get("openingCost") not in (None, "", "null")
                else normalized.get("averageCost", opening_cost)
            )
            opening_date = (
                seed_match.get("openingDate")
                if seed_match and str(seed_match.get("openingDate", "")).strip()
                else normalized.get("lastMovementDate") or "2026-01-01"
            )
    _validate_product_stock_fields(
        product_type=product_type,
        opening_stock_qty=opening_stock,
        opening_cost=opening_cost,
        opening_date=opening_date,
    )
    normalized["sku"] = str(normalized.get("sku", "")).strip()
    normalized["name"] = str(normalized.get("name", "")).strip()
    normalized["productType"] = product_type
    normalized["type"] = normalized.get("type") or _humanize_product_type(product_type)
    normalized["price"] = round(float(normalized.get("price", 0) or 0), 2)
    normalized["stock"] = (
        None
        if product_type in {"service", "non-stock"}
        else int(opening_stock if stock_value in (None, "", "null") else stock_value or 0)
    )
    normalized["status"] = str(normalized.get("status", "active") or "active")
    normalized["openingStockQty"] = 0 if product_type in {"service", "non-stock"} else int(opening_stock or 0)
    normalized["openingCost"] = round(float(opening_cost or 0), 2)
    normalized["openingDate"] = str(opening_date).strip()
    normalized["averageCost"] = round(float(normalized.get("averageCost", normalized["openingCost"]) or 0), 2)
    normalized["lastMovementDate"] = str(normalized.get("lastMovementDate", normalized["openingDate"]) or "").strip()
    quantity = float(normalized["stock"] or 0) if normalized["stock"] is not None else 0
    normalized["stockStatus"] = _inventory_status_for_quantity(quantity, product_status=normalized["status"])
    normalized["stockSummary"] = _inventory_summary_for_quantity(
        quantity,
        product_type=product_type,
        product_status=normalized["status"],
    )

    return normalized


def _normalize_account_record(record: dict[str, Any]) -> dict[str, Any]:
    normalized = deepcopy(record)
    normalized["name"] = str(normalized.get("name", "")).strip()
    normalized["number"] = str(normalized.get("number", "")).strip()
    normalized["balance"] = round(float(normalized.get("balance", 0) or 0), 2)
    normalized["primary"] = bool(normalized.get("primary", False))
    normalized["accountType"] = _normalize_account_type(normalized.get("accountType"), fallback_name=normalized["name"])
    normalized["status"] = str(normalized.get("status", "active") or "active")
    normalized["institution"] = str(normalized.get("institution", "")).strip()
    normalized["currency"] = str(normalized.get("currency", "THB") or "THB").strip()
    return normalized


def _normalize_project_record(record: dict[str, Any]) -> dict[str, Any]:
    normalized = deepcopy(record)
    normalized["id"] = str(normalized.get("id", "")).strip()
    normalized["code"] = str(normalized.get("code", "")).strip()
    normalized["name"] = str(normalized.get("name", "")).strip()
    normalized["status"] = str(normalized.get("status", "active") or "active").strip()
    normalized["customer"] = str(normalized.get("customer", "")).strip()
    normalized["description"] = str(normalized.get("description", "")).strip()
    return normalized


def _normalize_finance_movement_record(record: dict[str, Any]) -> dict[str, Any]:
    normalized = deepcopy(record)
    normalized["id"] = str(normalized.get("id", "")).strip()
    normalized["date"] = str(normalized.get("date") or datetime.now().strftime("%Y-%m-%d")).strip()
    normalized["movementType"] = str(normalized.get("movementType", "transfer") or "transfer").strip().lower()
    normalized["sourceAccountNumber"] = str(normalized.get("sourceAccountNumber", "")).strip()
    normalized["sourceAccountName"] = str(normalized.get("sourceAccountName", "")).strip()
    normalized["destinationAccountNumber"] = str(normalized.get("destinationAccountNumber", "")).strip()
    normalized["destinationAccountName"] = str(normalized.get("destinationAccountName", "")).strip()
    normalized["amount"] = round_money(float(normalized.get("amount", 0) or 0))
    normalized["currency"] = str(normalized.get("currency", "THB") or "THB").strip()
    normalized["note"] = str(normalized.get("note", "")).strip()
    normalized["status"] = str(normalized.get("status", "posted") or "posted").strip()
    return normalized


def _inventory_movement_number(data: dict[str, Any]) -> str:
    sequence = next_counter(data, "inventoryMovement", 1)
    return f"STK-{sequence:05d}"


def _resolve_inventory_product(data: dict[str, Any], line: dict[str, Any]) -> dict[str, Any] | None:
    sku = str(line.get("sku", "")).strip().lower()
    desc = str(line.get("desc", "")).strip().lower()
    products = [
        product
        for product in data.get("products", [])
        if _normalize_product_type(product.get("productType") or product.get("type")) == "stock-counted"
    ]

    if sku:
        return next((product for product in products if str(product.get("sku", "")).strip().lower() == sku), None)

    exact_match = next((product for product in products if str(product.get("name", "")).strip().lower() == desc), None)
    if exact_match:
        return exact_match

    containing = [
        product
        for product in products
        if str(product.get("name", "")).strip().lower() and str(product.get("name", "")).strip().lower() in desc
    ]
    if len(containing) == 1:
        return containing[0]
    return None


def _ensure_inventory_migration_movements(data: dict[str, Any]) -> None:
    movements = data.setdefault("inventoryMovements", [])
    existing_sync_skus = {
        str(item.get("sku", "")).strip()
        for item in movements
        if str(item.get("sourceType", "")).strip() == "migration_sync"
    }
    explicit_movement_skus = {
        str(item.get("sku", "")).strip()
        for item in movements
        if str(item.get("sourceType", "")).strip() != "migration_sync"
    }
    for product in data.get("products", []):
        product_type = _normalize_product_type(product.get("productType") or product.get("type"))
        if product_type != "stock-counted":
            continue

        sku = str(product.get("sku", "")).strip()
        if not sku or sku in existing_sync_skus or sku in explicit_movement_skus:
            continue

        opening_qty = _round_quantity(product.get("openingStockQty", 0))
        current_qty = _round_quantity(product.get("stock", 0))
        delta = current_qty - opening_qty
        if delta == 0:
            continue

        movements.append(
            _normalize_inventory_movement(
                {
                    "id": _inventory_movement_number(data),
                    "sku": sku,
                    "productName": product.get("name", ""),
                    "sourceType": "migration_sync",
                    "sourceDocumentId": f"MIG-{sku}",
                    "sourceLabel": "Migration balance sync",
                    "direction": "in" if delta > 0 else "out",
                    "qty": abs(delta),
                    "unitCost": product.get("openingCost", 0),
                    "effectiveDate": product.get("openingDate") or "2026-01-01",
                    "reason": "Balance carried forward during inventory module setup",
                    "notes": "Auto-created to preserve stock on hand from the pre-inventory catalog state.",
                }
            )
        )


def _inventory_views(data: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    _ensure_inventory_migration_movements(data)

    explicit_movements = sorted(
        [_normalize_inventory_movement(item) for item in data.get("inventoryMovements", []) if item.get("sku")],
        key=lambda item: (item.get("effectiveDate", ""), item.get("createdAt", ""), item.get("id", "")),
    )
    movement_views: list[dict[str, Any]] = []
    inventory_rows: list[dict[str, Any]] = []

    for product in data.get("products", []):
        product_type = _normalize_product_type(product.get("productType") or product.get("type"))
        if product_type != "stock-counted":
            continue

        sku = str(product.get("sku", "")).strip()
        name = str(product.get("name", "")).strip()
        opening_qty = _round_quantity(product.get("openingStockQty", 0))
        opening_cost = round_money(float(product.get("openingCost", 0) or 0))
        opening_date = str(product.get("openingDate", "")).strip()
        current_qty = opening_qty
        average_cost = opening_cost
        inventory_value = opening_qty * opening_cost
        last_movement_date = opening_date

        if opening_date or opening_qty or opening_cost:
            movement_views.append(
                {
                    "id": f"OPEN-{sku}",
                    "sku": sku,
                    "productName": name,
                    "sourceType": "opening_balance",
                    "sourceDocumentId": sku,
                    "sourceLabel": "Opening balance",
                    "qtyIn": _display_quantity(opening_qty),
                    "qtyOut": 0,
                    "beforeQty": 0,
                    "afterQty": _display_quantity(opening_qty),
                    "unitCost": opening_cost,
                    "averageCost": opening_cost,
                    "effectiveDate": opening_date,
                    "reason": "Opening stock",
                    "notes": "",
                    "warehouse": "Main Warehouse",
                }
            )

        product_movements = [item for item in explicit_movements if item["sku"] == sku]
        for movement in product_movements:
            before_qty = current_qty
            movement_qty = _round_quantity(movement.get("qty", 0))
            if movement["direction"] == "in":
                unit_cost = round_money(float(movement.get("unitCost", average_cost) or average_cost))
                current_qty = before_qty + movement_qty
                inventory_value = max(inventory_value, 0) + (movement_qty * unit_cost)
                average_cost = round_money(inventory_value / current_qty) if current_qty > 0 else unit_cost
                qty_in = movement_qty
                qty_out = 0.0
            else:
                unit_cost = average_cost if average_cost > 0 else round_money(float(movement.get("unitCost", 0) or 0))
                current_qty = before_qty - movement_qty
                if before_qty > 0:
                    inventory_value = max(inventory_value - (movement_qty * unit_cost), 0)
                average_cost = round_money(inventory_value / current_qty) if current_qty > 0 else unit_cost
                qty_in = 0.0
                qty_out = movement_qty

            last_movement_date = movement.get("effectiveDate", last_movement_date)
            movement_views.append(
                {
                    **movement,
                    "qtyIn": _display_quantity(qty_in),
                    "qtyOut": _display_quantity(qty_out),
                    "beforeQty": _display_quantity(before_qty),
                    "afterQty": _display_quantity(current_qty),
                    "averageCost": round_money(average_cost),
                }
            )

        inventory_rows.append(
            {
                "sku": sku,
                "name": name,
                "currentQty": _display_quantity(current_qty),
                "unitCost": opening_cost,
                "averageCost": round_money(average_cost),
                "stockStatus": _inventory_status_for_quantity(current_qty, product_status=product.get("status", "active")),
                "lastMovementDate": last_movement_date,
                "warehouse": "Main Warehouse",
                "status": product.get("status", "active"),
            }
        )

    movement_views.sort(key=lambda item: (item.get("effectiveDate", ""), item.get("id", "")), reverse=True)
    inventory_rows.sort(key=lambda item: item["sku"])
    return inventory_rows, movement_views


def _sync_inventory_products(data: dict[str, Any]) -> None:
    inventory_rows, _ = _inventory_views(data)
    rows_by_sku = {row["sku"]: row for row in inventory_rows}
    for product in data.get("products", []):
        sku = str(product.get("sku", "")).strip()
        row = rows_by_sku.get(sku)
        product_type = _normalize_product_type(product.get("productType") or product.get("type"))
        if not row or product_type != "stock-counted":
            product["stockSummary"] = _inventory_summary_for_quantity(
                float(product.get("stock", 0) or 0) if product.get("stock") is not None else 0,
                product_type=product_type,
                product_status=product.get("status", "active"),
            )
            continue

        product["stock"] = int(row["currentQty"]) if float(row["currentQty"]).is_integer() else row["currentQty"]
        product["averageCost"] = row["averageCost"]
        product["lastMovementDate"] = row["lastMovementDate"]
        product["stockStatus"] = row["stockStatus"]
        product["stockSummary"] = _inventory_summary_for_quantity(
            float(row["currentQty"]),
            product_type=product_type,
            product_status=product.get("status", "active"),
        )


def _reconcile_inventory_for_document(
    data: dict[str, Any],
    *,
    kind: str,
    record: dict[str, Any],
) -> None:
    if kind not in {"invoice", "receive"}:
        return

    movements = data.setdefault("inventoryMovements", [])
    movements[:] = [
        item
        for item in movements
        if not (
            str(item.get("sourceType", "")).strip() == kind
            and str(item.get("sourceDocumentId", "")).strip() == str(record.get("id", "")).strip()
        )
    ]

    policy = build_policy_snapshot(_settings_snapshot(data))
    should_apply = resolve_stock_deduction_policy(
        policy.get("stockDeductionTiming", "invoice"),
        document_type=kind,
        status=str(record.get("status", "draft")),
    )
    if kind == "receive" and str(record.get("itemFlow", record.get("receiveType", "inventory"))) != "inventory":
        should_apply = False

    if not should_apply:
        _sync_inventory_products(data)
        return

    source_label = str(record.get("id", "")).strip()
    for line in record.get("lines", []):
        product = _resolve_inventory_product(data, line)
        if not product:
            continue

        qty = _round_quantity(line.get("qty", 0))
        if qty <= 0:
            continue

        movements.append(
            _normalize_inventory_movement(
                {
                    "id": _inventory_movement_number(data),
                    "sku": product.get("sku", ""),
                    "productName": product.get("name", ""),
                    "sourceType": kind,
                    "sourceDocumentId": source_label,
                    "sourceLabel": source_label,
                    "direction": "out" if kind == "invoice" else "in",
                    "qty": qty,
                    "unitCost": line.get("price") if kind == "receive" else product.get("averageCost", product.get("openingCost", 0)),
                    "effectiveDate": record.get("date"),
                    "reason": "Invoice stock issue" if kind == "invoice" else "Goods received",
                    "notes": record.get("notes", ""),
                }
            )
        )

    _sync_inventory_products(data)


def _normalize_database_shape(data: dict[str, Any]) -> dict[str, Any]:
    counters = data.setdefault("counters", {})
    counters.setdefault("invoice", 143)
    counters.setdefault("quotation", 418)
    counters.setdefault("receipt", 418)
    counters.setdefault("billing", 14)
    counters.setdefault("creditNote", 6)
    counters.setdefault("debitNote", 4)
    counters.setdefault("deposit", 9)
    counters.setdefault("purchaseOrder", 421)
    counters.setdefault("receive", 142)
    counters.setdefault("expense", 90)
    counters.setdefault("attachment", 1)
    counters.setdefault("export", 1)
    counters.setdefault("customer", 6)
    counters.setdefault("vendor", 4)
    counters.setdefault("product", 1)
    counters.setdefault("account", 1)
    counters.setdefault("inventoryMovement", 1)
    counters.setdefault("importBatch", 1)
    counters.setdefault("project", 1)
    counters.setdefault("financeMovement", 1)

    data["customers"] = [_normalize_contact_record(item, prefix="C-000") for item in data.get("customers", [])]
    data["vendors"] = [_normalize_contact_record(item, prefix="V-000") for item in data.get("vendors", [])]
    data["products"] = [_normalize_product_record(item) for item in data.get("products", [])]
    data["financeAccounts"] = [_normalize_account_record(item) for item in data.get("financeAccounts", [])]
    data["projects"] = [_normalize_project_record(item) for item in data.get("projects", deepcopy(SEED_DATABASE["projects"]))]
    data["financeMovements"] = [
        _normalize_finance_movement_record(item)
        for item in data.get("financeMovements", [])
    ]

    settings = data.setdefault("settings", {})
    for section in SETTINGS_SECTIONS:
        settings[section] = merge_settings_section(section, settings.get(section))

    data.setdefault("quotations", [])
    data.setdefault("receipts", [])
    data.setdefault("billings", [])
    data.setdefault("creditNotes", [])
    data.setdefault("debitNotes", [])
    data.setdefault("deposits", [])
    data.setdefault("purchaseOrders", [])
    data.setdefault("receives", [])
    data.setdefault("payments", [])
    data.setdefault("withholdingTaxDocuments", [])
    data.setdefault("inventoryMovements", [])
    data.setdefault("attachments", [])
    data.setdefault("recentActivity", [])
    data.setdefault("reports", deepcopy(SEED_DATABASE["reports"]))
    for resolved_kind, config in DOCUMENT_CONFIG.items():
        for item in data.get(config["key"], []):
            normalize_workflow_fields(item, kind=resolved_kind)
    for payment in data.get("payments", []):
        normalize_workflow_fields(payment, kind="supplier_payment")
    _sync_inventory_products(data)
    return data


def _db() -> dict[str, Any]:
    return _normalize_database_shape(load_database(_seed_database))


def _mutate(mutator):
    def wrapped(data: dict[str, Any]):
        _normalize_database_shape(data)
        return mutator(data)

    return mutate_database(_seed_database, wrapped)


def _settings_snapshot(data: dict[str, Any]) -> dict[str, Any]:
    settings = data.get("settings", {})
    return settings if isinstance(settings, dict) else {}


def _setting_section(data: dict[str, Any], section: str) -> dict[str, Any]:
    return merge_settings_section(section, _settings_snapshot(data).get(section))


def _now_label() -> str:
    return "just now"


def _kind_alias(kind: str) -> str:
    aliases = {
        "purchase-order": "purchase_order",
        "purchase_order": "purchase_order",
        "po": "purchase_order",
        "quotation": "quotation",
        "quote": "quotation",
        "invoice": "invoice",
        "tax_invoice": "invoice",
        "tax-invoice": "invoice",
        "receipt": "receipt",
        "billing": "billing",
        "billing_note": "billing",
        "billing-note": "billing",
        "combined_billing_note": "billing",
        "combined-billing-note": "billing",
        "credit-note": "credit_note",
        "credit_note": "credit_note",
        "credit": "credit_note",
        "debit-note": "debit_note",
        "debit_note": "debit_note",
        "debit": "debit_note",
        "deposit": "deposit",
        "deposit_invoice": "deposit",
        "deposit-invoice": "deposit",
        "prepayment_tax_invoice": "deposit",
        "prepayment-tax-invoice": "deposit",
        "receive": "receive",
        "delivery_note": "receive",
        "delivery-note": "receive",
        "goods_receive": "receive",
        "goods-receive": "receive",
        "receive_inventory": "receive",
        "receive-inventory": "receive",
        "expense": "expense",
        "vendor_invoice": "expense",
        "vendor-invoice": "expense",
        "withholding-tax": "withholding_tax",
        "withholding_tax": "withholding_tax",
        "withholding_tax_certificate": "withholding_tax",
        "withholding-tax-certificate": "withholding_tax",
        "wht": "withholding_tax",
    }
    resolved = aliases.get(kind, kind)
    if resolved not in DOCUMENT_CONFIG:
        raise ValueError(f"Unsupported document kind: {kind}")
    return resolved


def _normalize_line(
    index: int,
    line: dict[str, Any],
    *,
    vat_registered: bool = True,
    tax_mode: TaxMode = TaxMode.EXCLUSIVE,
) -> dict[str, Any]:
    qty = float(line.get("qty", 0) or 0)
    price = float(line.get("price", 0) or 0)
    tax = sanitize_whole_percent(line.get("vatRate", line.get("tax", 0))) if vat_registered else 0
    raw_withholding_rate = sanitize_whole_percent(line.get("withholdingRate", 0))
    withholding_rate = raw_withholding_rate if raw_withholding_rate in {0, 1, 2, 3, 5} else 0
    discount_type = "amount" if str(line.get("discountType", "percent")).lower() == "amount" else "percent"
    discount_value = max(float(line.get("discountValue", line.get("discount", line.get("disc", 0))) or 0), 0)
    amount = round_money(qty * price)
    discount_amount = round_money(min(discount_value if discount_type == "amount" else amount * (discount_value / 100), amount))
    amount_before_vat = round_money(max(amount - discount_amount, 0))
    if not vat_registered:
        amount_before_vat = round_money(amount - discount_amount)
        vat_amount = 0.0
    elif "vatAmount" in line:
        vat_amount = round_money(amount_before_vat * (tax / 100))
    else:
        vat_amount = round_money(amount_before_vat * (tax / 100))
    withholding_amount = round_money(line.get("withholdingAmount", amount_before_vat * (withholding_rate / 100)) or 0)
    return {
        "id": str(line.get("id") or index + 1),
        "sku": str(line.get("sku", "")).strip(),
        "inventoryId": str(line.get("inventoryId", "")).strip(),
        "originalInventoryCode": str(line.get("originalInventoryCode", "")).strip(),
        "displayCode": str(line.get("displayCode") or line.get("sku", "")).strip(),
        "desc": str(line.get("desc", "")).strip(),
        "details": str(line.get("details", "")).strip(),
        "qty": qty,
        "unit": str(line.get("unit", "")).strip(),
        "price": price,
        "tax": tax,
        "vatRate": tax,
        "discountType": discount_type,
        "discountValue": discount_value,
        "discountAmount": discount_amount,
        "discount": discount_value,
        "amount": amount_before_vat,
        "amountBeforeVat": amount_before_vat,
        "vatAmount": vat_amount,
        "withholdingRate": withholding_rate,
        "withholdingAmount": withholding_amount,
        "lineTotal": amount_before_vat,
        "totalAmount": amount_before_vat,
        "availableStock": line.get("availableStock"),
        "stockOverrideAcknowledged": bool(line.get("stockOverrideAcknowledged", False)),
        "sourceDocumentId": str(line.get("sourceDocumentId", "")).strip(),
        "sourceDocumentType": str(line.get("sourceDocumentType", "")).strip(),
        "sourceLineId": str(line.get("sourceLineId", "")).strip(),
    }


def _summarize_document(kind: str, record: dict[str, Any]) -> dict[str, Any]:
    party = (
        record.get("customer")
        or record.get("vendor")
        or record.get("receivedFrom")
        or record.get("relatedInvoice")
        or "-"
    )
    raw_document_types = list(record.get("documentTypes", []))
    is_legacy_tax_invoice = "tax_invoice" in raw_document_types
    document_types = raw_document_types
    return {
        "id": record["id"],
        "party": party,
        "date": record.get("date", ""),
        "amount": float(record.get("amount", 0)),
        "status": record.get("status", "draft"),
        "kind": kind,
        "workflowId": record.get("workflowId", ""),
        "sourceDocumentIds": list(record.get("sourceDocumentIds", [])),
        "linkedDocumentIds": list(record.get("linkedDocumentIds", [])),
        "convertedFromId": record.get("convertedFromId"),
        "convertedToIds": list(record.get("convertedToIds", [])),
        "workflowMode": record.get("workflowMode", "guided"),
        "overrideReason": record.get("overrideReason"),
        "paymentStatus": record.get("paymentStatus", ""),
        "deliveryStatus": record.get("deliveryStatus", ""),
        "amountPaid": float(record.get("amountPaid", 0) or 0),
        "amountDue": float(record.get("amountDue", 0) or 0),
        "withholdingAmount": float(record.get("withholdingAmount", 0) or 0),
        "taxPointDate": record.get("taxPointDate"),
        "taxPointReason": record.get("taxPointReason"),
        "taxInvoiceRequired": bool(record.get("taxInvoiceRequired", False)),
        "vatReportingPeriod": record.get("vatReportingPeriod"),
        "taxGuidance": deepcopy(record.get("taxGuidance", [])),
        "vatAuditSnapshot": deepcopy(record.get("vatAuditSnapshot", {})),
        "transactionType": record.get("transactionType", ""),
        "documentVariant": record.get("documentVariant", ""),
        "documentTypes": document_types,
        "documentTitle": record.get("documentTitle", "") or ("ใบกำกับภาษี" if is_legacy_tax_invoice else ""),
        "invoiceTaxType": record.get("invoiceTaxType") or ("tax" if is_legacy_tax_invoice or record.get("isTaxInvoice") else "normal"),
        "isTaxInvoice": bool(record.get("isTaxInvoice") or is_legacy_tax_invoice),
        "invoicePaymentMode": record.get("invoicePaymentMode", ""),
        "depositType": record.get("depositType", ""),
        "depositValue": record.get("depositValue", 0),
        "depositPercent": record.get("depositPercent", 0),
        "depositAmount": record.get("depositAmount", 0),
        "depositSourceDocumentId": record.get("depositSourceDocumentId", ""),
        "depositSourceDocumentType": record.get("depositSourceDocumentType", ""),
        "invoicePaymentSchedule": deepcopy(record.get("invoicePaymentSchedule", [])),
        "invoiceDeductions": deepcopy(record.get("invoiceDeductions", [])),
        "sourceInvoiceIds": list(record.get("sourceInvoiceIds", [])),
        "sourceBillingId": record.get("sourceBillingId", ""),
        "parentQuotationId": record.get("parentQuotationId", ""),
        "sourceDocumentId": record.get("sourceDocumentId", ""),
        "sourceDocumentType": record.get("sourceDocumentType", ""),
        "referenceDocuments": deepcopy(record.get("referenceDocuments", [])),
        "relatedDocumentIds": deepcopy(record.get("relatedDocumentIds", [])),
        "projectId": record.get("projectId", ""),
        "projectName": record.get("projectName", ""),
        "baseCurrency": record.get("baseCurrency", ""),
        "exchangeRate": record.get("exchangeRate", 1),
        "snapshotDate": record.get("snapshotDate", ""),
        "paymentSummary": deepcopy(record.get("paymentSummary")),
    }


def _document_summaries(key: str, kind: str) -> list[dict[str, Any]]:
    return [_summarize_document(kind, item) for item in _db().get(key, [])]


def _push_activity(data: dict[str, Any], who: str, what: str, kind: str, amount: float | None = None) -> None:
    entry = {"who": who, "what": what, "time": _now_label(), "type": kind}
    if amount is not None:
        entry["amount"] = amount
    data.setdefault("recentActivity", []).insert(0, entry)
    data["recentActivity"] = data["recentActivity"][:20]


def _parse_document_period(date_text: str | None) -> tuple[str, str]:
    try:
        parsed = datetime.fromisoformat(str(date_text or ""))
    except ValueError:
        parsed = datetime.now()
    return parsed.strftime("%Y"), parsed.strftime("%m")


def _document_number_exists(data: dict[str, Any], document_number: str, *, exclude_key: str | None = None) -> bool:
    normalized = str(document_number or "").strip()
    if not normalized:
        return False
    for collection_key in DOCUMENT_COLLECTION_KEYS:
        for item in data.get(collection_key, []):
            if item.get("id") == normalized and collection_key != exclude_key:
                return True
    return False


def _find_sequence(data: dict[str, Any], document_type: str, year: str, month: str) -> dict[str, Any]:
    sequences = data.setdefault("documentNumberSequences", [])
    for sequence in sequences:
        if (
            sequence.get("document_type") == document_type
            and str(sequence.get("year")) == year
            and str(sequence.get("month")).zfill(2) == month
        ):
            return sequence
    sequence = {
        "document_type": document_type,
        "year": year,
        "month": month,
        "last_number": 0,
    }
    sequences.append(sequence)
    return sequence


def _document_number(data: dict[str, Any], kind: str, date_text: str | None) -> str:
    config = DOCUMENT_CONFIG[kind]
    prefix = config["prefix"]
    year, month = _parse_document_period(date_text)
    sequence = _find_sequence(data, kind, year, month)
    while True:
        next_number = int(sequence.get("last_number", 0) or 0) + 1
        sequence["last_number"] = next_number
        candidate = build_document_number(
            counters={},
            counter_key=config["counter"],
            prefix=prefix,
            start_at=next_number,
            date_text=date_text,
        )
        if not _document_number_exists(data, candidate):
            return candidate


def _customer_number(data: dict[str, Any]) -> str:
    sequence = next_counter(data, "customer", 6)
    return f"C-{sequence:03d}"


def _vendor_number(data: dict[str, Any]) -> str:
    sequence = next_counter(data, "vendor", 4)
    return f"V-{sequence:03d}"


def _product_sku(data: dict[str, Any]) -> str:
    sequence = next_counter(data, "product", 1)
    return f"SKU-{sequence:04d}"


def _account_number(data: dict[str, Any]) -> str:
    sequence = next_counter(data, "account", 1)
    return f"ACC-{sequence:04d}"


def _payment_number(data: dict[str, Any], date_text: str | None) -> str:
    issue_date = str(date_text or datetime.now().strftime("%Y-%m-%d"))
    year = issue_date[:4] if len(issue_date) >= 4 else datetime.now().strftime("%Y")
    sequence = next_counter(data, "payment", 1)
    return f"PAY-{year}-{sequence:04d}"


def _project_number(data: dict[str, Any]) -> str:
    sequence = next_counter(data, "project", 1)
    return f"PRJ-{sequence:03d}"


def _finance_movement_number(data: dict[str, Any], date_text: str | None) -> str:
    issue_date = str(date_text or datetime.now().strftime("%Y-%m-%d"))
    year = issue_date[:4] if len(issue_date) >= 4 else datetime.now().strftime("%Y")
    sequence = next_counter(data, "financeMovement", 1)
    return f"FMV-{year}-{sequence:04d}"


def _resolve_finance_account(
    data: dict[str, Any],
    *,
    account_number: str | None = None,
    account_name: str | None = None,
) -> dict[str, Any] | None:
    normalized_number = str(account_number or "").strip().lower()
    normalized_name = str(account_name or "").strip().lower()

    if normalized_number:
        account = next(
            (
                item
                for item in data.get("financeAccounts", [])
                if str(item.get("number", "")).strip().lower() == normalized_number
            ),
            None,
        )
        if account:
            return account

    if normalized_name:
        return next(
            (
                item
                for item in data.get("financeAccounts", [])
                if str(item.get("name", "")).strip().lower() == normalized_name
            ),
            None,
        )

    return None


def _payment_summary_for_amount(
    amount: float,
    summary: dict[str, Any] | None = None,
) -> dict[str, Any]:
    summary = deepcopy(summary or {})
    paid = round_money(float(summary.get("paid", 0) or 0))
    remaining = round_money(float(summary.get("remaining", max(amount - paid, 0)) or 0))
    status = summary.get("status")
    if not status:
        status = PaymentStatus.PAID.value if remaining <= 0 else PaymentStatus.PARTIAL.value if paid > 0 else PaymentStatus.UNPAID.value

    return {
        "paid": paid,
        "remaining": remaining,
        "status": status,
        "lastPaymentDate": summary.get("lastPaymentDate", ""),
        "lastPaymentMethod": summary.get("lastPaymentMethod", ""),
        "lastPaymentId": summary.get("lastPaymentId", ""),
    }


def _document_status_from_payment(kind: str, current_status: str, payment_summary: dict[str, Any]) -> str:
    remaining = round_money(payment_summary.get("remaining", 0))
    paid = round_money(payment_summary.get("paid", 0))
    if remaining <= 0:
        return "paid"
    if paid > 0:
        return "partial"
    if kind == "expense" and current_status in {"paid", "partial"}:
        return "approved"
    return current_status


def _allocation_target_collection(document_type: str) -> str | None:
    normalized = str(document_type or "").strip().lower()
    if normalized in {"expense"}:
        return "expenses"
    if normalized in {"receive"}:
        return "receives"
    if normalized in {"purchase_order", "purchase-order", "po"}:
        return "purchaseOrders"
    return None


def _apply_payment_allocations(
    data: dict[str, Any],
    payment_record: dict[str, Any],
    allocations: list[dict[str, Any]],
) -> None:
    applied_ids: list[str] = []
    for allocation in allocations:
        document_id = str(allocation.get("documentId", "")).strip()
        document_type = str(allocation.get("documentType", "")).strip()
        allocated_amount = round_money(float(allocation.get("amount", 0) or 0))
        if not document_id or allocated_amount <= 0:
            continue

        collection_key = _allocation_target_collection(document_type)
        if not collection_key:
            continue

        target = next((item for item in data.get(collection_key, []) if item.get("id") == document_id), None)
        if not target:
            continue

        target_amount = round_money(float(target.get("amount", 0) or 0))
        next_summary = _payment_summary_for_amount(target_amount, target.get("paymentSummary"))
        next_summary["paid"] = round_money(next_summary["paid"] + allocated_amount)
        next_summary["remaining"] = round_money(max(target_amount - next_summary["paid"], 0))
        next_summary["status"] = (
            PaymentStatus.PAID.value
            if next_summary["remaining"] <= 0
            else PaymentStatus.PARTIAL.value
        )
        next_summary["lastPaymentDate"] = payment_record.get("paymentDate", "")
        next_summary["lastPaymentMethod"] = payment_record.get("paymentMethod", "")
        next_summary["lastPaymentId"] = payment_record.get("id", "")
        target["paymentSummary"] = next_summary
        target["status"] = _document_status_from_payment(document_type, str(target.get("status", "pending")), next_summary)
        target.setdefault("linkedDocumentIds", [])
        if payment_record["id"] not in target["linkedDocumentIds"]:
            target["linkedDocumentIds"].append(payment_record["id"])
        applied_ids.append(document_id)

    payment_record["sourceDocumentIds"] = applied_ids


def _withholding_tax_number(data: dict[str, Any], date_text: str | None) -> str:
    issue_date = str(date_text or datetime.now().strftime("%Y-%m-%d"))
    year = issue_date[:4] if len(issue_date) >= 4 else datetime.now().strftime("%Y")
    sequence = next_counter(data, "withholdingTax", 1)
    return f"WHT-{year}-{sequence:04d}"


def _document_requests_full_tax_invoice(record: dict[str, Any]) -> bool:
    document_types = {str(item).replace("-", "_") for item in record.get("documentTypes", []) or []}
    return bool(
        record.get("isTaxInvoice")
        or record.get("invoiceTaxType") == "tax"
        or document_types.intersection({"tax_invoice", "short_tax_invoice", "cash_sale"})
    )


def _apply_tax_policy_to_record(
    record: dict[str, Any],
    settings: dict[str, Any],
    *,
    kind: str,
    strict_validation: bool = True,
) -> dict[str, Any]:
    company_vat_registered = _is_company_vat_registered(settings)
    taxes = merge_settings_section("taxes", settings.get("taxes"))
    allow_override = bool(taxes.get("allowTaxInvoiceOverride") or taxes.get("allowNonVatTaxInvoiceOverride"))
    if strict_validation and not company_vat_registered and _document_requests_full_tax_invoice(record):
        if not allow_override or not str(record.get("taxOverrideReason") or record.get("overrideReason") or "").strip():
            raise ValueError("This company is not VAT registered and should not issue a full tax invoice without an approved override reason.")
    is_sales = kind in {"quotation", "invoice", "receipt", "billing", "credit_note", "debit_note", "deposit"}
    return apply_tax_point_policy(record, settings, sales=is_sales)


def _build_document_record(kind: str, payload: dict[str, Any]) -> dict[str, Any]:
    settings = _settings_snapshot(_db())
    company_vat_registered = _is_company_vat_registered(settings)
    documents_settings = _sanitize_document_settings_for_company(
        settings,
        merge_settings_section("documents", settings.get("documents")),
    )
    raw_tax_mode = str(payload.get("taxMode") or documents_settings.get("taxMode") or "exclusive")
    tax_mode = TaxMode.INCLUSIVE if raw_tax_mode == TaxMode.INCLUSIVE.value and company_vat_registered else TaxMode.EXCLUSIVE
    per_line_withholding = bool(
        (payload.get("documentSettingsSnapshot") or {}).get(
            "perLineWithholdingTax",
            documents_settings.get("perLineWithholdingTax", False),
        )
    )
    lines = [
        _normalize_line(index, line, vat_registered=company_vat_registered, tax_mode=tax_mode)
        for index, line in enumerate(payload.get("lines", []))
    ]
    computed_totals = calculate_document_totals(
        lines,
        default_tax_rate=7 if company_vat_registered else 0,
        tax_mode=tax_mode,
        withholding_rate=payload.get("withholdingRate", 0),
        vat_enabled=company_vat_registered,
        per_line_withholding=per_line_withholding,
    )
    subtotal = round_money(payload.get("subtotal", computed_totals["subtotal"]) or 0)
    tax_amount = 0.0 if not company_vat_registered else round_money(payload.get("taxAmount", computed_totals["taxAmount"]) or 0)
    amount = round_money(payload.get("amount", subtotal + tax_amount) or 0)
    if not company_vat_registered:
        amount = subtotal
    if lines and amount == 0:
        amount = round_money(subtotal + tax_amount)

    currency = payload.get("currency", "THB")
    exchange_snapshot = snapshot_exchange_rate(
        currency=currency,
        base_currency=_setting_section(_db(), "currency").get("baseCurrency", "THB"),
        rate=payload.get("exchangeRate"),
        snapshot_date=payload.get("date"),
    )

    base = {
        "date": payload.get("date") or datetime.now().strftime("%Y-%m-%d"),
        "status": payload.get("status", "draft"),
        "currency": currency,
        "projectId": str(payload.get("projectId", "") or "").strip(),
        "projectName": str(payload.get("projectName", "") or "").strip(),
        "reference": payload.get("reference", ""),
        "notes": payload.get("notes", payload.get("description", "")),
        "paymentTerms": payload.get("paymentTerms", ""),
        "paymentMethod": payload.get("paymentMethod", ""),
        "subtotal": subtotal if subtotal else (round_money(amount / 1.07) if amount else 0),
        "taxAmount": tax_amount if company_vat_registered else 0,
        "amount": amount,
        "lines": lines,
        "attachments": [],
        **exchange_snapshot,
    }

    if kind == "invoice":
        base.update(
            {
                "customer": payload.get("customer", ""),
                "due": payload.get("due", ""),
            }
        )
    elif kind == "quotation":
        base.update(
            {
                "customer": payload.get("customer", ""),
                "expiryDate": payload.get("expiryDate", payload.get("due", "")),
            }
        )
    elif kind == "receipt":
        base.update(
            {
                "customer": payload.get("customer", ""),
                "relatedInvoice": payload.get("relatedInvoice", ""),
            }
        )
    elif kind == "billing":
        base.update(
            {
                "customer": payload.get("customer", ""),
                "due": payload.get("due", ""),
                "sourceInvoiceIds": payload.get("sourceInvoiceIds", []),
                "billingStatus": payload.get("billingStatus", payload.get("status", "draft")),
            }
        )
    elif kind == "credit_note":
        base.update(
            {
                "customer": payload.get("customer", ""),
                "due": payload.get("due", ""),
                "relatedInvoice": payload.get("relatedInvoice", ""),
                "sourceDocumentId": payload.get("sourceDocumentId", payload.get("relatedInvoice", "")),
                "sourceDocumentType": payload.get("sourceDocumentType", "invoice"),
                "reason": payload.get("reason", ""),
            }
        )
    elif kind == "debit_note":
        base.update(
            {
                "customer": payload.get("customer", ""),
                "due": payload.get("due", ""),
                "relatedInvoice": payload.get("relatedInvoice", ""),
                "sourceDocumentId": payload.get("sourceDocumentId", payload.get("relatedInvoice", "")),
                "sourceDocumentType": payload.get("sourceDocumentType", "invoice"),
                "reason": payload.get("reason", ""),
                "stockCutBehavior": payload.get("stockCutBehavior", "follow_policy"),
            }
        )
    elif kind == "deposit":
        base.update(
            {
                "customer": payload.get("customer", ""),
                "due": payload.get("due", ""),
                "parentQuotationId": payload.get("parentQuotationId", ""),
                "sourceDocumentId": payload.get("sourceDocumentId", payload.get("parentQuotationId", "")),
                "sourceDocumentType": payload.get("sourceDocumentType", "quotation"),
            }
        )
    elif kind == "purchase_order":
        base.update(
            {
                "vendor": payload.get("vendor", ""),
                "due": payload.get("due", ""),
                "deliveryTo": payload.get("deliveryTo", ""),
                "requestedBy": payload.get("requestedBy", ""),
                "department": payload.get("department", ""),
                "deliveryTerms": payload.get("deliveryTerms", ""),
            }
        )
    elif kind == "receive":
        base.update(
            {
                "vendor": payload.get("vendor", payload.get("receivedFrom", "")),
                "receivedFrom": payload.get("receivedFrom", payload.get("vendor", "")),
                "relatedDocument": payload.get("relatedDocument", payload.get("relatedPurchaseOrderId", "")),
                "relatedPurchaseOrderId": payload.get("relatedPurchaseOrderId", ""),
                "approvalStatus": payload.get("approvalStatus", payload.get("status", "pending")),
                "verifiedBy": payload.get("verifiedBy", ""),
                "department": payload.get("department", ""),
                "netAmount": float(payload.get("netAmount", 0) or 0),
                "tags": payload.get("tags", []),
                "internalRemark": payload.get("internalRemark", ""),
                "receiveType": payload.get("receiveType", "inventory"),
                "receiveMode": payload.get("receiveMode", "standalone"),
                "itemFlow": payload.get("itemFlow", payload.get("receiveType", "inventory")),
                "paymentSummary": _payment_summary_for_amount(
                    amount,
                    payload.get("paymentSummary"),
                ),
            }
        )
    elif kind == "expense":
        base = {
            "id": payload.get("id", ""),
            "vendor": payload.get("vendor", ""),
            "category": payload.get("category", ""),
            "date": payload.get("date") or datetime.now().strftime("%Y-%m-%d"),
            "amount": round_money(float(payload.get("amount", 0) or 0)),
            "status": payload.get("status", "pending"),
            "paymentMethod": payload.get("paymentMethod", "Bank transfer"),
            "currency": currency,
            "projectId": str(payload.get("projectId", "") or "").strip(),
            "projectName": str(payload.get("projectName", "") or "").strip(),
            "due": payload.get("due", payload.get("date") or datetime.now().strftime("%Y-%m-%d")),
            "reference": payload.get("reference", ""),
            "notes": payload.get("notes", payload.get("description", "")),
            "accountantCategory": payload.get("accountantCategory", ""),
            "linkedDocumentIds": payload.get("linkedDocumentIds", []),
            "sourceDocumentId": payload.get("sourceDocumentId", ""),
            "sourceDocumentType": payload.get("sourceDocumentType", ""),
            "subtotal": subtotal if subtotal else round_money(amount / 1.07) if amount else 0,
            "taxAmount": tax_amount if company_vat_registered else 0,
            "amountBeforeVat": subtotal,
            "lines": lines,
            "paymentSummary": _payment_summary_for_amount(
                round_money(float(payload.get("amount", 0) or 0)),
                payload.get("paymentSummary"),
            ),
            "attachments": [],
            **exchange_snapshot,
        }
    elif kind == "withholding_tax":
        tax_rate = round_money(float(payload.get("rate", payload.get("withholdingRate", 0)) or 0))
        taxable_amount = round_money(float(payload.get("taxableAmount", 0) or 0))
        withheld_amount = round_money(
            float(payload.get("amount", taxable_amount * (tax_rate / 100 if tax_rate > 1 else tax_rate)) or 0)
        )
        base = {
            "id": payload.get("id", ""),
            "vendor": payload.get("vendor", ""),
            "date": payload.get("date") or datetime.now().strftime("%Y-%m-%d"),
            "amount": withheld_amount,
            "rate": tax_rate if tax_rate <= 1 else round_money(tax_rate / 100),
            "taxableAmount": taxable_amount,
            "incomeType": payload.get("incomeType", "service"),
            "filingMonth": payload.get("filingMonth", ""),
            "status": payload.get("status", "draft"),
            "sourceDocumentId": payload.get("sourceDocumentId", ""),
            "sourceDocumentType": payload.get("sourceDocumentType", "expense"),
            "relatedExpenseId": payload.get("relatedExpenseId", ""),
            "relatedPaymentId": payload.get("relatedPaymentId", ""),
            "currency": currency,
            "attachments": [],
        }

    passthrough_keys = {
        "documentVariant",
        "documentTypes",
        "documentTitle",
        "invoiceTaxType",
        "isTaxInvoice",
        "invoicePaymentMode",
        "depositType",
        "depositValue",
        "depositPercent",
        "depositAmount",
        "depositSourceDocumentId",
        "depositSourceDocumentType",
        "invoicePaymentSchedule",
        "invoiceDeductions",
        "sourceInvoiceIds",
        "sourceBillingId",
        "sourceDocumentId",
        "sourceDocumentNumber",
        "sourceDocumentType",
        "sourceDocumentDate",
        "sourceDocumentCustomer",
        "relatedDocumentIds",
        "referenceDocuments",
        "linkedDocumentIds",
        "discountType",
        "discountValue",
        "taxMode",
        "vatEnabled",
        "withholdingEnabled",
        "parentQuotationId",
        "installmentSourceId",
        "installmentIndex",
        "installmentCount",
        "installmentSplitMode",
        "installmentPlan",
        "installmentHistory",
        "receiptAdjustments",
        "splitReceives",
        "billingStatus",
        "stockCutBehavior",
        "reason",
        "timeline",
        "paymentSummary",
        "adjustmentSummary",
        "eligibleInvoiceIds",
        "netReceivable",
        "documentLanguage",
        "documentCopy",
        "copyGeneration",
        "primaryDocumentType",
        "documentNumberPrefix",
        "sellerInfo",
        "sellerUserId",
        "sellerUserInfo",
        "customerInfo",
        "salesperson",
        "documentContact",
        "paymentDetails",
        "internalNote",
        "customerAcknowledgement",
        "relatedDocumentNumber",
        "brandingSnapshot",
        "documentSettingsSnapshot",
        "subtotalBeforeDiscount",
        "totalDiscount",
        "amountBeforeVat",
        "vatRate",
        "withholdingRate",
        "withholdingAmount",
        "vatGroups",
        "withholdingGroups",
        "totalWithholdingTax",
        "amountPaid",
        "amountDue",
        "amountInWordsThai",
        "amountInWordsEnglish",
        "transactionType",
        "deliveryDate",
        "ownershipTransferDate",
        "serviceCompletedDate",
        "paymentDate",
        "taxPointDate",
        "taxPointReason",
        "taxInvoiceRequired",
        "vatReportingPeriod",
        "taxGuidance",
        "vatAuditSnapshot",
        "taxPointSourceEvents",
        "taxOverrideReason",
    }
    for key in passthrough_keys:
        if key in payload and payload.get(key) is not None:
            base[key] = deepcopy(payload.get(key))

    if kind == "invoice":
        raw_document_types = list(base.get("documentTypes") or [])
        legacy_tax_invoice = "tax_invoice" in raw_document_types
        base["documentTypes"] = raw_document_types or (["tax_invoice"] if bool(base.get("isTaxInvoice")) or base.get("invoiceTaxType") == "tax" else ["invoice"])
        if legacy_tax_invoice or bool(base.get("isTaxInvoice")) or base.get("invoiceTaxType") == "tax":
            base["invoiceTaxType"] = "tax"
            base["isTaxInvoice"] = True
            base["documentTitle"] = "ใบกำกับภาษี"
            base.setdefault("documentVariant", "Tax Invoice")
        else:
            base["invoiceTaxType"] = base.get("invoiceTaxType") or "normal"
            base["isTaxInvoice"] = False
        base["invoicePaymentMode"] = base.get("invoicePaymentMode") or "full_payment"

    base["subtotalBeforeDiscount"] = computed_totals.get("subtotalBeforeDiscount", base.get("subtotalBeforeDiscount", 0))
    base["totalDiscount"] = computed_totals.get("totalDiscount", base.get("totalDiscount", 0))
    base["subtotal"] = computed_totals.get("amountBeforeVat", computed_totals.get("subtotal", base.get("subtotal", 0)))
    base["amountBeforeVat"] = base["subtotal"]
    base["taxAmount"] = computed_totals.get("taxAmount", base.get("taxAmount", 0)) if company_vat_registered else 0
    base["amount"] = computed_totals.get("grandTotal", round_money(base["subtotal"] + base["taxAmount"]))
    base["vatGroups"] = computed_totals.get("vatGroups", []) if company_vat_registered else []
    base["withholdingGroups"] = computed_totals.get("withholdingGroups", [])
    base["withholdingAmount"] = computed_totals.get("withholdingAmount", 0)
    base["totalWithholdingTax"] = computed_totals.get("totalWithholdingTax", base["withholdingAmount"])
    base["amountDue"] = round_money(
        float(base.get("amount", 0) or 0)
        - float(base.get("totalWithholdingTax", base.get("withholdingAmount", 0)) or 0)
        - float(base.get("amountPaid", 0) or 0)
    )

    if not company_vat_registered:
        base["taxMode"] = "exclusive"
        base["vatEnabled"] = False
        base["vatRate"] = 0
        base["taxAmount"] = 0
        base["amount"] = round_money(base.get("subtotal", base.get("amountBeforeVat", base.get("amount", 0))) or 0)
        base["amountBeforeVat"] = base["amount"]
        base["vatGroups"] = []
        document_settings = deepcopy(base.get("documentSettingsSnapshot") or documents_settings)
        if isinstance(document_settings, dict):
            document_settings["taxMode"] = "exclusive"
            document_settings["perLineVat"] = False
        base["documentSettingsSnapshot"] = document_settings
    else:
        base.setdefault("vatGroups", computed_totals.get("vatGroups", []))

    raw_withholding_rate = sanitize_whole_percent(base.get("withholdingRate", payload.get("withholdingRate", 0)))
    base["withholdingRate"] = raw_withholding_rate if raw_withholding_rate in {0, 1, 2, 3, 5} else 0

    if kind == "expense":
        expense_amount = round_money(float(payload.get("amount", base.get("amount", 0)) or 0))
        base["amount"] = expense_amount
        base["subtotal"] = round_money(float(payload.get("subtotal", expense_amount) or expense_amount))
        base["amountBeforeVat"] = base["subtotal"]
        base["taxAmount"] = 0.0 if not company_vat_registered else round_money(base.get("taxAmount", 0))
        base["amountDue"] = round_money(
            expense_amount
            - float(base.get("totalWithholdingTax", base.get("withholdingAmount", 0)) or 0)
            - float(base.get("amountPaid", 0) or 0)
        )
        base["paymentSummary"] = _payment_summary_for_amount(expense_amount, payload.get("paymentSummary", base.get("paymentSummary")))

    if kind == "withholding_tax":
        tax_rate = round_money(float(payload.get("rate", payload.get("withholdingRate", base.get("rate", 0))) or 0))
        taxable_amount = round_money(float(payload.get("taxableAmount", base.get("taxableAmount", 0)) or 0))
        withheld_amount = round_money(
            float(payload.get("amount", taxable_amount * (tax_rate / 100 if tax_rate > 1 else tax_rate)) or 0)
        )
        base["rate"] = tax_rate if tax_rate <= 1 else round_money(tax_rate / 100)
        base["taxableAmount"] = taxable_amount
        base["amount"] = withheld_amount

    base = _apply_tax_policy_to_record(base, settings, kind=kind)
    return normalize_workflow_fields(base, kind=kind)


def list_invoices() -> list[dict[str, Any]]:
    return deepcopy(_db().get("invoices", []))


def get_invoice(invoice_id: str) -> dict[str, Any] | None:
    return deepcopy(next((item for item in _db().get("invoices", []) if item["id"] == invoice_id), None))


def list_expenses() -> list[dict[str, Any]]:
    return deepcopy(_db().get("expenses", []))


def get_expense(expense_id: str) -> dict[str, Any] | None:
    return deepcopy(next((item for item in _db().get("expenses", []) if item["id"] == expense_id), None))


def list_payables() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for expense in _db().get("expenses", []):
        if str(expense.get("status", "pending")).lower() in {"draft", "cancelled", "void"}:
            continue
        summary = _payment_summary_for_amount(round_money(expense.get("amount", 0)), expense.get("paymentSummary"))
        if summary["remaining"] <= 0:
            continue
        rows.append(
            {
                "id": expense["id"],
                "sourceType": "expense",
                "vendor": expense.get("vendor", ""),
                "date": expense.get("date", ""),
                "due": expense.get("due") or expense.get("date", ""),
                "amount": round_money(expense.get("amount", 0)),
                "paid": summary["paid"],
                "remaining": summary["remaining"],
                "currency": expense.get("currency", "THB"),
                "status": expense.get("status", "pending"),
                "paymentStatus": summary["status"],
                "category": expense.get("category", ""),
                "linkedDocumentIds": deepcopy(expense.get("linkedDocumentIds", [])),
                "sourceDocumentId": expense.get("sourceDocumentId", ""),
            }
        )

    for receive in _db().get("receives", []):
        if str(receive.get("status", "pending")).lower() in {"draft", "cancelled", "void"}:
            continue
        summary = _payment_summary_for_amount(round_money(receive.get("amount", 0)), receive.get("paymentSummary"))
        if summary["remaining"] <= 0:
            continue
        rows.append(
            {
                "id": receive["id"],
                "sourceType": "receive",
                "vendor": receive.get("vendor") or receive.get("receivedFrom", ""),
                "date": receive.get("date", ""),
                "due": receive.get("due") or receive.get("date", ""),
                "amount": round_money(receive.get("amount", 0)),
                "paid": summary["paid"],
                "remaining": summary["remaining"],
                "currency": receive.get("currency", "THB"),
                "status": receive.get("status", "pending"),
                "paymentStatus": summary["status"],
                "linkedDocumentIds": deepcopy(receive.get("linkedDocumentIds", [])),
                "sourceDocumentId": receive.get("sourceDocumentId", ""),
            }
        )

    return sorted(rows, key=lambda row: (row["date"], row["id"]), reverse=True)


def list_payments() -> list[dict[str, Any]]:
    return deepcopy(_db().get("payments", []))


def list_withholding_tax_documents() -> list[dict[str, Any]]:
    return deepcopy(_db().get("withholdingTaxDocuments", []))


def list_customers() -> list[dict[str, Any]]:
    return deepcopy(_db().get("customers", []))


def list_vendors() -> list[dict[str, Any]]:
    return deepcopy(_db().get("vendors", []))


def list_products() -> list[dict[str, Any]]:
    return deepcopy(_db().get("products", []))


def list_inventory_snapshot() -> list[dict[str, Any]]:
    inventory_rows, _ = _inventory_views(_db())
    return deepcopy(inventory_rows)


def list_inventory_movements(sku: str | None = None) -> list[dict[str, Any]]:
    _, movement_rows = _inventory_views(_db())
    normalized_sku = str(sku or "").strip().lower()
    if normalized_sku:
        return [deepcopy(row) for row in movement_rows if str(row.get("sku", "")).strip().lower() == normalized_sku]
    return deepcopy(movement_rows)


def adjust_inventory_stock(payload: dict[str, Any]) -> dict[str, Any]:
    def mutator(data: dict[str, Any]) -> dict[str, Any]:
        sku = str(payload.get("sku", "")).strip()
        adjustment_type = str(payload.get("adjustmentType", "") or "").strip().lower()
        qty = _round_quantity(payload.get("qty", 0))
        effective_date = str(payload.get("effectiveDate") or datetime.now().strftime("%Y-%m-%d")).strip()
        reason = str(payload.get("reason", "")).strip()
        notes = str(payload.get("notes", "")).strip()

        if adjustment_type not in {"increase", "decrease"}:
            raise ValueError("Adjustment type must be increase or decrease.")
        if not sku:
            raise ValueError("SKU is required.")
        if qty <= 0:
            raise ValueError("Adjustment qty must be greater than zero.")
        if not reason:
            raise ValueError("Adjustment reason is required.")

        product = next((item for item in data.get("products", []) if item.get("sku") == sku), None)
        if not product:
            raise ValueError("Product not found.")
        if _normalize_product_type(product.get("productType") or product.get("type")) != "stock-counted":
            raise ValueError("Only stock-counted products can be adjusted.")

        inventory_rows, _ = _inventory_views(data)
        inventory_row = next((item for item in inventory_rows if item["sku"] == sku), None)
        current_qty = float(inventory_row["currentQty"]) if inventory_row else float(product.get("stock", 0) or 0)
        if adjustment_type == "decrease" and current_qty - qty < 0:
            raise ValueError("Adjustment cannot reduce stock below zero.")

        movement = _normalize_inventory_movement(
            {
                "id": _inventory_movement_number(data),
                "sku": sku,
                "productName": product.get("name", ""),
                "sourceType": "manual_adjustment",
                "sourceDocumentId": sku,
                "sourceLabel": "Manual adjustment",
                "direction": "in" if adjustment_type == "increase" else "out",
                "qty": qty,
                "unitCost": inventory_row["averageCost"] if inventory_row else product.get("openingCost", 0),
                "effectiveDate": effective_date,
                "reason": reason,
                "notes": notes,
            }
        )
        data.setdefault("inventoryMovements", []).append(movement)
        _sync_inventory_products(data)
        refreshed_inventory = next((item for item in _inventory_views(data)[0] if item["sku"] == sku), None)
        _push_activity(
            data,
            "Inventory",
            f"{adjustment_type} stock for {sku}",
            "inventory",
            qty,
        )
        return {
            "movement": deepcopy(movement),
            "inventoryItem": deepcopy(refreshed_inventory),
        }

    return _mutate(mutator)


def preview_import(mode: str, file_storage: FileStorage) -> dict[str, Any]:
    data = _db()
    contact_codes = {
        str(item.get("id", "")).strip().lower()
        for collection in ("customers", "vendors")
        for item in data.get(collection, [])
    }
    product_skus = {str(item.get("sku", "")).strip().lower() for item in data.get("products", [])}
    invoice_ids = {str(item.get("id", "")).strip().lower() for item in data.get("invoices", [])}
    customer_codes = {str(item.get("id", "")).strip().lower() for item in data.get("customers", [])}
    return preview_import_file(
        mode,
        file_storage,
        existing_contact_codes=contact_codes,
        existing_product_skus=product_skus,
        existing_invoice_ids=invoice_ids,
        existing_customer_codes=customer_codes,
    )


def confirm_import(mode: str, rows: list[dict[str, Any]]) -> dict[str, Any]:
    def mutator(data: dict[str, Any]) -> dict[str, Any]:
        validated = revalidate_import_rows(
            mode,
            rows,
            existing_contact_codes={
                str(item.get("id", "")).strip().lower()
                for collection in ("customers", "vendors")
                for item in data.get(collection, [])
            },
            existing_product_skus={str(item.get("sku", "")).strip().lower() for item in data.get("products", [])},
            existing_invoice_ids={str(item.get("id", "")).strip().lower() for item in data.get("invoices", [])},
            existing_customer_codes={str(item.get("id", "")).strip().lower() for item in data.get("customers", [])},
        )
        invalid_rows = [row for row in validated["rows"] if not row["valid"]]
        if invalid_rows:
            raise ValueError("Resolve invalid rows before confirming the import.")

        imported_ids: list[str] = []
        extra_ids: list[str] = []
        batch_number = next_counter(data, "importBatch", 1)
        batch_label = f"IMP-{datetime.now().strftime('%Y')}-{batch_number:04d}"

        if mode == "contacts":
            for row in validated["rows"]:
                mapped = row["mapped"]
                record = _normalize_contact_record(
                    {
                        "id": mapped["code"],
                        "name": mapped["name"],
                        "contact": mapped["contactPerson"],
                        "email": mapped["email"],
                        "phone": mapped["phone"],
                        "taxId": mapped["taxId"],
                        "address": mapped["address"],
                        "status": mapped["status"],
                        "balance": 0,
                    },
                    prefix="C-000",
                )
                collection_key = "vendors" if mapped["contactType"] == "vendor" else "customers"
                data.setdefault(collection_key, []).insert(0, record)
                imported_ids.append(record["id"])
            _push_activity(data, "Import", f"imported {len(imported_ids)} contacts via {batch_label}", "import")
        elif mode == "products":
            for row in validated["rows"]:
                mapped = row["mapped"]
                record = _normalize_product_record(
                    {
                        "sku": mapped["sku"],
                        "name": mapped["name"],
                        "productType": mapped["productType"],
                        "type": _humanize_product_type(mapped["productType"]),
                        "price": mapped["salePrice"],
                        "stock": mapped["openingQty"] if mapped["productType"] == "stock-counted" else None,
                        "status": mapped["status"],
                        "openingStockQty": mapped["openingQty"] if mapped["productType"] == "stock-counted" else 0,
                        "openingCost": mapped["openingUnitCost"] if mapped["productType"] == "stock-counted" else 0,
                        "openingDate": mapped["openingDate"] if mapped["productType"] == "stock-counted" else "",
                    }
                )
                data.setdefault("products", []).insert(0, record)
                imported_ids.append(record["sku"])
            _sync_inventory_products(data)
            _push_activity(data, "Import", f"imported {len(imported_ids)} products via {batch_label}", "import")
        elif mode == "sales_documents":
            grouped_rows: dict[str, list[dict[str, Any]]] = {}
            for row in validated["rows"]:
                grouped_rows.setdefault(row["mapped"]["documentNumber"], []).append(row["mapped"])

            for document_number, mapped_rows in grouped_rows.items():
                header = mapped_rows[0]
                customer_record = next(
                    (
                        item
                        for item in data.get("customers", [])
                        if str(item.get("id", "")).strip().lower() == str(header.get("customerCode", "")).strip().lower()
                    ),
                    None,
                )
                customer_name = header.get("customerName") or (customer_record.get("name", "") if customer_record else "")
                invoice_record = _build_document_record(
                    "invoice",
                    {
                        "id": document_number,
                        "number": document_number,
                        "customer": customer_name or header.get("customerCode", ""),
                        "date": header.get("documentDate"),
                        "due": header.get("dueDate"),
                        "reference": header.get("reference"),
                        "currency": header.get("currency", "THB"),
                        "notes": header.get("notes", ""),
                        "status": header.get("status", "pending"),
                        "lines": [
                            {
                                "id": f"{document_number}-{index + 1}",
                                "desc": row["lineDescription"],
                                "qty": row["qty"],
                                "price": row["unitPrice"],
                                "tax": row["taxRate"],
                            }
                            for index, row in enumerate(mapped_rows)
                        ],
                    },
                )
                invoice_record["id"] = document_number
                data.setdefault("invoices", []).insert(0, invoice_record)
                imported_ids.append(invoice_record["id"])
                _push_activity(
                    data,
                    customer_name or "Import",
                    f"imported {invoice_record['id']}",
                    "invoice",
                    invoice_record.get("amount"),
                )
                _reconcile_inventory_for_document(data, kind="invoice", record=invoice_record)

                if header.get("recordPayment"):
                    receipt_record = _build_document_record(
                        "receipt",
                        {
                            "customer": customer_name or header.get("customerCode", ""),
                            "date": header.get("paymentDate") or header.get("documentDate"),
                            "status": "paid",
                            "paymentMethod": header.get("paymentMethod", "Cash"),
                            "relatedInvoice": invoice_record["id"],
                            "amount": invoice_record["amount"],
                            "notes": f"Imported cash sale for {invoice_record['id']}",
                            "sourceDocumentId": invoice_record["id"],
                            "sourceDocumentType": "invoice",
                        },
                    )
                    receipt_record["id"] = _document_number(data, "receipt", receipt_record.get("date"))
                    receipt_record.setdefault("linkedDocumentIds", []).append(invoice_record["id"])
                    data.setdefault("receipts", []).insert(0, receipt_record)
                    invoice_record["status"] = "paid"
                    invoice_record.setdefault("linkedDocumentIds", []).append(receipt_record["id"])
                    extra_ids.append(receipt_record["id"])
                    _push_activity(
                        data,
                        customer_name or "Import",
                        f"imported {receipt_record['id']}",
                        "receipt",
                        receipt_record.get("amount"),
                    )
            _sync_inventory_products(data)
        else:
            raise ValueError(f"Unsupported import mode: {mode}")

        return {
            "mode": mode,
            "batchId": batch_label,
            "importedCount": len(imported_ids),
            "secondaryCount": len(extra_ids),
            "importedIds": deepcopy(imported_ids),
            "secondaryIds": deepcopy(extra_ids),
            "summary": {
                "totalRows": len(validated["rows"]),
                "validRows": len(validated["rows"]),
                "invalidRows": 0,
            },
        }

    return _mutate(mutator)


def build_import_template(mode: str) -> dict[str, Any]:
    headers = build_template_rows(mode)
    fieldnames = list(headers[0].keys()) if headers else []
    path = build_generated_path(f"import-template-{mode}", "csv")
    with path.open("w", newline="", encoding="utf-8") as handle:
        if fieldnames:
            writer = csv.DictWriter(handle, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(headers)
        else:
            handle.write("template\n")

    return {
        "path": path,
        "download_name": f"{mode}-template.csv",
        "mimetype": "text/csv",
    }


def list_finance_accounts() -> list[dict[str, Any]]:
    return deepcopy(_db().get("financeAccounts", []))


def list_projects() -> list[dict[str, Any]]:
    return build_project_profitability_rows(_db())


def list_finance_account_movements(account_number: str | None = None) -> list[dict[str, Any]]:
    rows = build_account_movement_rows(_db())
    normalized_account_number = str(account_number or "").strip().lower()
    if normalized_account_number:
        return [
            deepcopy(row)
            for row in rows
            if str(row.get("accountNumber", "")).strip().lower() == normalized_account_number
        ]
    return deepcopy(rows)


def list_reports() -> list[dict[str, Any]]:
    return deepcopy(REPORT_GROUPS)


def get_accounting_overview() -> dict[str, Any]:
    data = _db()
    overview = build_accounting_overview(data)
    overview["linkedDocumentGraph"] = build_linked_document_graph(data)
    return overview


def list_journal_entries() -> list[dict[str, Any]]:
    return build_accounting_events(_db())


def get_report_data(report_key: str) -> list[dict[str, Any]]:
    return build_report_rows(_db(), report_key)


def list_top_customers_chart() -> list[dict[str, Any]]:
    return build_accounting_overview(_db())["topCustomersChart"]


def list_cash_flow() -> list[dict[str, Any]]:
    return build_accounting_overview(_db())["cashFlow"]


def list_recent_activity() -> list[dict[str, Any]]:
    return deepcopy(_db().get("recentActivity", []))


def list_document_summaries(kind: str) -> list[dict[str, Any]]:
    resolved = _kind_alias(kind)
    return deepcopy(_document_summaries(DOCUMENT_CONFIG[resolved]["key"], resolved))


def get_document(kind: str, document_id: str) -> dict[str, Any] | None:
    resolved = _kind_alias(kind)
    key = DOCUMENT_CONFIG[resolved]["key"]
    return deepcopy(next((item for item in _db().get(key, []) if item["id"] == document_id), None))


def _find_document_by_id(data: dict[str, Any], document_id: str) -> tuple[str, dict[str, Any]] | tuple[None, None]:
    for collection_name in DOCUMENT_COLLECTION_KEYS:
        item = next((row for row in data.get(collection_name, []) if row.get("id") == document_id), None)
        if item:
            return collection_name, item
    payment = next((row for row in data.get("payments", []) if row.get("id") == document_id), None)
    if payment:
        return "payments", payment
    return None, None


def _coerce_id_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, (list, tuple, set)):
        raw_values = value
    else:
        raw_values = [value]
    return [str(item) for item in raw_values if item]


def _workflow_record_for_kind(
    data: dict[str, Any],
    kind: str,
    document_id: str,
) -> tuple[str, str, dict[str, Any]] | tuple[None, None, None]:
    canonical_kind = canonical_document_kind(kind)
    if canonical_kind in {"supplier_payment", "advance_payment"}:
        payment = next((row for row in data.get("payments", []) if row.get("id") == document_id), None)
        return (canonical_kind, "payments", payment) if payment else (None, None, None)

    try:
        resolved = _kind_alias(kind)
    except ValueError:
        collection_name, record = _find_document_by_id(data, document_id)
        return (canonical_kind, collection_name, record) if record else (None, None, None)

    record = next((item for item in data.get(DOCUMENT_CONFIG[resolved]["key"], []) if item.get("id") == document_id), None)
    if record:
        return resolved, DOCUMENT_CONFIG[resolved]["key"], record
    collection_name, record = _find_document_by_id(data, document_id)
    return (resolved, collection_name, record) if record else (None, None, None)


APPROVAL_TRACKED_DOCUMENT_KINDS = {
    "quotation",
    "invoice",
    "receipt",
    "credit_note",
    "debit_note",
    "billing",
    "purchase_order",
    "receive",
    "expense",
}


def _document_actor_context(data: dict[str, Any], actor_email: str | None) -> dict[str, str]:
    normalized_email = str(actor_email or "").strip().lower()
    if not normalized_email:
        return {"email": "", "role": "employee"}
    users = data.get("settings", {}).get("users", {})
    member = next(
        (
            item
            for item in users.get("members", [])
            if str(item.get("email", "")).strip().lower() == normalized_email
        ),
        None,
    )
    role = "owner" if str((member or {}).get("role", "")).strip().lower() == "owner" else "employee"
    return {"email": normalized_email, "role": role}


def create_document(kind: str, payload: dict[str, Any], actor_email: str | None = None) -> dict[str, Any]:
    resolved = _kind_alias(kind)
    key = DOCUMENT_CONFIG[resolved]["key"]

    def mutator(data: dict[str, Any]) -> dict[str, Any]:
        record = _build_document_record(resolved, payload)
        record["id"] = payload.get("id") or payload.get("number") or _document_number(data, resolved, record.get("date"))
        source_ids = _coerce_id_list(payload.get("sourceDocumentIds")) or _coerce_id_list(
            [
                payload.get("sourceDocumentId"),
                payload.get("relatedInvoice"),
                payload.get("relatedDocument"),
                payload.get("relatedPurchaseOrderId"),
                payload.get("sourceBillingId"),
            ]
        )
        first_source = None
        for source_id in source_ids:
            _, maybe_source = _find_document_by_id(data, source_id)
            if maybe_source:
                first_source = maybe_source
                break
        normalize_workflow_fields(record, kind=resolved, source=first_source)
        if source_ids:
            record["sourceDocumentIds"] = list(dict.fromkeys([*record.get("sourceDocumentIds", []), *source_ids]))
        collection = data.setdefault(key, [])
        existing_index = next((index for index, item in enumerate(collection) if item.get("id") == record["id"]), None)
        if _document_number_exists(data, record["id"], exclude_key=key):
            raise ValueError("This document number already exists. Please use another number.")
        if existing_index is None:
            actor = _document_actor_context(data, actor_email)
            if actor["email"]:
                record["createdByEmail"] = actor["email"]
                record["createdByRole"] = actor["role"]
            if resolved in APPROVAL_TRACKED_DOCUMENT_KINDS and str(record.get("status", "")).lower() != "draft":
                record["approvalRequired"] = actor["role"] != "owner"
                record["approvalStatus"] = "approved" if actor["role"] == "owner" else "pending_owner_approval"
        if existing_index is None:
            collection.insert(0, record)
            action_label = "created"
        else:
            collection[existing_index] = {**collection[existing_index], **record}
            action_label = "updated"
        saved_record = collection[existing_index] if existing_index is not None else record
        normalize_workflow_fields(saved_record, kind=resolved, source=first_source)

        party = saved_record.get("customer") or saved_record.get("vendor") or saved_record.get("receivedFrom") or "System"
        _push_activity(data, party, f"{action_label} {saved_record['id']}", resolved, saved_record.get("amount"))

        if resolved == "receipt" and saved_record.get("relatedInvoice"):
            invoice = next((item for item in data.get("invoices", []) if item["id"] == saved_record["relatedInvoice"]), None)
            if invoice:
                invoice_amount = round_money(float(invoice.get("amount", 0) or 0))
                receipt_amount = round_money(float(saved_record.get("amount", 0) or 0))
                invoice["status"] = "paid" if receipt_amount >= invoice_amount else "partial"
                _push_activity(data, party, f"paid {invoice['id']}", "paid", min(receipt_amount, invoice_amount))

        if resolved in {"expense", "receive", "withholding_tax"}:
            source_document_id = (
                saved_record.get("sourceDocumentId")
                or saved_record.get("relatedDocument")
                or saved_record.get("relatedPurchaseOrderId")
            )
            if source_document_id:
                for collection_name in ("purchaseOrders", "receives", "expenses"):
                    source = next((item for item in data.get(collection_name, []) if item.get("id") == source_document_id), None)
                    if source:
                        source.setdefault("linkedDocumentIds", [])
                        if saved_record["id"] not in source["linkedDocumentIds"]:
                            source["linkedDocumentIds"].append(saved_record["id"])
                        break

        reference_ids = set()
        for key_name in ("sourceDocumentId", "relatedDocument", "relatedInvoice", "relatedPurchaseOrderId", "sourceBillingId"):
            value = saved_record.get(key_name)
            if value:
                reference_ids.add(str(value))
        for key_name in ("relatedDocumentIds", "linkedDocumentIds", "sourceInvoiceIds"):
            for value in saved_record.get(key_name, []) or []:
                if value and value != saved_record["id"]:
                    reference_ids.add(str(value))
        for reference in saved_record.get("referenceDocuments", []) or []:
            if isinstance(reference, dict) and reference.get("id"):
                reference_ids.add(str(reference["id"]))

        if reference_ids:
            for collection_name in DOCUMENT_COLLECTION_KEYS:
                for source in data.get(collection_name, []):
                    if source.get("id") in reference_ids:
                        apply_workflow_link(source, saved_record, "reference")
                        source.setdefault("convertedToIds", [])
                        if saved_record["id"] not in source["convertedToIds"]:
                            source["convertedToIds"].append(saved_record["id"])

        _reconcile_inventory_for_document(data, kind=resolved, record=saved_record)

        return deepcopy(saved_record)

    return _mutate(mutator)


def get_document_workflow_rules() -> dict[str, Any]:
    return workflow_rules_payload()


def get_document_next_actions(kind: str, document_id: str) -> dict[str, Any] | None:
    data = _db()
    resolved, _, record = _workflow_record_for_kind(data, kind, document_id)
    if not record:
        return None
    normalized = normalize_workflow_fields(deepcopy(record), kind=resolved)
    return {
        "documentId": normalized.get("id"),
        "kind": normalized.get("kind", resolved),
        "status": normalized.get("status", "draft"),
        "nextActions": build_next_document_actions(normalized, data),
    }


def validate_document_flow(kind: str, payload: dict[str, Any]) -> dict[str, Any]:
    source_kind = payload.get("sourceKind") or kind
    target_kind = payload.get("targetKind") or payload.get("kind") or kind
    mode = payload.get("workflowMode") or payload.get("mode") or "guided"
    override_reason = payload.get("overrideReason")
    return validate_document_transition(source_kind, target_kind, mode, override_reason)


def convert_document(kind: str, document_id: str, payload: dict[str, Any], actor_email: str | None = None) -> dict[str, Any]:
    data = _db()
    resolved, source_collection, source = _workflow_record_for_kind(data, kind, document_id)
    if not source:
        raise ValueError("Source document not found.")
    target_kind = payload.get("targetKind") or payload.get("kind")
    if not target_kind:
        raise ValueError("targetKind is required.")
    validation = validate_document_transition(
        source.get("kind") or resolved,
        target_kind,
        payload.get("workflowMode") or source.get("workflowMode") or "guided",
        payload.get("overrideReason"),
    )
    if not validation.get("valid"):
        raise ValueError((validation.get("warning") or {}).get("messageKey") or "Invalid document transition.")
    source_kind = source.get("kind") or resolved or kind
    converted_payload = {
        **deepcopy(source),
        **deepcopy(payload.get("overrides", {})),
        "id": payload.get("id"),
        "number": payload.get("number"),
        "sourceDocumentId": source.get("id"),
        "sourceDocumentIds": [source.get("id")],
        "convertedFromId": source.get("id"),
        "linkedDocumentIds": [source.get("id")],
        "workflowId": source.get("workflowId"),
        "workflowMode": payload.get("workflowMode") or source.get("workflowMode") or "guided",
        "overrideReason": payload.get("overrideReason"),
        "status": payload.get("status", "draft"),
    }
    target_kind_text = canonical_document_kind(str(target_kind))
    if target_kind_text == "tax_invoice":
        converted_payload["documentTypes"] = ["tax_invoice"]
        converted_payload["isTaxInvoice"] = True
        converted_payload["invoiceTaxType"] = "tax"
    elif target_kind_text in {"delivery_note", "goods_receive", "receive_inventory"}:
        converted_payload["documentTypes"] = [target_kind_text]
    elif target_kind_text in {"billing_note", "combined_billing_note"}:
        converted_payload["documentTypes"] = [target_kind_text]
    elif target_kind_text in {"deposit_invoice", "prepayment_tax_invoice"}:
        converted_payload["documentTypes"] = [target_kind_text]
    converted_payload.pop("createdByEmail", None)
    converted_payload.pop("createdByRole", None)
    if target_kind_text in {"supplier_payment", "advance_payment"}:
        created = create_payment(
            {
                **deepcopy(payload.get("overrides", {})),
                "vendor": source.get("vendor") or source.get("party") or source.get("customer") or "",
                "amount": converted_payload.get("amount", 0),
                "currency": converted_payload.get("currency", "THB"),
                "paymentDate": payload.get("paymentDate") or source.get("paymentDate") or source.get("date") or datetime.now().strftime("%Y-%m-%d"),
                "paymentMethod": payload.get("paymentMethod") or source.get("paymentMethod") or "Bank transfer",
                "allocations": [
                    {
                        "documentId": source.get("id"),
                        "documentType": source_kind,
                        "amount": converted_payload.get("amount", 0),
                    }
                ],
                "sourceDocumentIds": [source.get("id")],
            }
        )
    else:
        created = create_document(str(target_kind), converted_payload, actor_email=actor_email)

    def mutator(mutable_data: dict[str, Any]) -> dict[str, Any]:
        _, _, mutable_source = _workflow_record_for_kind(mutable_data, kind, document_id)
        _, mutable_target = _find_document_by_id(mutable_data, created["id"])
        if mutable_source and mutable_target:
            apply_workflow_link(mutable_source, mutable_target, "converted")
            mutable_source.setdefault("convertedToIds", [])
            if mutable_target["id"] not in mutable_source["convertedToIds"]:
                mutable_source["convertedToIds"].append(mutable_target["id"])
            mutable_target["convertedFromId"] = mutable_source["id"]
            normalize_workflow_fields(mutable_source, kind=resolved)
            normalize_workflow_fields(mutable_target, kind=str(target_kind), source=mutable_source)
            return deepcopy(mutable_target)
        return created

    return _mutate(mutator)


def link_document_records(kind: str, document_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    def mutator(data: dict[str, Any]) -> dict[str, Any] | None:
        resolved, _, source = _workflow_record_for_kind(data, kind, document_id)
        target_id = payload.get("targetDocumentId") or payload.get("documentId")
        if not source or not target_id:
            return None
        _, target = _find_document_by_id(data, str(target_id))
        if not target:
            return None
        apply_workflow_link(source, target, payload.get("relationType", "linked"))
        normalize_workflow_fields(source, kind=resolved)
        normalize_workflow_fields(target, source=source)
        return {"source": deepcopy(source), "target": deepcopy(target)}

    return _mutate(mutator)


def override_workflow_warning(kind: str, document_id: str, payload: dict[str, Any], actor_email: str | None = None) -> dict[str, Any] | None:
    reason = str(payload.get("overrideReason") or "").strip()
    if not reason:
        raise ValueError("overrideReason is required.")

    def mutator(data: dict[str, Any]) -> dict[str, Any] | None:
        resolved, _, record = _workflow_record_for_kind(data, kind, document_id)
        if not record:
            return None
        record["overrideReason"] = reason
        record["workflowMode"] = payload.get("workflowMode") or record.get("workflowMode") or "guided"
        record.setdefault("workflowOverrides", []).append(
            {
                "reason": reason,
                "user": actor_email or "",
                "time": datetime.now().isoformat(timespec="seconds"),
            }
        )
        normalize_workflow_fields(record, kind=resolved)
        return deepcopy(record)

    return _mutate(mutator)


def create_expense(payload: dict[str, Any]) -> dict[str, Any]:
    def mutator(data: dict[str, Any]) -> dict[str, Any]:
        record = _build_document_record("expense", payload)
        record["id"] = payload.get("id") or _document_number(data, "expense", record.get("date"))
        source_ids = _coerce_id_list(payload.get("sourceDocumentIds")) or _coerce_id_list(
            [payload.get("sourceDocumentId"), payload.get("relatedDocument"), payload.get("relatedPurchaseOrderId")]
        )
        first_source = None
        for source_id in source_ids:
            _, maybe_source = _find_document_by_id(data, source_id)
            if maybe_source:
                first_source = maybe_source
                break
        normalize_workflow_fields(record, kind="expense", source=first_source)
        if source_ids:
            record["sourceDocumentIds"] = list(dict.fromkeys([*record.get("sourceDocumentIds", []), *source_ids]))
        collection = data.setdefault("expenses", [])
        existing_index = next((index for index, item in enumerate(collection) if item.get("id") == record["id"]), None)
        if _document_number_exists(data, record["id"], exclude_key="expenses"):
            raise ValueError("This document number already exists. Please use another number.")
        if existing_index is None:
            collection.insert(0, record)
            saved = record
            action_label = "created"
        else:
            collection[existing_index] = {**collection[existing_index], **record}
            saved = collection[existing_index]
            action_label = "updated"
        reference_ids = {
            str(value)
            for key_name in ("sourceDocumentId", "relatedDocument", "relatedPurchaseOrderId")
            for value in [saved.get(key_name)]
            if value
        }
        for value in saved.get("relatedDocumentIds", []) or []:
            if value:
                reference_ids.add(str(value))
        for reference in saved.get("referenceDocuments", []) or []:
            if isinstance(reference, dict) and reference.get("id"):
                reference_ids.add(str(reference["id"]))
        for collection_name in DOCUMENT_COLLECTION_KEYS:
            for source in data.get(collection_name, []):
                if source.get("id") in reference_ids:
                    apply_workflow_link(source, saved, "reference")
        normalize_workflow_fields(saved, kind="expense", source=first_source)
        _push_activity(data, saved.get("vendor") or "System", f"{action_label} {saved['id']}", "expense", saved.get("amount"))
        return deepcopy(saved)

    return _mutate(mutator)


def update_expense(expense_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    def mutator(data: dict[str, Any]) -> dict[str, Any] | None:
        collection = data.setdefault("expenses", [])
        existing = next((item for item in collection if item.get("id") == expense_id), None)
        if not existing:
            return None

        record = _build_document_record("expense", {**existing, **payload, "id": expense_id})
        existing.update(record)
        _push_activity(data, existing.get("vendor") or "System", f"updated {expense_id}", "expense", existing.get("amount"))
        return deepcopy(existing)

    return _mutate(mutator)


def create_withholding_tax_document(payload: dict[str, Any]) -> dict[str, Any]:
    def mutator(data: dict[str, Any]) -> dict[str, Any]:
        record = _build_document_record("withholding_tax", payload)
        record["id"] = payload.get("id") or _withholding_tax_number(data, record.get("date"))
        data.setdefault("withholdingTaxDocuments", []).insert(0, record)
        source_document_id = record.get("sourceDocumentId")
        if source_document_id:
            for collection_name in ("expenses", "receives"):
                source = next((item for item in data.get(collection_name, []) if item.get("id") == source_document_id), None)
                if source:
                    source.setdefault("linkedDocumentIds", [])
                    if record["id"] not in source["linkedDocumentIds"]:
                        source["linkedDocumentIds"].append(record["id"])
                    break
        _push_activity(data, record.get("vendor") or "System", f"created {record['id']}", "withholding_tax", record.get("amount"))
        return deepcopy(record)

    return _mutate(mutator)


def create_payment(payload: dict[str, Any]) -> dict[str, Any]:
    def mutator(data: dict[str, Any]) -> dict[str, Any]:
        payment_date = str(payload.get("paymentDate") or datetime.now().strftime("%Y-%m-%d"))
        payment_method = str(payload.get("paymentMethod") or "Bank transfer")
        cheque_date = str(payload.get("chequeDate") or "").strip()
        if payment_method.lower() == "cheque":
            valid, message = validate_cheque_date(
                cheque_date,
                payment_date_text=payment_date,
                deposit_date_text=str(payload.get("chequeDepositDate") or "").strip() or None,
                cut_date_text=str(payload.get("chequeCutDate") or "").strip() or None,
                cleared_date_text=str(payload.get("chequeClearedDate") or "").strip() or None,
            )
            if not valid:
                raise ValueError(message)

        allocations = deepcopy(payload.get("allocations", []))
        amount = round_money(float(payload.get("amount", 0) or 0))
        payment_id = payload.get("id") or _payment_number(data, payment_date)
        payment_record = {
            "id": payment_id,
            "vendor": payload.get("vendor", ""),
            "amount": amount,
            "currency": payload.get("currency", "THB"),
            "paymentDate": payment_date,
            "paymentMethod": payment_method,
            "paymentStatus": payload.get("paymentStatus", "paid"),
            "note": payload.get("note", ""),
            "accountName": payload.get("accountName", ""),
            "accountNumber": payload.get("accountNumber", ""),
            "chequeDate": cheque_date,
            "chequeCutDate": str(payload.get("chequeCutDate") or ""),
            "chequeDepositDate": str(payload.get("chequeDepositDate") or ""),
            "chequeClearedDate": str(payload.get("chequeClearedDate") or ""),
            "allocations": allocations,
            "sourceDocumentIds": [],
            "withholdingTaxEnabled": bool(payload.get("autoCreateWht")),
        }

        _apply_payment_allocations(data, payment_record, allocations)
        first_source = None
        if payment_record.get("sourceDocumentIds"):
            _, first_source = _find_document_by_id(data, payment_record["sourceDocumentIds"][0])
        normalize_workflow_fields(payment_record, kind="supplier_payment", source=first_source)
        data.setdefault("payments", []).insert(0, payment_record)

        related_wht = None
        if payload.get("autoCreateWht"):
            first_document_id = next((item.get("documentId") for item in allocations if item.get("documentId")), "")
            related_wht = _build_document_record(
                "withholding_tax",
                {
                    "sourceDocumentId": first_document_id,
                    "sourceDocumentType": next((item.get("documentType") for item in allocations if item.get("documentType")), "expense"),
                    "relatedExpenseId": first_document_id,
                    "relatedPaymentId": payment_id,
                    "vendor": payload.get("vendor", ""),
                    "incomeType": payload.get("incomeType", "service"),
                    "taxableAmount": payload.get("taxableAmount", amount),
                    "rate": payload.get("whtRate", 0),
                    "amount": payload.get("taxableAmount", amount)
                    * float(payload.get("whtRate", 0) or 0)
                    / (100 if float(payload.get("whtRate", 0) or 0) > 1 else 1),
                    "filingMonth": payload.get("filingMonth", payment_date[:7]),
                    "status": "pending",
                    "date": payment_date,
                },
            )
            related_wht["id"] = _withholding_tax_number(data, payment_date)
            data.setdefault("withholdingTaxDocuments", []).insert(0, related_wht)
            payment_record["withholdingTaxId"] = related_wht["id"]

            related_source = next(
                (
                    item
                    for collection_name in ("expenses", "receives")
                    for item in data.get(collection_name, [])
                    if item.get("id") == related_wht.get("sourceDocumentId")
                ),
                None,
            )
            if related_source:
                related_source.setdefault("linkedDocumentIds", [])
                if related_wht["id"] not in related_source["linkedDocumentIds"]:
                    related_source["linkedDocumentIds"].append(related_wht["id"])

        _push_activity(data, payment_record.get("vendor") or "System", f"recorded payment {payment_id}", "payment", amount)
        if related_wht:
            _push_activity(data, payment_record.get("vendor") or "System", f"generated {related_wht['id']}", "withholding_tax", related_wht.get("amount"))
        return deepcopy(payment_record)

    return _mutate(mutator)


def update_payment(payment_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    def mutator(data: dict[str, Any]) -> dict[str, Any] | None:
        payment = next((item for item in data.get("payments", []) if item.get("id") == payment_id), None)
        if not payment:
            return None

        next_payment_date = str(payload.get("paymentDate") or payment.get("paymentDate") or "")
        next_method = str(payload.get("paymentMethod") or payment.get("paymentMethod") or "")
        next_cheque_date = str(payload.get("chequeDate") or payment.get("chequeDate") or "").strip()
        if next_method.lower() == "cheque":
            valid, message = validate_cheque_date(
                next_cheque_date,
                payment_date_text=next_payment_date,
                deposit_date_text=str(payload.get("chequeDepositDate") or payment.get("chequeDepositDate") or "").strip() or None,
                cut_date_text=str(payload.get("chequeCutDate") or payment.get("chequeCutDate") or "").strip() or None,
                cleared_date_text=str(payload.get("chequeClearedDate") or payment.get("chequeClearedDate") or "").strip() or None,
            )
            if not valid:
                raise ValueError(message)

        payment.update(
            {
                "paymentDate": next_payment_date,
                "paymentMethod": next_method,
                "paymentStatus": payload.get("paymentStatus", payment.get("paymentStatus", "paid")),
                "note": payload.get("note", payment.get("note", "")),
                "accountName": payload.get("accountName", payment.get("accountName", "")),
                "accountNumber": payload.get("accountNumber", payment.get("accountNumber", "")),
                "chequeDate": next_cheque_date,
                "chequeCutDate": str(payload.get("chequeCutDate") or payment.get("chequeCutDate") or ""),
                "chequeDepositDate": str(payload.get("chequeDepositDate") or payment.get("chequeDepositDate") or ""),
                "chequeClearedDate": str(payload.get("chequeClearedDate") or payment.get("chequeClearedDate") or ""),
            }
        )

        for allocation in payment.get("allocations", []):
            collection_key = _allocation_target_collection(str(allocation.get("documentType") or ""))
            document_id = str(allocation.get("documentId") or "")
            if not collection_key or not document_id:
                continue
            target = next((item for item in data.get(collection_key, []) if item.get("id") == document_id), None)
            if not target:
                continue
            summary = _payment_summary_for_amount(round_money(target.get("amount", 0)), target.get("paymentSummary"))
            summary["lastPaymentDate"] = payment.get("paymentDate", "")
            summary["lastPaymentMethod"] = payment.get("paymentMethod", "")
            summary["lastPaymentId"] = payment_id
            target["paymentSummary"] = summary

        related_wht = next((item for item in data.get("withholdingTaxDocuments", []) if item.get("relatedPaymentId") == payment_id), None)
        if related_wht:
            related_wht["date"] = payment.get("paymentDate", related_wht.get("date", ""))
            related_wht["status"] = "approved" if payment.get("paymentStatus") == "paid" else related_wht.get("status", "pending")

        _push_activity(data, payment.get("vendor") or "System", f"updated payment {payment_id}", "payment", payment.get("amount"))
        return deepcopy(payment)

    return _mutate(mutator)


def create_customer(payload: dict[str, Any]) -> dict[str, Any]:
    def mutator(data: dict[str, Any]) -> dict[str, Any]:
        record = _normalize_contact_record(
            {
                **payload,
                "id": payload.get("id") or _customer_number(data),
                "name": payload.get("name", ""),
                "contact": payload.get("contact", ""),
                "email": payload.get("email", ""),
                "phone": payload.get("phone", ""),
                "taxId": payload.get("taxId", ""),
                "address": payload.get("address", ""),
                "balance": payload.get("balance", 0),
                "status": payload.get("status", "active"),
            },
            prefix="C-000",
        )
        data.setdefault("customers", []).insert(0, record)
        _push_activity(data, record["name"] or "System", f"created customer {record['id']}", "customer")
        return deepcopy(record)

    return _mutate(mutator)


def update_customer(customer_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    def mutator(data: dict[str, Any]) -> dict[str, Any] | None:
        customer = next((item for item in data.get("customers", []) if item["id"] == customer_id), None)
        if not customer:
            return None

        customer.update(
            _normalize_contact_record(
                {
                    **customer,
                    **payload,
                    "id": customer_id,
                },
                prefix="C-000",
            )
        )
        _push_activity(data, customer["name"] or "System", f"updated customer {customer_id}", "customer")
        return deepcopy(customer)

    return _mutate(mutator)


def create_vendor(payload: dict[str, Any]) -> dict[str, Any]:
    def mutator(data: dict[str, Any]) -> dict[str, Any]:
        record = _normalize_contact_record(
            {
                **payload,
                "id": payload.get("id") or _vendor_number(data),
                "name": payload.get("name", ""),
                "contact": payload.get("contact", ""),
                "email": payload.get("email", ""),
                "phone": payload.get("phone", ""),
                "taxId": payload.get("taxId", ""),
                "address": payload.get("address", ""),
                "balance": payload.get("balance", 0),
                "status": payload.get("status", "active"),
            },
            prefix="V-000",
        )
        data.setdefault("vendors", []).insert(0, record)
        _push_activity(data, record["name"] or "System", f"created vendor {record['id']}", "vendor")
        return deepcopy(record)

    return _mutate(mutator)


def update_vendor(vendor_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    def mutator(data: dict[str, Any]) -> dict[str, Any] | None:
        vendor = next((item for item in data.get("vendors", []) if item["id"] == vendor_id), None)
        if not vendor:
            return None

        vendor.update(
            _normalize_contact_record(
                {
                    **vendor,
                    **payload,
                    "id": vendor_id,
                },
                prefix="V-000",
            )
        )
        _push_activity(data, vendor["name"] or "System", f"updated vendor {vendor_id}", "vendor")
        return deepcopy(vendor)

    return _mutate(mutator)


def create_product(payload: dict[str, Any]) -> dict[str, Any]:
    def mutator(data: dict[str, Any]) -> dict[str, Any]:
        record = _normalize_product_record(
            {
                "sku": payload.get("sku") or _product_sku(data),
                "name": payload.get("name", ""),
                "productType": payload.get("productType", payload.get("type", "service")),
                "type": payload.get("type", ""),
                "price": payload.get("price", 0),
                "stock": payload.get("stock"),
                "status": payload.get("status", "active"),
                "openingStockQty": payload.get("openingStockQty", payload.get("stock", 0)),
                "openingCost": payload.get("openingCost", 0),
                "openingDate": payload.get("openingDate", ""),
            }
        )
        data.setdefault("products", []).insert(0, record)
        _sync_inventory_products(data)
        _push_activity(data, "Catalog", f"created product {record['sku']}", "product")
        saved = next((item for item in data.get("products", []) if item.get("sku") == record["sku"]), record)
        return deepcopy(saved)

    return _mutate(mutator)


def update_product(sku: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    def mutator(data: dict[str, Any]) -> dict[str, Any] | None:
        product = next((item for item in data.get("products", []) if item["sku"] == sku), None)
        if not product:
            return None

        product.update(
            _normalize_product_record(
                {
                    **product,
                    **payload,
                    "sku": sku,
                }
            )
        )
        _sync_inventory_products(data)
        _push_activity(data, "Catalog", f"updated product {sku}", "product")
        return deepcopy(product)

    return _mutate(mutator)


def create_finance_account(payload: dict[str, Any]) -> dict[str, Any]:
    def mutator(data: dict[str, Any]) -> dict[str, Any]:
        record = _normalize_account_record(
            {
                "name": payload.get("name", ""),
                "number": payload.get("number") or _account_number(data),
                "balance": payload.get("balance", 0),
                "primary": payload.get("primary", False),
                "accountType": payload.get("accountType", "bank"),
                "status": payload.get("status", "active"),
                "institution": payload.get("institution", ""),
                "currency": payload.get("currency", "THB"),
            }
        )
        if record["primary"]:
            for account in data.setdefault("financeAccounts", []):
                account["primary"] = False
        data.setdefault("financeAccounts", []).insert(0, record)
        _push_activity(data, "Finance", f"added account {record['name']}", "finance", record.get("balance"))
        return deepcopy(record)

    return _mutate(mutator)


def update_finance_account(account_number: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    def mutator(data: dict[str, Any]) -> dict[str, Any] | None:
        account = next((item for item in data.get("financeAccounts", []) if item["number"] == account_number), None)
        if not account:
            return None

        updated = _normalize_account_record(
            {
                **account,
                **payload,
                "number": account_number,
            }
        )
        if updated["primary"]:
            for existing in data.get("financeAccounts", []):
                existing["primary"] = False
        account.update(updated)
        _push_activity(data, "Finance", f"updated account {account_number}", "finance", account.get("balance"))
        return deepcopy(account)

    return _mutate(mutator)


def create_finance_movement(payload: dict[str, Any]) -> dict[str, Any]:
    def mutator(data: dict[str, Any]) -> dict[str, Any]:
        movement_type = str(payload.get("movementType", "transfer") or "transfer").strip().lower()
        amount = round_money(float(payload.get("amount", 0) or 0))
        movement_date = str(payload.get("date") or datetime.now().strftime("%Y-%m-%d")).strip()
        note = str(payload.get("note", "")).strip()

        source_account = _resolve_finance_account(
            data,
            account_number=payload.get("sourceAccountNumber"),
            account_name=payload.get("sourceAccountName"),
        )
        destination_account = _resolve_finance_account(
            data,
            account_number=payload.get("destinationAccountNumber"),
            account_name=payload.get("destinationAccountName"),
        )

        if movement_type not in {"top_up", "transfer"}:
            raise ValueError("Movement type must be top_up or transfer.")
        if amount <= 0:
            raise ValueError("Movement amount must be greater than zero.")
        if not source_account or not destination_account:
            raise ValueError("Source and destination accounts are required.")
        if source_account.get("number") == destination_account.get("number"):
            raise ValueError("Choose two different accounts for the movement.")
        if movement_type == "top_up" and destination_account.get("accountType") != "petty_cash":
            raise ValueError("Top ups must move funds into a petty cash account.")
        if source_account.get("currency", "THB") != destination_account.get("currency", "THB"):
            raise ValueError("Internal movements currently require matching account currencies.")

        if source_account.get("accountType") == "petty_cash" and round_money(source_account.get("balance", 0) - amount) < 0:
            raise ValueError("This movement would reduce petty cash below zero.")

        record = _normalize_finance_movement_record(
            {
                "id": payload.get("id") or _finance_movement_number(data, movement_date),
                "date": movement_date,
                "movementType": movement_type,
                "sourceAccountNumber": source_account.get("number", ""),
                "sourceAccountName": source_account.get("name", ""),
                "destinationAccountNumber": destination_account.get("number", ""),
                "destinationAccountName": destination_account.get("name", ""),
                "amount": amount,
                "currency": source_account.get("currency", "THB"),
                "note": note,
                "status": "posted",
            }
        )

        source_account["balance"] = round_money(float(source_account.get("balance", 0) or 0) - amount)
        destination_account["balance"] = round_money(float(destination_account.get("balance", 0) or 0) + amount)
        data.setdefault("financeMovements", []).insert(0, record)
        _push_activity(
            data,
            "Finance",
            f"{movement_type.replace('_', ' ')} {destination_account.get('name', '')} from {source_account.get('name', '')}",
            "finance",
            amount,
        )
        return deepcopy(record)

    return _mutate(mutator)


def create_project(payload: dict[str, Any]) -> dict[str, Any]:
    def mutator(data: dict[str, Any]) -> dict[str, Any]:
        record = _normalize_project_record(
            {
                "id": payload.get("id") or _project_number(data),
                "code": payload.get("code", ""),
                "name": payload.get("name", ""),
                "status": payload.get("status", "active"),
                "customer": payload.get("customer", ""),
                "description": payload.get("description", ""),
            }
        )
        if not record["name"]:
            raise ValueError("Project name is required.")
        if any(item.get("id") == record["id"] for item in data.get("projects", [])):
            raise ValueError("Project ID already exists.")
        if record["code"] and any(str(item.get("code", "")).strip().lower() == record["code"].lower() for item in data.get("projects", [])):
            raise ValueError("Project code must be unique.")

        data.setdefault("projects", []).insert(0, record)
        _push_activity(data, "Projects", f"created project {record['id']}", "project")
        return next((row for row in build_project_profitability_rows(data) if row.get("id") == record["id"]), deepcopy(record))

    return _mutate(mutator)


def update_project(project_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    def mutator(data: dict[str, Any]) -> dict[str, Any] | None:
        project = next((item for item in data.get("projects", []) if item.get("id") == project_id), None)
        if not project:
            return None

        next_record = _normalize_project_record(
            {
                **project,
                **payload,
                "id": project_id,
            }
        )
        if not next_record["name"]:
            raise ValueError("Project name is required.")
        if next_record["code"] and any(
            str(item.get("code", "")).strip().lower() == next_record["code"].lower()
            and item.get("id") != project_id
            for item in data.get("projects", [])
        ):
            raise ValueError("Project code must be unique.")

        project.update(next_record)
        _push_activity(data, "Projects", f"updated project {project_id}", "project")
        return next((row for row in build_project_profitability_rows(data) if row.get("id") == project_id), deepcopy(project))

    return _mutate(mutator)


def delete_project(project_id: str) -> bool:
    def mutator(data: dict[str, Any]) -> bool:
        linked_collections = (
            "invoices",
            "expenses",
            "receipts",
            "quotations",
            "billings",
            "creditNotes",
            "debitNotes",
            "purchaseOrders",
            "receives",
        )
        linked_count = sum(
            1
            for collection_name in linked_collections
            for item in data.get(collection_name, [])
            if str(item.get("projectId", "")).strip() == project_id
        )
        if linked_count:
            raise ValueError("This project is already linked to documents. Set it inactive instead of deleting it.")

        projects = data.setdefault("projects", [])
        initial_length = len(projects)
        data["projects"] = [item for item in projects if item.get("id") != project_id]
        deleted = len(data["projects"]) != initial_length
        if deleted:
            _push_activity(data, "Projects", f"deleted project {project_id}", "project")
        return deleted

    return _mutate(mutator)


def send_invoice(invoice_id: str) -> dict[str, Any] | None:
    def mutator(data: dict[str, Any]) -> dict[str, Any] | None:
        invoice = next((item for item in data.get("invoices", []) if item["id"] == invoice_id), None)
        if not invoice:
            return None
        invoice["status"] = "sent"
        _push_activity(data, "System", f"sent {invoice_id} to customer", "sent", invoice.get("amount"))
        return deepcopy(invoice)

    return _mutate(mutator)


def send_payment_reminders() -> dict[str, Any]:
    def mutator(data: dict[str, Any]) -> dict[str, Any]:
        candidates = [
            invoice
            for invoice in data.get("invoices", [])
            if invoice.get("status") in {"overdue", "partial", "sent", "pending"}
        ]
        count = len(candidates)
        _push_activity(data, "System", f"sent {count} payment reminder(s)", "reminder")
        return {"count": count}

    return _mutate(mutator)


def approve_expense(expense_id: str) -> dict[str, Any] | None:
    def mutator(data: dict[str, Any]) -> dict[str, Any] | None:
        expense = next((item for item in data.get("expenses", []) if item["id"] == expense_id), None)
        if not expense:
            return None
        expense["status"] = "approved"
        _push_activity(data, "Finance", f"approved {expense_id}", "approve", expense.get("amount"))
        return deepcopy(expense)

    return _mutate(mutator)


def list_attachments(entity_type: str, entity_id: str) -> list[dict[str, Any]]:
    return [
        deepcopy(item)
        for item in _db().get("attachments", [])
        if item.get("entityType") == entity_type and item.get("entityId") == entity_id
    ]


def delete_attachment(attachment_id: str) -> bool:
    def mutator(data: dict[str, Any]) -> bool:
        attachments = data.setdefault("attachments", [])
        attachment = next((item for item in attachments if item.get("id") == attachment_id), None)
        if not attachment:
            return False

        attachments[:] = [item for item in attachments if item.get("id") != attachment_id]
        entity_type = attachment.get("entityType")
        entity_id = attachment.get("entityId")
        parent_collections = {
            "invoice": "invoices",
            "expense": "expenses",
            "quotation": "quotations",
            "receipt": "receipts",
            "billing": "billings",
            "credit_note": "creditNotes",
            "debit_note": "debitNotes",
            "deposit": "deposits",
            "purchase_order": "purchaseOrders",
            "receive": "receives",
            "withholding_tax": "withholdingTaxDocuments",
        }
        collection_key = parent_collections.get(entity_type)
        if collection_key:
            parent_record = next((item for item in data.get(collection_key, []) if item.get("id") == entity_id), None)
            if parent_record is not None:
                parent_record["attachments"] = [
                    item for item in parent_record.get("attachments", []) if item != attachment_id
                ]
        _push_activity(data, "System", f"removed attachment {attachment_id}", "file")
        return True

    return _mutate(mutator)


def attach_files(
    entity_type: str,
    entity_id: str,
    files: list[FileStorage],
    *,
    category: str = "supporting-document",
    note: str = "",
    attached_by: str = "System",
    tags: list[str] | None = None,
) -> list[dict[str, Any]]:
    if not files:
        return []

    def mutator(data: dict[str, Any]) -> list[dict[str, Any]]:
        created: list[dict[str, Any]] = []
        tags_value = tags or []
        parent_collections = {
            "invoice": "invoices",
            "expense": "expenses",
            "quotation": "quotations",
            "receipt": "receipts",
            "billing": "billings",
            "credit_note": "creditNotes",
            "debit_note": "debitNotes",
            "deposit": "deposits",
            "purchase_order": "purchaseOrders",
            "receive": "receives",
            "withholding_tax": "withholdingTaxDocuments",
        }
        collection_key = parent_collections.get(entity_type)
        parent_record = None
        if collection_key:
            parent_record = next((item for item in data.get(collection_key, []) if item["id"] == entity_id), None)

        for file_storage in files:
            upload = save_upload(file_storage, f"{entity_type}-{entity_id}")
            attachment_id = f"ATT-{next_counter(data, 'attachment', 1):05d}"
            attachment = {
                "id": attachment_id,
                "entityType": entity_type,
                "entityId": entity_id,
                "name": file_storage.filename or attachment_id,
                "category": category,
                "note": note,
                "attachedBy": attached_by,
                "uploadedAt": datetime.now().strftime("%Y-%m-%d %H:%M"),
                "tags": tags_value,
                "downloadUrl": f"/api/files/{attachment_id}/download",
                **upload,
            }
            data.setdefault("attachments", []).insert(0, attachment)
            if parent_record is not None:
                parent_record.setdefault("attachments", []).append(attachment_id)
            created.append(deepcopy(attachment))

        _push_activity(data, attached_by, f"attached {len(created)} file(s) to {entity_id}", "file")
        return created

    return _mutate(mutator)


def get_settings_section(section: str) -> dict[str, Any]:
    if section not in SETTINGS_SECTIONS:
        raise ValueError(f"Unsupported settings section: {section}")
    return _setting_section(_db(), section)


def _is_company_vat_registered(settings: dict[str, Any]) -> bool:
    company = merge_settings_section("company", settings.get("company"))
    taxes = merge_settings_section("taxes", settings.get("taxes"))
    return company.get("vatRegistrationMode") != "not_registered" and bool(taxes.get("vatRegistered", True))


def _sanitize_document_settings_for_company(settings: dict[str, Any], documents: dict[str, Any]) -> dict[str, Any]:
    if _is_company_vat_registered(settings):
        return documents
    return {
        **documents,
        "taxMode": "exclusive",
        "perLineVat": False,
    }


def save_settings_section(section: str, payload: dict[str, Any]) -> dict[str, Any]:
    if section not in SETTINGS_SECTIONS:
        raise ValueError(f"Unsupported settings section: {section}")

    def mutator(data: dict[str, Any]) -> dict[str, Any]:
        settings = data.setdefault("settings", {})
        merged = merge_settings_section(section, payload)
        if section == "documents":
            merged = _sanitize_document_settings_for_company(settings, merged)
        settings[section] = merged
        if section == "company" and merged.get("vatRegistrationMode") == "not_registered":
            settings["documents"] = _sanitize_document_settings_for_company(
                settings,
                merge_settings_section("documents", settings.get("documents")),
            )
        _push_activity(data, "Settings", f"updated {section} settings", "settings")
        return deepcopy(merged)

    return _mutate(mutator)


def get_settings_user_by_email(email: str | None) -> dict[str, Any] | None:
    normalized_email = str(email or "").strip().lower()
    if not normalized_email:
        return None
    users = get_settings_section("users")
    for member in users.get("members", []):
        if str(member.get("email", "")).strip().lower() == normalized_email:
            return deepcopy(member)
    return None


def can_manage_users(email: str | None) -> bool:
    member = get_settings_user_by_email(email)
    role = str((member or {}).get("role", "")).strip().lower()
    return role == "owner"


def get_company_settings() -> dict[str, Any]:
    return get_settings_section("company")


def save_company_settings(payload: dict[str, Any]) -> dict[str, Any]:
    return save_settings_section("company", payload)


def save_branding_asset(asset_key: str, file_storage: FileStorage) -> dict[str, Any]:
    if asset_key not in BRANDING_ASSET_FIELDS:
        raise ValueError(f"Unsupported branding asset: {asset_key}")

    url_key, path_key, content_type_key = BRANDING_ASSET_FIELDS[asset_key]

    def mutator(data: dict[str, Any]) -> dict[str, Any]:
        upload = save_upload(file_storage, f"branding-{asset_key}")
        settings = data.setdefault("settings", {})
        branding = merge_settings_section("branding", settings.get("branding"))
        branding[url_key] = f"/api/settings/branding/assets/{asset_key}"
        branding[path_key] = upload["relativePath"]
        branding[content_type_key] = upload.get("contentType", "application/octet-stream")
        settings["branding"] = branding
        _push_activity(data, "Branding", f"uploaded {asset_key} asset", "settings")
        return deepcopy(branding)

    return _mutate(mutator)


def get_branding_asset(asset_key: str) -> dict[str, Any] | None:
    if asset_key not in BRANDING_ASSET_FIELDS:
        raise ValueError(f"Unsupported branding asset: {asset_key}")

    branding = _setting_section(_db(), "branding")
    _, path_key, content_type_key = BRANDING_ASSET_FIELDS[asset_key]
    relative_path = str(branding.get(path_key, "") or "").strip()
    if not relative_path:
        return None

    return {
        "path": resolve_storage_path(relative_path),
        "mimetype": branding.get(content_type_key, "application/octet-stream"),
    }


def get_attachment(attachment_id: str) -> dict[str, Any] | None:
    return deepcopy(next((item for item in _db().get("attachments", []) if item["id"] == attachment_id), None))


def build_attachment_download(attachment_id: str) -> dict[str, Any] | None:
    attachment = get_attachment(attachment_id)
    if not attachment:
        return None
    return {
        "path": resolve_storage_path(attachment["relativePath"]),
        "download_name": attachment["name"],
        "mimetype": attachment.get("contentType", "application/octet-stream"),
    }


def build_document_pdf(kind: str, document_id: str) -> dict[str, Any] | None:
    record = get_document(kind, document_id)
    if not record:
        return None

    resolved = _kind_alias(kind)
    path = build_generated_path(f"{resolved}-{document_id}", "pdf")
    generate_document_pdf(path, resolved, record)

    return {
        "path": path,
        "download_name": f"{document_id}.pdf",
        "mimetype": "application/pdf",
    }


def build_preview_document_pdf(kind: str, payload: dict[str, Any]) -> dict[str, Any]:
    resolved = _kind_alias(kind)
    document_number = str(payload.get("number") or payload.get("id") or f"{resolved}-preview").strip()
    record = deepcopy(payload)
    record["id"] = document_number
    path = build_generated_path(f"{resolved}-{document_number}-preview", "pdf")
    generate_document_pdf(path, resolved, record)

    document_title = str(payload.get("documentTitle") or payload.get("documentVariant") or resolved).strip()
    safe_title = "".join(char if char not in '\\/:*?"<>|' else "-" for char in document_title).strip("-") or "document"
    return {
        "path": path,
        "download_name": f"{document_number}-{safe_title}.pdf",
        "mimetype": "application/pdf",
    }


def build_preview_image_pdf(payload: dict[str, Any]) -> dict[str, Any]:
    images = payload.get("images") or []
    if not isinstance(images, list) or not all(isinstance(image, str) for image in images):
        raise ValueError("images must be a list of preview image data URLs.")

    raw_filename = str(payload.get("filename") or "document.pdf").strip() or "document.pdf"
    safe_filename = "".join(char if char not in '\\/:*?"<>|' else "-" for char in raw_filename).strip("-")
    if not safe_filename.lower().endswith(".pdf"):
        safe_filename = f"{safe_filename}.pdf"

    path = build_generated_path(Path(safe_filename).stem or "preview-image", "pdf")
    generate_pdf_from_preview_images(path, images)

    return {
        "path": path,
        "download_name": safe_filename,
        "mimetype": "application/pdf",
    }


def build_expense_receipt(expense_id: str) -> dict[str, Any] | None:
    expense = get_expense(expense_id)
    if not expense:
        return None

    receipt_lines = [
        {
            "id": "1",
            "desc": expense["category"],
            "qty": 1,
            "price": round_money(expense["amount"] / 1.07),
            "tax": 7,
        }
    ]
    totals = calculate_document_totals(receipt_lines, default_tax_rate=7, tax_mode=TaxMode.EXCLUSIVE)
    record = {
        "id": expense["id"],
        "vendor": expense["vendor"],
        "date": expense["date"],
        "status": expense["status"],
        "amount": expense["amount"],
        "currency": "THB",
        "subtotal": totals["subtotal"],
        "taxAmount": totals["taxAmount"],
        "notes": f"{expense['category']} expense receipt",
        "lines": [{**receipt_lines[0], "amount": totals["subtotal"]}],
    }
    path = build_generated_path(f"expense-{expense_id}", "pdf")
    generate_document_pdf(path, "expense receipt", record)
    return {
        "path": path,
        "download_name": f"{expense_id}-receipt.pdf",
        "mimetype": "application/pdf",
    }


def build_withholding_tax_download(document_id: str) -> dict[str, Any] | None:
    document = next(
        (item for item in _db().get("withholdingTaxDocuments", []) if item.get("id") == document_id),
        None,
    )
    if not document:
        return None

    path = build_generated_path(f"withholding-tax-{document_id}", "txt")
    lines = [
        f"Document ID: {document.get('id', '')}",
        f"Vendor: {document.get('vendor', '')}",
        f"Related Expense: {document.get('relatedExpenseId') or document.get('sourceDocumentId', '')}",
        f"Income Type: {document.get('incomeType', '')}",
        f"Taxable Amount: {round_money(document.get('taxableAmount', 0)):.2f}",
        f"WHT Rate: {round_money(float(document.get('rate', 0) or 0) * 100):.2f}%",
        f"WHT Amount: {round_money(document.get('amount', 0)):.2f}",
        f"Filing Month: {document.get('filingMonth', '')}",
        f"Status: {document.get('status', '')}",
    ]
    path.write_text("\n".join(lines), encoding="utf-8")
    return {
        "path": path,
        "download_name": f"{document_id}.txt",
        "mimetype": "text/plain",
    }


def build_resource_export(resource: str) -> dict[str, Any] | None:
    rows_map = {
        "invoices": list_invoices(),
        "expenses": list_expenses(),
        "quotations": list_document_summaries("quotation"),
        "receipts": list_document_summaries("receipt"),
        "billings": list_document_summaries("billing"),
        "credit-notes": list_document_summaries("credit_note"),
        "debit-notes": list_document_summaries("debit_note"),
        "deposits": list_document_summaries("deposit"),
        "purchase-orders": list_document_summaries("purchase_order"),
        "receives": list_document_summaries("receive"),
        "payments": list_payments(),
        "withholding-tax": list_withholding_tax_documents(),
        "customers": list_customers(),
        "vendors": list_vendors(),
        "products": list_products(),
        "inventory": list_inventory_snapshot(),
        "finance-accounts": list_finance_accounts(),
        "account-movements": list_finance_account_movements(),
        "projects": list_projects(),
    }
    rows = rows_map.get(resource)
    if rows is None:
        return None

    path = build_generated_path(resource, "csv")
    with path.open("w", newline="", encoding="utf-8") as handle:
        if rows:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)
        else:
            handle.write("id\n")

    return {
        "path": path,
        "download_name": f"{resource}.csv",
        "mimetype": "text/csv",
    }


def build_report_export(report_key: str) -> dict[str, Any] | None:
    try:
        rows = build_report_rows(_db(), report_key)
    except ValueError:
        return None

    path = build_generated_path(report_key, "csv")
    with path.open("w", newline="", encoding="utf-8") as handle:
        if rows:
            fieldnames: list[str] = []
            for row in rows:
                for key in row.keys():
                    if key not in fieldnames:
                        fieldnames.append(key)
            writer = csv.DictWriter(handle, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        else:
            handle.write("metric\n")

    return {
        "path": path,
        "download_name": f"{report_key}.csv",
        "mimetype": "text/csv",
    }


def get_bootstrap_data() -> dict[str, Any]:
    data = _db()
    overview = build_accounting_overview(data)
    inventory_rows, inventory_movements = _inventory_views(data)
    account_movements = build_account_movement_rows(data)
    vendor_balances: dict[str, float] = {}
    for payable in list_payables():
        vendor = str(payable.get("vendor", "")).strip()
        if not vendor:
            continue
        vendor_balances[vendor] = round_money(vendor_balances.get(vendor, 0) + float(payable.get("remaining", 0) or 0))
    return {
        "invoices": deepcopy(data.get("invoices", [])),
        "expenses": deepcopy(data.get("expenses", [])),
        "customers": deepcopy(data.get("customers", [])),
        "vendors": [
            {
                **vendor,
                "balance": vendor_balances.get(vendor.get("name", ""), round_money(vendor.get("balance", 0))),
            }
            for vendor in deepcopy(data.get("vendors", []))
        ],
        "products": deepcopy(data.get("products", [])),
        "inventory": deepcopy(inventory_rows),
        "inventoryMovements": deepcopy(inventory_movements),
        "quotations": [_summarize_document("quotation", item) for item in data.get("quotations", [])],
        "receipts": [_summarize_document("receipt", item) for item in data.get("receipts", [])],
        "billings": [_summarize_document("billing", item) for item in data.get("billings", [])],
        "creditNotes": [_summarize_document("credit_note", item) for item in data.get("creditNotes", [])],
        "debitNotes": [_summarize_document("debit_note", item) for item in data.get("debitNotes", [])],
        "deposits": [_summarize_document("deposit", item) for item in data.get("deposits", [])],
        "purchaseOrders": [_summarize_document("purchase_order", item) for item in data.get("purchaseOrders", [])],
        "receives": [_summarize_document("receive", item) for item in data.get("receives", [])],
        "vendorPayments": deepcopy(data.get("payments", [])),
        "withholdingTaxDocuments": deepcopy(data.get("withholdingTaxDocuments", [])),
        "topCustomersChart": overview["topCustomersChart"],
        "cashFlow": overview["cashFlow"],
        "recentActivity": deepcopy(data.get("recentActivity", [])),
        "financeAccounts": deepcopy(data.get("financeAccounts", [])),
        "accountMovements": deepcopy(account_movements),
        "projects": list_projects(),
        "reports": list_reports(),
        "dashboardSummary": overview["dashboardSummary"],
        "vatSummary": overview["vatSummary"],
        "receivablesAging": overview["receivablesAging"],
        "payablesAging": overview["payablesAging"],
        "linkedDocumentGraph": build_linked_document_graph(data),
        "cashMovements": overview["cashMovements"],
        "trialBalance": overview["trialBalance"],
        "profitAndLoss": overview["profitAndLoss"],
        "balanceSheet": overview["balanceSheet"],
        "financeSummary": overview["financeSummary"],
        "policySummary": overview["policySummary"],
        "currencySettings": _setting_section(data, "currency"),
    }

from __future__ import annotations

from collections import defaultdict
from copy import deepcopy
from datetime import date, datetime
from typing import Any

from ..domain import (
    AccountingEventType,
    DocumentType,
    TaxMode,
    build_accounting_event,
)
from .accounting_policy import build_policy_snapshot


REPORT_GROUPS = [
    {
        "cat": "Financial",
        "items": [
            {"key": "profit-and-loss", "name": "Profit & Loss", "desc": "Revenue, costs and net income", "icon": "TrendingUp"},
            {"key": "balance-sheet", "name": "Balance Sheet", "desc": "Assets, liabilities and equity", "icon": "FileBarChart"},
            {"key": "cash-flow", "name": "Cash Flow Statement", "desc": "Operating cash receipts and payments", "icon": "Wallet"},
            {"key": "trial-balance", "name": "Trial Balance", "desc": "Account totals for the period", "icon": "BarChart3"},
            {"key": "financial-account-movement", "name": "Financial Account Movement", "desc": "Channel-by-channel bank, cash, and gateway activity", "icon": "Wallet"},
        ],
    },
    {
        "cat": "Tax",
        "items": [
            {"key": "vat-summary", "name": "P.P.30 (VAT)", "desc": "Monthly VAT return summary", "icon": "Percent"},
            {"key": "tax-sell-summary", "name": "Tax Sell Summary", "desc": "Output VAT by sales document", "icon": "Receipt"},
            {"key": "tax-buy-summary", "name": "Tax Buy Summary", "desc": "Input VAT by purchase and expense document", "icon": "Receipt"},
            {"key": "withholding-tax", "name": "P.N.D.3 / P.N.D.53", "desc": "Withholding tax filings", "icon": "Receipt"},
        ],
    },
    {
        "cat": "Operational",
        "items": [
            {"key": "aging-receivables", "name": "Aging Receivables", "desc": "Outstanding invoices by bucket", "icon": "Receipt"},
            {"key": "aging-payables", "name": "Aging Payables", "desc": "Vendor expenses awaiting approval or payment", "icon": "Wallet"},
            {"key": "receipt-payment-register", "name": "Receipt / Payment Register", "desc": "Incoming and outgoing settlement activity", "icon": "Wallet"},
            {"key": "petty-cash-movement", "name": "Petty Cash Movement", "desc": "Top ups, transfers, and direct petty cash spending", "icon": "Wallet"},
            {"key": "cheque-summary", "name": "Cheque Summary", "desc": "Cheque payment lifecycle monitoring", "icon": "Receipt"},
            {"key": "sales-documents", "name": "Sales Documents", "desc": "Sales-side document register by module", "icon": "Users"},
            {"key": "purchase-documents", "name": "Purchase Documents", "desc": "Purchase-side document register by module", "icon": "Wallet"},
            {"key": "customer-statements", "name": "Customer Statements", "desc": "Per-customer invoice and receipt activity", "icon": "Users"},
            {"key": "inventory-valuation", "name": "Inventory Valuation", "desc": "Stock value based on current catalog balances", "icon": "Package"},
            {"key": "inventory-movement", "name": "Inventory Movement", "desc": "Movement log with quantities and balances", "icon": "Package"},
        ],
    },
    {
        "cat": "Projects",
        "items": [
            {"key": "project-profitability", "name": "Project Profitability", "desc": "Revenue, cost, and margin by project", "icon": "TrendingUp"},
        ],
    },
]


def _round_money(value: Any) -> float:
    return round(float(value or 0), 2)


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value).date()
    except ValueError:
        return None


def _today(data: dict[str, Any]) -> date:
    dates: list[date] = []
    for collection_name in ("invoices", "expenses", "receipts", "receives"):
        for record in data.get(collection_name, []):
            parsed = _parse_date(record.get("date"))
            if parsed is not None:
                dates.append(parsed)
    return max(dates) if dates else date.today()


def _month_label(value: date) -> str:
    return value.strftime("%b")


def _month_key(value: date) -> str:
    return value.strftime("%Y-%m")


def _last_n_months(anchor: date, count: int) -> list[date]:
    months: list[date] = []
    year = anchor.year
    month = anchor.month
    for offset in range(count - 1, -1, -1):
        current_month = month - offset
        current_year = year
        while current_month <= 0:
            current_month += 12
            current_year -= 1
        months.append(date(current_year, current_month, 1))
    return months


def _account_for_payment_method(payment_method: str | None, finance_accounts: list[dict[str, Any]]) -> str:
    normalized = (payment_method or "").strip().lower()
    if "cash" in normalized:
        petty_cash = next(
            (
                account
                for account in finance_accounts
                if "petty" in account.get("name", "").lower() or "cash" in account.get("number", "").lower()
            ),
            None,
        )
        if petty_cash:
            return petty_cash["name"]
        return "Petty Cash"

    primary = next((account for account in finance_accounts if account.get("primary")), None)
    if primary:
        return primary["name"]
    if finance_accounts:
        return finance_accounts[0]["name"]
    return "Cash & Cash Equivalents"


def _account_by_reference(
    finance_accounts: list[dict[str, Any]],
    *,
    account_name: str | None = None,
    account_number: str | None = None,
) -> dict[str, Any] | None:
    normalized_number = str(account_number or "").strip().lower()
    normalized_name = str(account_name or "").strip().lower()
    if normalized_number:
        match = next(
            (
                account
                for account in finance_accounts
                if str(account.get("number", "")).strip().lower() == normalized_number
            ),
            None,
        )
        if match:
            return match

    if normalized_name:
        return next(
            (
                account
                for account in finance_accounts
                if str(account.get("name", "")).strip().lower() == normalized_name
            ),
            None,
        )
    return None


def _resolve_cash_account_name(
    payment_method: str | None,
    finance_accounts: list[dict[str, Any]],
    *,
    account_name: str | None = None,
    account_number: str | None = None,
) -> str:
    matched = _account_by_reference(
        finance_accounts,
        account_name=account_name,
        account_number=account_number,
    )
    if matched:
        return str(matched.get("name", "")).strip() or _account_for_payment_method(payment_method, finance_accounts)
    return _account_for_payment_method(payment_method, finance_accounts)


def _resolve_cash_account_record(
    payment_method: str | None,
    finance_accounts: list[dict[str, Any]],
    *,
    account_name: str | None = None,
    account_number: str | None = None,
) -> dict[str, Any]:
    matched = _account_by_reference(
        finance_accounts,
        account_name=account_name,
        account_number=account_number,
    )
    if matched:
        return matched

    resolved_name = _account_for_payment_method(payment_method, finance_accounts)
    fallback = next(
        (
            account
            for account in finance_accounts
            if str(account.get("name", "")).strip() == resolved_name
        ),
        None,
    )
    return fallback or {
        "name": resolved_name,
        "number": resolved_name,
        "accountType": "petty_cash" if "cash" in resolved_name.lower() else "bank",
        "currency": "THB",
        "status": "active",
    }


def _source_route_for_type(source_type: str, source_id: str) -> str:
    mapping = {
        "invoice": f"/sales/invoices/{source_id}",
        "receipt": "/sales/receipts",
        "quotation": "/sales/quotations",
        "billing": "/sales/billing",
        "credit_note": "/sales/credit-notes",
        "debit_note": "/sales/debit-notes",
        "purchase_order": "/purchases/orders",
        "receive": "/purchases/received",
        "expense": f"/purchases/expenses/{source_id}",
        "payment": "/purchases/payments",
        "withholding_tax": "/purchases/wht",
        "finance_movement": "/finance/cash",
    }
    return mapping.get(source_type, "/reports")


def _journal_type_for_source(source_type: str) -> str:
    mapping = {
        "invoice": "SV",
        "receipt": "RV",
        "expense": "PV",
        "receive": "UV",
        "payment": "PV",
        "finance_movement": "JV",
    }
    return mapping.get(source_type, "JV")


def _rule_explanation_for_source(source_type: str) -> str:
    mapping = {
        "invoice": "Sales invoices debit Accounts Receivable and credit Sales Revenue plus Output VAT.",
        "receipt": "Receipts debit the selected bank or cash channel and clear Accounts Receivable.",
        "expense": "Approved expenses debit the expense category and Input VAT, then credit the payment channel.",
        "receive": "Receive records follow the current goods-received posting policy and flow through UV when posted.",
        "payment": "Vendor payments clear payable balances against the selected financial channel.",
        "finance_movement": "Internal top ups and transfers reclassify balances between finance accounts through JV.",
    }
    return mapping.get(source_type, "Shared accounting-event rules generated this journal row.")


def _project_lookup(data: dict[str, Any]) -> tuple[dict[str, dict[str, Any]], dict[str, str]]:
    by_id: dict[str, dict[str, Any]] = {}
    name_lookup: dict[str, str] = {}
    for project in data.get("projects", []):
        project_id = str(project.get("id", "")).strip()
        if not project_id:
            continue
        by_id[project_id] = project
        for candidate in (
            project_id,
            project.get("code", ""),
            project.get("name", ""),
        ):
            label = str(candidate or "").strip().lower()
            if label:
                name_lookup[label] = project_id
    return by_id, name_lookup


def _document_project_id(record: dict[str, Any], project_name_lookup: dict[str, str]) -> str:
    direct = str(record.get("projectId") or record.get("project_id") or "").strip()
    if direct:
        return direct

    for candidate in (
        record.get("projectName"),
        record.get("project"),
        record.get("department"),
    ):
        normalized = str(candidate or "").strip().lower()
        if normalized and normalized in project_name_lookup:
            return project_name_lookup[normalized]
    return ""


def _max_date(current: str, candidate: str) -> str:
    if not current:
        return candidate
    if not candidate:
        return current
    return max(current, candidate)


def _account_movement_row(
    *,
    movement_id: str,
    date_text: str,
    account: dict[str, Any],
    direction: str,
    amount: float,
    source_type: str,
    source_id: str,
    movement_type: str,
    memo: str,
    counterparty: str = "",
    counter_account_name: str = "",
    status: str = "posted",
) -> dict[str, Any]:
    return {
        "id": movement_id,
        "date": date_text,
        "accountNumber": str(account.get("number", "")).strip(),
        "accountName": str(account.get("name", "")).strip(),
        "accountType": str(account.get("accountType", "bank") or "bank").strip(),
        "accountStatus": str(account.get("status", "active") or "active").strip(),
        "currency": str(account.get("currency", "THB") or "THB").strip(),
        "direction": "out" if direction == "out" else "in",
        "amount": _round_money(amount),
        "sourceType": source_type,
        "sourceId": source_id,
        "movementType": movement_type,
        "memo": memo,
        "counterparty": counterparty or counter_account_name,
        "counterAccountName": counter_account_name,
        "status": status,
        "sourceRoute": _source_route_for_type(source_type, source_id),
    }


def build_account_movement_rows(data: dict[str, Any]) -> list[dict[str, Any]]:
    finance_accounts = deepcopy(data.get("financeAccounts", []))
    rows: list[dict[str, Any]] = []

    for receipt in data.get("receipts", []):
        status = str(receipt.get("status", "draft")).lower()
        amount = _round_money(receipt.get("amount"))
        if status in {"draft", "cancelled", "void"} or amount <= 0:
            continue
        account = _resolve_cash_account_record(
            receipt.get("paymentMethod"),
            finance_accounts,
            account_name=receipt.get("accountName"),
            account_number=receipt.get("accountNumber"),
        )
        rows.append(
            _account_movement_row(
                movement_id=f"receipt-{receipt.get('id', '')}",
                date_text=receipt.get("date", ""),
                account=account,
                direction="in",
                amount=amount,
                source_type="receipt",
                source_id=receipt.get("id", ""),
                movement_type="receipt",
                memo=receipt.get("notes") or receipt.get("relatedInvoice") or "Customer receipt",
                counterparty=receipt.get("customer", ""),
                status=status,
            )
        )

    for payment in data.get("payments", []):
        status = str(payment.get("paymentStatus", "paid") or "paid").lower()
        amount = _round_money(payment.get("amount"))
        if status == "void" or amount <= 0:
            continue
        account = _resolve_cash_account_record(
            payment.get("paymentMethod"),
            finance_accounts,
            account_name=payment.get("accountName"),
            account_number=payment.get("accountNumber"),
        )
        rows.append(
            _account_movement_row(
                movement_id=f"payment-{payment.get('id', '')}",
                date_text=payment.get("paymentDate", ""),
                account=account,
                direction="out",
                amount=amount,
                source_type="payment",
                source_id=payment.get("id", ""),
                movement_type="payment",
                memo=payment.get("note") or "Vendor payment",
                counterparty=payment.get("vendor", ""),
                status=status,
            )
        )

    for expense in data.get("expenses", []):
        status = str(expense.get("status", "pending")).lower()
        amount = _round_money(expense.get("amount"))
        payment_summary = expense.get("paymentSummary") or {}
        if status != "approved" or amount <= 0 or payment_summary.get("lastPaymentId"):
            continue
        account = _resolve_cash_account_record(
            expense.get("paymentMethod"),
            finance_accounts,
        )
        rows.append(
            _account_movement_row(
                movement_id=f"expense-{expense.get('id', '')}",
                date_text=expense.get("date", ""),
                account=account,
                direction="out",
                amount=amount,
                source_type="expense",
                source_id=expense.get("id", ""),
                movement_type="expense",
                memo=expense.get("category") or "Approved expense",
                counterparty=expense.get("vendor", ""),
                status=status,
            )
        )

    for receive in data.get("receives", []):
        status = str(receive.get("status", "draft")).lower()
        amount = _round_money(receive.get("amount") or receive.get("netAmount"))
        if status in {"draft", "cancelled", "void"} or amount <= 0 or not receive.get("paymentMethod"):
            continue
        account = _resolve_cash_account_record(
            receive.get("paymentMethod"),
            finance_accounts,
            account_name=receive.get("accountName"),
            account_number=receive.get("accountNumber"),
        )
        rows.append(
            _account_movement_row(
                movement_id=f"receive-{receive.get('id', '')}",
                date_text=receive.get("date", ""),
                account=account,
                direction="in",
                amount=amount,
                source_type="receive",
                source_id=receive.get("id", ""),
                movement_type="receive",
                memo=receive.get("notes") or receive.get("relatedDocument") or "Receive entry",
                counterparty=receive.get("receivedFrom") or receive.get("vendor", ""),
                status=status,
            )
        )

    for movement in data.get("financeMovements", []):
        movement_id = str(movement.get("id", "")).strip()
        amount = _round_money(movement.get("amount"))
        if not movement_id or amount <= 0:
            continue

        source_account = _account_by_reference(
            finance_accounts,
            account_name=movement.get("sourceAccountName"),
            account_number=movement.get("sourceAccountNumber"),
        ) or {
            "name": movement.get("sourceAccountName", ""),
            "number": movement.get("sourceAccountNumber", ""),
            "accountType": "bank",
            "currency": movement.get("currency", "THB"),
            "status": "active",
        }
        destination_account = _account_by_reference(
            finance_accounts,
            account_name=movement.get("destinationAccountName"),
            account_number=movement.get("destinationAccountNumber"),
        ) or {
            "name": movement.get("destinationAccountName", ""),
            "number": movement.get("destinationAccountNumber", ""),
            "accountType": "petty_cash",
            "currency": movement.get("currency", "THB"),
            "status": "active",
        }

        rows.append(
            _account_movement_row(
                movement_id=f"{movement_id}-out",
                date_text=movement.get("date", ""),
                account=source_account,
                direction="out",
                amount=amount,
                source_type="finance_movement",
                source_id=movement_id,
                movement_type=movement.get("movementType", "transfer"),
                memo=movement.get("note") or "Internal finance transfer",
                counter_account_name=str(destination_account.get("name", "")).strip(),
                status=movement.get("status", "posted"),
            )
        )
        rows.append(
            _account_movement_row(
                movement_id=f"{movement_id}-in",
                date_text=movement.get("date", ""),
                account=destination_account,
                direction="in",
                amount=amount,
                source_type="finance_movement",
                source_id=movement_id,
                movement_type=movement.get("movementType", "transfer"),
                memo=movement.get("note") or "Internal finance transfer",
                counter_account_name=str(source_account.get("name", "")).strip(),
                status=movement.get("status", "posted"),
            )
        )

    rows.sort(key=lambda item: (item["date"], item["id"]), reverse=True)
    return rows


def build_project_profitability_rows(data: dict[str, Any]) -> list[dict[str, Any]]:
    projects = deepcopy(data.get("projects", []))
    if not projects:
        return []

    project_lookup, project_name_lookup = _project_lookup(data)
    metrics: dict[str, dict[str, Any]] = {
        str(project.get("id", "")).strip(): {
            "revenue": 0.0,
            "cost": 0.0,
            "documentCount": 0,
            "lastActivityDate": "",
        }
        for project in projects
        if str(project.get("id", "")).strip()
    }

    for invoice in data.get("invoices", []):
        status = str(invoice.get("status", "draft")).lower()
        project_id = _document_project_id(invoice, project_name_lookup)
        if status in {"draft", "cancelled", "void"} or not project_id or project_id not in metrics:
            continue
        bucket = metrics[project_id]
        bucket["revenue"] = _round_money(bucket["revenue"] + invoice.get("amount"))
        bucket["documentCount"] += 1
        bucket["lastActivityDate"] = _max_date(bucket["lastActivityDate"], str(invoice.get("date", "")))

    for expense in data.get("expenses", []):
        status = str(expense.get("status", "draft")).lower()
        project_id = _document_project_id(expense, project_name_lookup)
        if status in {"draft", "cancelled", "void"} or not project_id or project_id not in metrics:
            continue
        bucket = metrics[project_id]
        bucket["cost"] = _round_money(bucket["cost"] + expense.get("amount"))
        bucket["documentCount"] += 1
        bucket["lastActivityDate"] = _max_date(bucket["lastActivityDate"], str(expense.get("date", "")))

    rows: list[dict[str, Any]] = []
    for project in projects:
        project_id = str(project.get("id", "")).strip()
        bucket = metrics.get(project_id, {"revenue": 0.0, "cost": 0.0, "documentCount": 0, "lastActivityDate": ""})
        revenue = _round_money(bucket["revenue"])
        cost = _round_money(bucket["cost"])
        profit = _round_money(revenue - cost)
        margin = _round_money((profit / revenue) * 100) if revenue else 0.0
        rows.append(
            {
                "id": project_id,
                "code": str(project.get("code", "")).strip(),
                "name": str(project.get("name", "")).strip(),
                "status": str(project.get("status", "active") or "active").strip(),
                "customer": str(project.get("customer", "")).strip(),
                "description": str(project.get("description", "")).strip(),
                "revenue": revenue,
                "cost": cost,
                "profit": profit,
                "margin": margin,
                "documentCount": int(bucket["documentCount"]),
                "lastActivityDate": bucket["lastActivityDate"],
            }
        )
    rows.sort(key=lambda item: (item["profit"], item["name"]), reverse=True)
    return rows


def build_receipt_payment_rows(data: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    finance_accounts = deepcopy(data.get("financeAccounts", []))

    for receipt in data.get("receipts", []):
        status = str(receipt.get("status", "draft")).lower()
        amount = _round_money(receipt.get("amount"))
        if status in {"draft", "cancelled", "void"} or amount <= 0:
            continue
        rows.append(
            {
                "date": receipt.get("date", ""),
                "direction": "receipt",
                "documentId": receipt.get("id", ""),
                "relatedDocumentId": receipt.get("relatedInvoice", ""),
                "counterparty": receipt.get("customer", ""),
                "account": _resolve_cash_account_name(
                    receipt.get("paymentMethod"),
                    finance_accounts,
                    account_name=receipt.get("accountName"),
                    account_number=receipt.get("accountNumber"),
                ),
                "paymentMethod": receipt.get("paymentMethod", ""),
                "amount": amount,
                "currency": receipt.get("currency", "THB"),
                "status": status,
            }
        )

    for payment in data.get("payments", []):
        status = str(payment.get("paymentStatus", "paid") or "paid").lower()
        amount = _round_money(payment.get("amount"))
        if status == "void" or amount <= 0:
            continue
        rows.append(
            {
                "date": payment.get("paymentDate", ""),
                "direction": "payment",
                "documentId": payment.get("id", ""),
                "relatedDocumentId": ", ".join(payment.get("sourceDocumentIds", []) or []),
                "counterparty": payment.get("vendor", ""),
                "account": _resolve_cash_account_name(
                    payment.get("paymentMethod"),
                    finance_accounts,
                    account_name=payment.get("accountName"),
                    account_number=payment.get("accountNumber"),
                ),
                "paymentMethod": payment.get("paymentMethod", ""),
                "amount": amount,
                "currency": payment.get("currency", "THB"),
                "status": status,
            }
        )

    rows.sort(key=lambda item: (item["date"], item["documentId"]), reverse=True)
    return rows


def build_cheque_summary_rows(data: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    for payment in data.get("payments", []):
        if str(payment.get("paymentMethod", "")).strip().lower() != "cheque":
            continue
        rows.append(
            {
                "direction": "pay",
                "documentId": payment.get("id", ""),
                "counterparty": payment.get("vendor", ""),
                "account": payment.get("accountName", ""),
                "paymentDate": payment.get("paymentDate", ""),
                "chequeDate": payment.get("chequeDate", ""),
                "cutDate": payment.get("chequeCutDate", ""),
                "depositDate": payment.get("chequeDepositDate", ""),
                "clearedDate": payment.get("chequeClearedDate", ""),
                "amount": _round_money(payment.get("amount")),
                "status": payment.get("paymentStatus", ""),
            }
        )

    for receipt in data.get("receipts", []):
        if str(receipt.get("paymentMethod", "")).strip().lower() != "cheque":
            continue
        rows.append(
            {
                "direction": "receive",
                "documentId": receipt.get("id", ""),
                "counterparty": receipt.get("customer", ""),
                "account": receipt.get("accountName", ""),
                "paymentDate": receipt.get("date", ""),
                "chequeDate": receipt.get("chequeDate", ""),
                "cutDate": "",
                "depositDate": receipt.get("chequeDepositDate", ""),
                "clearedDate": receipt.get("chequeClearedDate", ""),
                "amount": _round_money(receipt.get("amount")),
                "status": receipt.get("status", ""),
            }
        )

    rows.sort(key=lambda item: (item["paymentDate"], item["documentId"]), reverse=True)
    return rows


def build_tax_summary_rows(data: dict[str, Any], summary_type: str) -> list[dict[str, Any]]:
    policy = build_policy_snapshot(data.get("settings"))
    rows: list[dict[str, Any]] = []

    if summary_type == "sell":
        for invoice in data.get("invoices", []):
            status = str(invoice.get("status", "draft")).lower()
            if status in {"draft", "cancelled", "void"}:
                continue
            subtotal, tax_amount, total = _invoice_breakdown(invoice, policy)
            rows.append(
                {
                    "date": invoice.get("date", ""),
                    "documentId": invoice.get("id", ""),
                    "party": invoice.get("customer", ""),
                    "taxPointDate": invoice.get("taxPointDate", ""),
                    "taxPointReason": invoice.get("taxPointReason", ""),
                    "vatReportingPeriod": invoice.get("vatReportingPeriod", ""),
                    "subtotal": subtotal,
                    "vatAmount": tax_amount,
                    "total": total,
                    "status": status,
                }
            )
    else:
        for expense in data.get("expenses", []):
            status = str(expense.get("status", "pending")).lower()
            if status in {"draft", "cancelled", "void"}:
                continue
            subtotal, tax_amount, total = _invoice_breakdown(expense, policy)
            rows.append(
                {
                    "date": expense.get("date", ""),
                    "documentId": expense.get("id", ""),
                    "party": expense.get("vendor", ""),
                    "taxPointDate": expense.get("taxPointDate", ""),
                    "taxPointReason": expense.get("taxPointReason", ""),
                    "vatReportingPeriod": expense.get("vatReportingPeriod", ""),
                    "subtotal": subtotal or total,
                    "vatAmount": tax_amount,
                    "total": total,
                    "status": status,
                }
            )

    rows.sort(key=lambda item: (item["date"], item["documentId"]), reverse=True)
    return rows


def build_document_module_rows(data: dict[str, Any], module_type: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if module_type == "sales":
        collections = [
            ("quotation", "quotations"),
            ("invoice", "invoices"),
            ("receipt", "receipts"),
            ("billing", "billings"),
            ("credit_note", "creditNotes"),
            ("debit_note", "debitNotes"),
            ("deposit", "deposits"),
        ]
    else:
        collections = [
            ("purchase_order", "purchaseOrders"),
            ("receive", "receives"),
            ("expense", "expenses"),
            ("withholding_tax", "withholdingTaxDocuments"),
        ]

    for kind, key in collections:
        for record in data.get(key, []):
            rows.append(
                {
                    "kind": kind,
                    "documentId": record.get("id", ""),
                    "date": record.get("date", ""),
                    "party": record.get("customer") or record.get("vendor") or record.get("receivedFrom") or "",
                    "status": record.get("status", ""),
                    "currency": record.get("currency", "THB"),
                    "amount": _round_money(record.get("amount")),
                    "linkedCount": len(record.get("linkedDocumentIds", []) or []),
                    "workflowId": record.get("workflowId", ""),
                    "sourceDocumentIds": ", ".join(record.get("sourceDocumentIds", []) or []),
                    "paymentStatus": record.get("paymentStatus", ""),
                    "amountPaid": _round_money(record.get("amountPaid", 0)),
                    "amountDue": _round_money(record.get("amountDue", 0)),
                    "taxPointDate": record.get("taxPointDate", ""),
                    "vatReportingPeriod": record.get("vatReportingPeriod", ""),
                }
            )
    rows.sort(key=lambda item: (item["date"], item["documentId"]), reverse=True)
    return rows


def _invoice_breakdown(record: dict[str, Any], policy: dict[str, Any]) -> tuple[float, float, float]:
    amount = _round_money(record.get("amount"))
    if not amount:
        subtotal = _round_money(record.get("subtotal"))
        tax_amount = _round_money(record.get("taxAmount"))
        return subtotal, tax_amount, _round_money(subtotal + tax_amount)

    if not policy["vatRegistered"]:
        return amount, 0.0, amount

    subtotal = _round_money(record.get("subtotal"))
    tax_amount = _round_money(record.get("taxAmount"))
    if not subtotal:
        subtotal = _round_money(amount / (1 + policy["vatRate"]))
    if not tax_amount:
        tax_amount = _round_money(amount - subtotal)
    return subtotal, tax_amount, amount


def _expense_account(category: str | None) -> str:
    if not category:
        return "Operating Expenses"
    return f"{category.strip()} Expense"


def _invoice_status_amount(record: dict[str, Any]) -> float:
    status = str(record.get("status", "")).lower()
    amount = _round_money(record.get("amount"))
    if status == "paid":
        return amount
    if status == "partial":
        return _round_money(amount * 0.5)
    return 0.0


def _journal_entry(
    entry_id: str,
    entry_date: str,
    source_type: str,
    source_id: str,
    description: str,
    lines: list[dict[str, Any]],
    currency: str,
    *,
    status: str = "posted",
    project_id: str = "",
    project_name: str = "",
) -> dict[str, Any]:
    amount = _round_money(sum(line["amount"] for line in lines if line["side"] == "debit"))
    return {
        "id": entry_id,
        "date": entry_date,
        "sourceType": source_type,
        "sourceId": source_id,
        "description": description,
        "memo": description,
        "currency": currency,
        "amount": amount,
        "lines": lines,
        "journalType": _journal_type_for_source(source_type),
        "status": status,
        "sourceRoute": _source_route_for_type(source_type, source_id),
        "ruleExplanation": _rule_explanation_for_source(source_type),
        "projectId": project_id,
        "projectName": project_name,
    }


def _journal_entry_from_event(
    *,
    sequence_builder,
    event,
    description: str,
    currency: str,
    status: str = "posted",
    project_name: str = "",
) -> dict[str, Any]:
    return _journal_entry(
        sequence_builder(event.event_date),
        event.event_date,
        event.source_type.value,
        event.source_document_id,
        description,
        list(event.journal_payload),
        currency,
        status=status,
        project_id=event.linked_project_id,
        project_name=project_name,
    )


def build_accounting_events(data: dict[str, Any]) -> list[dict[str, Any]]:
    policy = build_policy_snapshot(data.get("settings"))
    finance_accounts = deepcopy(data.get("financeAccounts", []))
    projects_by_id, project_name_lookup = _project_lookup(data)
    entries: list[dict[str, Any]] = []
    sequence = 1
    base_currency = policy["baseCurrency"]

    def next_id(event_date: str) -> str:
        nonlocal sequence
        entry_id = f"JE-{event_date.replace('-', '')}-{sequence:04d}"
        sequence += 1
        return entry_id

    invoices = sorted(data.get("invoices", []), key=lambda item: item.get("date", ""))
    receipts = sorted(data.get("receipts", []), key=lambda item: item.get("date", ""))
    expenses = sorted(data.get("expenses", []), key=lambda item: item.get("date", ""))
    receives = sorted(data.get("receives", []), key=lambda item: item.get("date", ""))

    invoices_by_id = {invoice["id"]: invoice for invoice in invoices}
    for invoice in invoices:
        status = str(invoice.get("status", "draft")).lower()
        if status in {"draft", "cancelled", "void"}:
            continue
        subtotal, tax_amount, total = _invoice_breakdown(invoice, policy)
        project_id = _document_project_id(invoice, project_name_lookup)
        lines = [
            {"account": "Accounts Receivable", "side": "debit", "amount": total},
            {"account": "Sales Revenue", "side": "credit", "amount": subtotal},
        ]
        if tax_amount:
            tax_account = "Output VAT Payable" if policy["outputTaxRecognition"] == "invoice" else "Deferred Output VAT"
            lines.append({"account": tax_account, "side": "credit", "amount": tax_amount})

        entry_date = invoice.get("date") or date.today().isoformat()
        event = build_accounting_event(
            source_document_id=invoice["id"],
            source_type=DocumentType.INVOICE,
            event_type=AccountingEventType.DOCUMENT_ISSUED,
            event_date=entry_date,
            subtotal=subtotal,
            tax_amount=tax_amount,
            total_amount=total,
            linked_contact_id=invoice.get("customer", ""),
            linked_project_id=project_id,
            journal_payload=lines,
            tax_mode=TaxMode.EXCLUSIVE,
        )
        entries.append(
            _journal_entry_from_event(
                sequence_builder=next_id,
                event=event,
                description=f"Issued invoice {invoice['id']} to {invoice.get('customer', 'customer')}",
                currency=invoice.get("currency", base_currency),
                status=status,
                project_name=projects_by_id.get(project_id, {}).get("name", ""),
            )
        )

    for receipt in receipts:
        status = str(receipt.get("status", "draft")).lower()
        if status in {"draft", "cancelled", "void"}:
            continue

        amount = _round_money(receipt.get("amount"))
        if amount <= 0:
            continue

        cash_account = _account_for_payment_method(receipt.get("paymentMethod"), finance_accounts)
        project_id = _document_project_id(receipt, project_name_lookup)
        lines = [
            {"account": cash_account, "side": "debit", "amount": amount},
            {"account": "Accounts Receivable", "side": "credit", "amount": amount},
        ]

        related_invoice = receipt.get("relatedInvoice")
        if related_invoice and policy["outputTaxRecognition"] == "payment":
            invoice = invoices_by_id.get(related_invoice)
            if invoice:
                _, invoice_tax, invoice_total = _invoice_breakdown(invoice, policy)
                if invoice_tax and invoice_total:
                    recognized_tax = _round_money(amount * (invoice_tax / invoice_total))
                    if recognized_tax:
                        lines.extend(
                            [
                                {"account": "Deferred Output VAT", "side": "debit", "amount": recognized_tax},
                                {"account": "Output VAT Payable", "side": "credit", "amount": recognized_tax},
                            ]
                        )

        entry_date = receipt.get("date") or date.today().isoformat()
        event = build_accounting_event(
            source_document_id=receipt["id"],
            source_type=DocumentType.RECEIPT,
            event_type=AccountingEventType.PAYMENT_RECORDED,
            event_date=entry_date,
            subtotal=amount,
            tax_amount=0.0,
            total_amount=amount,
            linked_contact_id=receipt.get("customer", ""),
            linked_document_ids=[related_invoice] if related_invoice else [],
            linked_account_id=cash_account,
            linked_project_id=project_id,
            journal_payload=lines,
        )
        entries.append(
            _journal_entry_from_event(
                sequence_builder=next_id,
                event=event,
                description=f"Recorded receipt {receipt['id']} from {receipt.get('customer', 'customer')}",
                currency=receipt.get("currency", base_currency),
                status=status,
                project_name=projects_by_id.get(project_id, {}).get("name", ""),
            )
        )

    for expense in expenses:
        status = str(expense.get("status", "pending")).lower()
        if status != "approved":
            continue

        amount = _round_money(expense.get("amount"))
        if amount <= 0:
            continue

        subtotal, tax_amount, _ = _invoice_breakdown(expense, policy)
        expense_account = _expense_account(expense.get("category"))
        cash_account = _account_for_payment_method(expense.get("paymentMethod"), finance_accounts)
        project_id = _document_project_id(expense, project_name_lookup)
        lines = [{"account": expense_account, "side": "debit", "amount": subtotal or amount}]
        if tax_amount:
            lines.append({"account": "Input VAT Recoverable", "side": "debit", "amount": tax_amount})
        lines.append({"account": cash_account, "side": "credit", "amount": amount})

        entry_date = expense.get("date") or date.today().isoformat()
        event = build_accounting_event(
            source_document_id=expense["id"],
            source_type=DocumentType.EXPENSE,
            event_type=AccountingEventType.EXPENSE_APPROVED,
            event_date=entry_date,
            subtotal=subtotal or amount,
            tax_amount=tax_amount,
            total_amount=amount,
            linked_contact_id=expense.get("vendor", ""),
            linked_account_id=cash_account,
            linked_project_id=project_id,
            journal_payload=lines,
        )
        entries.append(
            _journal_entry_from_event(
                sequence_builder=next_id,
                event=event,
                description=f"Approved expense {expense['id']} from {expense.get('vendor', 'vendor')}",
                currency=base_currency,
                status=status,
                project_name=projects_by_id.get(project_id, {}).get("name", ""),
            )
        )

    for receive in receives:
        status = str(receive.get("status", "draft")).lower()
        if status in {"draft", "cancelled", "void"}:
            continue

        amount = _round_money(receive.get("amount") or receive.get("netAmount"))
        if amount <= 0:
            continue

        related_document = receive.get("relatedDocument")
        counter_account = "Accounts Receivable" if related_document in invoices_by_id else "Unapplied Receipts"
        cash_account = _account_for_payment_method(receive.get("paymentMethod"), finance_accounts)
        project_id = _document_project_id(receive, project_name_lookup)
        lines = [
            {"account": cash_account, "side": "debit", "amount": amount},
            {"account": counter_account, "side": "credit", "amount": amount},
        ]

        entry_date = receive.get("date") or date.today().isoformat()
        event = build_accounting_event(
            source_document_id=receive["id"],
            source_type=DocumentType.RECEIVE,
            event_type=AccountingEventType.RECEIVE_CAPTURED,
            event_date=entry_date,
            subtotal=amount,
            tax_amount=0.0,
            total_amount=amount,
            linked_contact_id=receive.get("receivedFrom", ""),
            linked_document_ids=[related_document] if related_document else [],
            linked_account_id=cash_account,
            linked_project_id=project_id,
            journal_payload=lines,
        )
        entries.append(
            _journal_entry_from_event(
                sequence_builder=next_id,
                event=event,
                description=f"Captured receive {receive['id']} from {receive.get('receivedFrom', 'source')}",
                currency=receive.get("currency", base_currency),
                status=status,
                project_name=projects_by_id.get(project_id, {}).get("name", ""),
            )
        )

    for movement in data.get("financeMovements", []):
        source_account = str(movement.get("sourceAccountName", "")).strip()
        destination_account = str(movement.get("destinationAccountName", "")).strip()
        amount = _round_money(movement.get("amount"))
        if not source_account or not destination_account or amount <= 0:
            continue

        entry_date = movement.get("date") or date.today().isoformat()
        journal_lines = [
            {"account": destination_account, "side": "debit", "amount": amount},
            {"account": source_account, "side": "credit", "amount": amount},
        ]
        entries.append(
            _journal_entry(
                next_id(entry_date),
                entry_date,
                "finance_movement",
                movement.get("id", ""),
                movement.get("note")
                or f"Internal {movement.get('movementType', 'transfer')} from {source_account} to {destination_account}",
                journal_lines,
                movement.get("currency", base_currency),
                status=movement.get("status", "posted"),
            )
        )

    return sorted(entries, key=lambda entry: (entry["date"], entry["id"]), reverse=True)


def build_trial_balance(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    totals: dict[str, dict[str, float]] = defaultdict(lambda: {"debit": 0.0, "credit": 0.0})
    for entry in entries:
        for line in entry["lines"]:
            bucket = totals[line["account"]]
            bucket[line["side"]] = _round_money(bucket[line["side"]] + line["amount"])

    trial_balance = []
    for account, values in sorted(totals.items()):
        trial_balance.append(
            {
                "account": account,
                "debit": _round_money(values["debit"]),
                "credit": _round_money(values["credit"]),
                "balance": _round_money(values["debit"] - values["credit"]),
            }
        )
    return trial_balance


def build_top_customers_chart(data: dict[str, Any]) -> list[dict[str, Any]]:
    totals: dict[str, float] = defaultdict(float)
    for invoice in data.get("invoices", []):
        status = str(invoice.get("status", "draft")).lower()
        if status in {"draft", "cancelled", "void"}:
            continue
        totals[invoice.get("customer") or "Unknown Customer"] += _round_money(invoice.get("amount"))

    rows = [{"name": customer, "revenue": _round_money(amount)} for customer, amount in totals.items()]
    rows.sort(key=lambda item: item["revenue"], reverse=True)
    return rows[:5]


def build_cash_flow(data: dict[str, Any]) -> list[dict[str, Any]]:
    today = _today(data)
    months = _last_n_months(today, 6)
    month_order = {_month_key(month): index for index, month in enumerate(months)}
    monthly = {key: {"month": _month_label(month), "in": 0.0, "out": 0.0} for key, month in zip(month_order.keys(), months)}

    receipt_invoice_ids = {receipt.get("relatedInvoice") for receipt in data.get("receipts", []) if receipt.get("relatedInvoice")}

    for receipt in data.get("receipts", []):
        parsed = _parse_date(receipt.get("date"))
        if not parsed:
            continue
        key = _month_key(parsed.replace(day=1))
        if key in monthly:
            monthly[key]["in"] = _round_money(monthly[key]["in"] + receipt.get("amount"))

    for receive in data.get("receives", []):
        parsed = _parse_date(receive.get("date"))
        if not parsed:
            continue
        key = _month_key(parsed.replace(day=1))
        if key in monthly:
            monthly[key]["in"] = _round_money(monthly[key]["in"] + (receive.get("amount") or receive.get("netAmount")))

    for invoice in data.get("invoices", []):
        if invoice["id"] in receipt_invoice_ids:
            continue
        parsed = _parse_date(invoice.get("due") or invoice.get("date"))
        if not parsed:
            continue
        inferred = _invoice_status_amount(invoice)
        if inferred <= 0:
            continue
        key = _month_key(parsed.replace(day=1))
        if key in monthly:
            monthly[key]["in"] = _round_money(monthly[key]["in"] + inferred)

    for expense in data.get("expenses", []):
        if str(expense.get("status", "pending")).lower() != "approved":
            continue
        parsed = _parse_date(expense.get("date"))
        if not parsed:
            continue
        key = _month_key(parsed.replace(day=1))
        if key in monthly:
            monthly[key]["out"] = _round_money(monthly[key]["out"] + expense.get("amount"))

    return [monthly[_month_key(month)] for month in months]


def build_vat_summary(data: dict[str, Any]) -> dict[str, Any]:
    policy = build_policy_snapshot(data.get("settings"))
    output_tax = 0.0
    input_tax = 0.0
    reporting_periods: set[str] = set()

    for invoice in data.get("invoices", []):
        status = str(invoice.get("status", "draft")).lower()
        if status in {"draft", "cancelled", "void"}:
            continue
        _, tax_amount, total = _invoice_breakdown(invoice, policy)
        if policy["outputTaxRecognition"] == "payment":
            output_tax += _invoice_status_amount(invoice) * (tax_amount / total) if total else 0
        else:
            output_tax += tax_amount
        if invoice.get("vatReportingPeriod"):
            reporting_periods.add(str(invoice.get("vatReportingPeriod")))

    for note in data.get("creditNotes", []):
        status = str(note.get("status", "draft")).lower()
        if status in {"draft", "cancelled", "void"}:
            continue
        _, tax_amount, _ = _invoice_breakdown(note, policy)
        output_tax -= tax_amount
        if note.get("vatReportingPeriod"):
            reporting_periods.add(str(note.get("vatReportingPeriod")))

    for note in data.get("debitNotes", []):
        status = str(note.get("status", "draft")).lower()
        if status in {"draft", "cancelled", "void"}:
            continue
        _, tax_amount, _ = _invoice_breakdown(note, policy)
        output_tax += tax_amount
        if note.get("vatReportingPeriod"):
            reporting_periods.add(str(note.get("vatReportingPeriod")))

    for expense in data.get("expenses", []):
        status = str(expense.get("status", "pending")).lower()
        if status != "approved":
            continue
        _, tax_amount, _ = _invoice_breakdown(expense, policy)
        input_tax += tax_amount
        if expense.get("vatReportingPeriod"):
            reporting_periods.add(str(expense.get("vatReportingPeriod")))

    today = _today(data)
    return {
        "vatRegistered": policy["vatRegistered"],
        "filingPeriod": today.strftime("%B %Y"),
        "sourceReportingPeriods": sorted(reporting_periods),
        "outputTax": _round_money(output_tax),
        "inputTax": _round_money(input_tax),
        "netVatPayable": _round_money(output_tax - input_tax),
    }


def build_aging_summary(data: dict[str, Any], kind: str) -> list[dict[str, Any]]:
    today = _today(data)
    buckets = [
        {"bucket": "Current", "min": None, "max": 0},
        {"bucket": "1-30 days", "min": 1, "max": 30},
        {"bucket": "31-60 days", "min": 31, "max": 60},
        {"bucket": "61-90 days", "min": 61, "max": 90},
        {"bucket": "90+ days", "min": 91, "max": None},
    ]
    summary = {bucket["bucket"]: {"bucket": bucket["bucket"], "amount": 0.0, "count": 0} for bucket in buckets}

    if kind == "receivable":
        rows = [
            invoice
            for invoice in data.get("invoices", [])
            if str(invoice.get("status", "draft")).lower() in {"sent", "overdue", "partial", "pending"}
        ]
        date_key = "due"
    else:
        rows = [
            expense
            for expense in data.get("expenses", [])
            if str(expense.get("status", "pending")).lower() in {"pending"}
        ]
        date_key = "date"

    for row in rows:
        due_date = _parse_date(row.get(date_key) or row.get("date"))
        if not due_date:
            continue
        overdue_days = max((today - due_date).days, 0)
        for bucket in buckets:
            lower = bucket["min"]
            upper = bucket["max"]
            if lower is not None and overdue_days < lower:
                continue
            if upper is not None and overdue_days > upper:
                continue
            summary[bucket["bucket"]]["amount"] = _round_money(summary[bucket["bucket"]]["amount"] + row.get("amount"))
            summary[bucket["bucket"]]["count"] += 1
            break

    return [summary[bucket["bucket"]] for bucket in buckets]


def build_cash_movements(data: dict[str, Any]) -> list[dict[str, Any]]:
    movements: list[dict[str, Any]] = []
    finance_accounts = deepcopy(data.get("financeAccounts", []))
    receipt_invoice_ids = {receipt.get("relatedInvoice") for receipt in data.get("receipts", []) if receipt.get("relatedInvoice")}

    for receipt in data.get("receipts", []):
        amount = _round_money(receipt.get("amount"))
        if amount <= 0:
            continue
        movements.append(
            {
                "date": receipt.get("date", ""),
                "direction": "in",
                "amount": amount,
                "account": _account_for_payment_method(receipt.get("paymentMethod"), finance_accounts),
                "counterparty": receipt.get("customer", "-"),
                "sourceType": "receipt",
                "sourceId": receipt.get("id", ""),
                "description": receipt.get("notes") or receipt.get("relatedInvoice") or "Customer receipt",
            }
        )

    for invoice in data.get("invoices", []):
        if invoice.get("id") in receipt_invoice_ids:
            continue
        amount = _invoice_status_amount(invoice)
        if amount <= 0:
            continue
        movements.append(
            {
                "date": invoice.get("due") or invoice.get("date", ""),
                "direction": "in",
                "amount": amount,
                "account": _account_for_payment_method("Bank transfer", finance_accounts),
                "counterparty": invoice.get("customer", "-"),
                "sourceType": "invoice",
                "sourceId": invoice.get("id", ""),
                "description": "Inferred collection from invoice status",
            }
        )

    for receive in data.get("receives", []):
        amount = _round_money(receive.get("amount") or receive.get("netAmount"))
        if amount <= 0:
            continue
        movements.append(
            {
                "date": receive.get("date", ""),
                "direction": "in",
                "amount": amount,
                "account": _account_for_payment_method(receive.get("paymentMethod"), finance_accounts),
                "counterparty": receive.get("receivedFrom", "-"),
                "sourceType": "receive",
                "sourceId": receive.get("id", ""),
                "description": receive.get("notes") or receive.get("relatedDocument") or "Receive entry",
            }
        )

    for expense in data.get("expenses", []):
        if str(expense.get("status", "pending")).lower() != "approved":
            continue
        amount = _round_money(expense.get("amount"))
        if amount <= 0:
            continue
        movements.append(
            {
                "date": expense.get("date", ""),
                "direction": "out",
                "amount": amount,
                "account": _account_for_payment_method(expense.get("paymentMethod"), finance_accounts),
                "counterparty": expense.get("vendor", "-"),
                "sourceType": "expense",
                "sourceId": expense.get("id", ""),
                "description": expense.get("category") or "Approved expense",
            }
        )

    movements.sort(key=lambda item: (item["date"], item["sourceId"]), reverse=True)
    return movements[:12]


def build_profit_and_loss(data: dict[str, Any]) -> dict[str, Any]:
    policy = build_policy_snapshot(data.get("settings"))
    revenue = 0.0
    expenses = 0.0

    for invoice in data.get("invoices", []):
        status = str(invoice.get("status", "draft")).lower()
        if status in {"draft", "cancelled", "void"}:
            continue
        subtotal, _, _ = _invoice_breakdown(invoice, policy)
        revenue += subtotal

    for expense in data.get("expenses", []):
        status = str(expense.get("status", "pending")).lower()
        if status != "approved":
            continue
        subtotal, _, amount = _invoice_breakdown(expense, policy)
        expenses += subtotal or amount

    gross_profit = _round_money(revenue - expenses)
    return {
        "revenue": _round_money(revenue),
        "expenses": _round_money(expenses),
        "grossProfit": gross_profit,
        "netProfit": gross_profit,
    }


def build_balance_sheet(data: dict[str, Any]) -> dict[str, Any]:
    vat_summary = build_vat_summary(data)
    receivables = sum(bucket["amount"] for bucket in build_aging_summary(data, "receivable"))
    payables = sum(bucket["amount"] for bucket in build_aging_summary(data, "payable"))
    cash = _round_money(sum(_round_money(account.get("balance")) for account in data.get("financeAccounts", [])))
    input_vat = vat_summary["inputTax"]
    output_vat = vat_summary["outputTax"]
    assets = _round_money(cash + receivables + input_vat)
    liabilities = _round_money(payables + output_vat)
    equity = _round_money(assets - liabilities)

    return {
        "cash": cash,
        "accountsReceivable": _round_money(receivables),
        "accountsPayable": _round_money(payables),
        "inputVatRecoverable": _round_money(input_vat),
        "outputVatPayable": _round_money(output_vat),
        "assets": assets,
        "liabilities": liabilities,
        "equity": equity,
    }


def build_dashboard_summary(data: dict[str, Any]) -> dict[str, Any]:
    revenue = sum(_round_money(invoice.get("amount")) for invoice in data.get("invoices", []) if str(invoice.get("status", "draft")).lower() not in {"draft", "cancelled", "void"})
    expenses = sum(_round_money(expense.get("amount")) for expense in data.get("expenses", []) if str(expense.get("status", "pending")).lower() == "approved")
    receivables = sum(bucket["amount"] for bucket in build_aging_summary(data, "receivable"))
    payables = sum(bucket["amount"] for bucket in build_aging_summary(data, "payable"))
    cash = _round_money(sum(_round_money(account.get("balance")) for account in data.get("financeAccounts", [])))
    vat_summary = build_vat_summary(data)
    overdue_invoices = sum(1 for invoice in data.get("invoices", []) if str(invoice.get("status", "")).lower() == "overdue")
    open_invoices = sum(1 for invoice in data.get("invoices", []) if str(invoice.get("status", "")).lower() in {"sent", "overdue", "partial", "pending"})
    pending_expenses = sum(1 for expense in data.get("expenses", []) if str(expense.get("status", "")).lower() == "pending")

    return {
        "revenue": _round_money(revenue),
        "expenses": _round_money(expenses),
        "netProfit": _round_money(revenue - expenses),
        "receivables": _round_money(receivables),
        "payables": _round_money(payables),
        "cash": cash,
        "openInvoices": open_invoices,
        "pendingExpenses": pending_expenses,
        "overdueInvoices": overdue_invoices,
        "vatPayable": vat_summary["netVatPayable"],
    }


def build_accounting_overview(data: dict[str, Any]) -> dict[str, Any]:
    entries = build_accounting_events(data)
    trial_balance = build_trial_balance(entries)
    cash_movements = build_cash_movements(data)
    account_movements = build_account_movement_rows(data)
    pending_payouts = sum(_round_money(expense.get("amount")) for expense in data.get("expenses", []) if str(expense.get("status", "pending")).lower() == "pending")

    invoice_candidates = [
        invoice
        for invoice in data.get("invoices", [])
        if str(invoice.get("status", "draft")).lower() not in {"draft", "cancelled", "void"}
    ]
    expense_candidates = data.get("expenses", [])
    total_candidates = len(invoice_candidates) + len(expense_candidates)
    posted_candidates = len(invoice_candidates) + sum(1 for expense in expense_candidates if str(expense.get("status", "pending")).lower() == "approved")
    posting_coverage = round((posted_candidates / total_candidates) * 100) if total_candidates else 100

    return {
        "dashboardSummary": build_dashboard_summary(data),
        "topCustomersChart": build_top_customers_chart(data),
        "cashFlow": build_cash_flow(data),
        "vatSummary": build_vat_summary(data),
        "receivablesAging": build_aging_summary(data, "receivable"),
        "payablesAging": build_aging_summary(data, "payable"),
        "profitAndLoss": build_profit_and_loss(data),
        "balanceSheet": build_balance_sheet(data),
        "trialBalance": trial_balance,
        "cashMovements": cash_movements,
        "accountMovements": account_movements[:20],
        "policySummary": build_policy_snapshot(data.get("settings")),
        "projectProfitability": build_project_profitability_rows(data),
        "financeSummary": {
            "totalCash": _round_money(sum(_round_money(account.get("balance")) for account in data.get("financeAccounts", []))),
            "bankAccounts": len(data.get("financeAccounts", [])),
            "pendingPayouts": _round_money(pending_payouts),
            "postingCoverage": posting_coverage,
            "cashIn": _round_money(sum(item["amount"] for item in cash_movements if item["direction"] == "in")),
            "cashOut": _round_money(sum(item["amount"] for item in cash_movements if item["direction"] == "out")),
        },
    }


def build_report_rows(data: dict[str, Any], report_key: str) -> list[dict[str, Any]]:
    overview = build_accounting_overview(data)
    if report_key == "profit-and-loss":
        pnl = overview["profitAndLoss"]
        return [
            {"metric": "Revenue", "amount": pnl["revenue"]},
            {"metric": "Expenses", "amount": pnl["expenses"]},
            {"metric": "Gross Profit", "amount": pnl["grossProfit"]},
            {"metric": "Net Profit", "amount": pnl["netProfit"]},
        ]
    if report_key == "balance-sheet":
        sheet = overview["balanceSheet"]
        return [
            {"metric": "Cash", "amount": sheet["cash"]},
            {"metric": "Accounts Receivable", "amount": sheet["accountsReceivable"]},
            {"metric": "Input VAT Recoverable", "amount": sheet["inputVatRecoverable"]},
            {"metric": "Accounts Payable", "amount": sheet["accountsPayable"]},
            {"metric": "Output VAT Payable", "amount": sheet["outputVatPayable"]},
            {"metric": "Assets", "amount": sheet["assets"]},
            {"metric": "Liabilities", "amount": sheet["liabilities"]},
            {"metric": "Equity", "amount": sheet["equity"]},
        ]
    if report_key == "cash-flow":
        return deepcopy(overview["cashFlow"])
    if report_key == "trial-balance":
        return deepcopy(overview["trialBalance"])
    if report_key == "vat-summary":
        vat = overview["vatSummary"]
        return [
            {"metric": "VAT Registered", "value": "Yes" if vat["vatRegistered"] else "No"},
            {"metric": "Filing Period", "value": vat["filingPeriod"]},
            {"metric": "Source Reporting Periods", "value": ", ".join(vat.get("sourceReportingPeriods", []))},
            {"metric": "Output Tax", "amount": vat["outputTax"]},
            {"metric": "Input Tax", "amount": vat["inputTax"]},
            {"metric": "Net VAT Payable", "amount": vat["netVatPayable"]},
        ]
    if report_key == "tax-sell-summary":
        return build_tax_summary_rows(data, "sell")
    if report_key == "tax-buy-summary":
        return build_tax_summary_rows(data, "buy")
    if report_key == "withholding-tax":
        rows = []
        for document in data.get("withholdingTaxDocuments", []):
            rows.append(
                {
                    "date": document.get("date", ""),
                    "documentId": document.get("id", ""),
                    "vendor": document.get("vendor", ""),
                    "relatedDocumentId": document.get("sourceDocumentId", ""),
                    "relatedPaymentId": document.get("relatedPaymentId", ""),
                    "linkedDocumentIds": ", ".join(document.get("linkedDocumentIds", []) or []),
                    "incomeType": document.get("incomeType", ""),
                    "taxableAmount": _round_money(document.get("taxableAmount")),
                    "rate": _round_money(float(document.get("rate", 0) or 0) * (100 if float(document.get("rate", 0) or 0) <= 1 else 1)),
                    "amount": _round_money(document.get("amount")),
                    "filingMonth": document.get("filingMonth", ""),
                    "status": document.get("status", ""),
                }
            )
        if rows:
            return sorted(rows, key=lambda row: (row["date"], row["documentId"]), reverse=True)
        policy = overview["policySummary"]
        return [
            {"metric": "Withholding enabled", "value": "Yes" if policy["withholdingEnabled"] else "No"},
            {"metric": "Configured rate", "value": f"{policy['withholdingRate'] * 100:.0f}%"},
            {"metric": "Filed amount", "amount": 0.0},
            {"metric": "Note", "value": "No withholding documents have been generated yet."},
        ]
    if report_key == "aging-receivables":
        return deepcopy(overview["receivablesAging"])
    if report_key == "aging-payables":
        return deepcopy(overview["payablesAging"])
    if report_key == "receipt-payment-register":
        return build_receipt_payment_rows(data)
    if report_key == "petty-cash-movement":
        return [
            row
            for row in build_account_movement_rows(data)
            if row.get("accountType") == "petty_cash"
        ]
    if report_key == "cheque-summary":
        return build_cheque_summary_rows(data)
    if report_key == "financial-account-movement":
        return build_account_movement_rows(data)
    if report_key == "sales-documents":
        return build_document_module_rows(data, "sales")
    if report_key == "purchase-documents":
        return build_document_module_rows(data, "purchase")
    if report_key == "customer-statements":
        rows: list[dict[str, Any]] = []
        for invoice in data.get("invoices", []):
            rows.append(
                {
                    "customer": invoice.get("customer", "-"),
                    "date": invoice.get("date", ""),
                    "source": "invoice",
                    "documentId": invoice.get("id", ""),
                    "status": invoice.get("status", ""),
                    "amount": _round_money(invoice.get("amount")),
                }
            )
        for receipt in data.get("receipts", []):
            rows.append(
                {
                    "customer": receipt.get("customer", "-"),
                    "date": receipt.get("date", ""),
                    "source": "receipt",
                    "documentId": receipt.get("id", ""),
                    "status": receipt.get("status", ""),
                    "amount": _round_money(receipt.get("amount")),
                }
            )
        return sorted(rows, key=lambda row: (row["customer"], row["date"], row["documentId"]))
    if report_key == "inventory-valuation":
        rows = []
        for product in data.get("products", []):
            stock = product.get("stock")
            if stock in (None, ""):
                continue
            quantity = int(stock)
            rows.append(
                {
                    "sku": product.get("sku", ""),
                    "name": product.get("name", ""),
                    "quantity": quantity,
                    "unitPrice": _round_money(product.get("price")),
                    "inventoryValue": _round_money(quantity * _round_money(product.get("price"))),
                }
            )
        return rows
    if report_key == "inventory-movement":
        rows = []
        for movement in data.get("inventoryMovements", []):
            rows.append(
                {
                    "date": movement.get("effectiveDate", ""),
                    "movementId": movement.get("id", ""),
                    "sku": movement.get("sku", ""),
                    "name": movement.get("productName", ""),
                    "sourceType": movement.get("sourceType", ""),
                    "sourceDocumentId": movement.get("sourceDocumentId", ""),
                    "qtyIn": _round_money(movement.get("qtyIn", movement.get("qty") if movement.get("direction") == "in" else 0)),
                    "qtyOut": _round_money(movement.get("qtyOut", movement.get("qty") if movement.get("direction") == "out" else 0)),
                    "beforeQty": _round_money(movement.get("beforeQty")),
                    "afterQty": _round_money(movement.get("afterQty")),
                    "unitCost": _round_money(movement.get("unitCost")),
                    "reason": movement.get("reason", ""),
                }
            )
        return sorted(rows, key=lambda row: (row["date"], row["movementId"]), reverse=True)
    if report_key == "project-profitability":
        return build_project_profitability_rows(data)
    raise ValueError(f"Unsupported report key: {report_key}")

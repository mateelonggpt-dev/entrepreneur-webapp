from __future__ import annotations

from copy import deepcopy
from datetime import datetime
from typing import Any

from .data_service import SEED_DATABASE
from .ledger_service import build_accounting_overview
from .storage_service import (
    build_generated_path,
    clone_seed,
    load_database,
    mutate_database,
    next_counter,
)


FILING_TYPES = {"vat_summary", "wht_filing", "close_tax_period", "payment_posting"}


def _seed_database() -> dict[str, Any]:
    return clone_seed(SEED_DATABASE)


def _db() -> dict[str, Any]:
    data = load_database(_seed_database)
    _normalize_database_shape(data)
    return data


def _mutate(mutator):
    def wrapped(data: dict[str, Any]):
        _normalize_database_shape(data)
        return mutator(data)

    return mutate_database(_seed_database, wrapped)


def _normalize_database_shape(data: dict[str, Any]) -> None:
    data.setdefault("taxFilings", [])
    data.setdefault("recentActivity", [])


def _push_activity(data: dict[str, Any], who: str, what: str, kind: str) -> None:
    data.setdefault("recentActivity", []).insert(
        0,
        {
            "who": who,
            "what": what,
            "time": "just now",
            "type": kind,
        },
    )
    data["recentActivity"] = data["recentActivity"][:20]


def _build_summary(data: dict[str, Any], filing_type: str, period: str) -> dict[str, Any]:
    normalized_period = str(period or "").strip()
    overview = build_accounting_overview(data)

    if filing_type == "vat_summary":
        vat = overview["vatSummary"]
        return {
            "outputTax": vat["outputTax"],
            "inputTax": vat["inputTax"],
            "netVatPayable": vat["netVatPayable"],
            "filingPeriod": normalized_period or vat["filingPeriod"],
        }

    if filing_type == "wht_filing":
        rows = [
            row
            for row in data.get("withholdingTaxDocuments", [])
            if not normalized_period or str(row.get("filingMonth", "")).strip() == normalized_period
        ]
        return {
            "documentCount": len(rows),
            "withholdingAmount": round(sum(float(row.get("amount", 0) or 0) for row in rows), 2),
            "taxableAmount": round(sum(float(row.get("taxableAmount", 0) or 0) for row in rows), 2),
            "filingPeriod": normalized_period,
        }

    if filing_type == "close_tax_period":
        invoice_count = sum(
            1
            for row in data.get("invoices", [])
            if not normalized_period or str(row.get("date", "")).startswith(normalized_period)
        )
        expense_count = sum(
            1
            for row in data.get("expenses", [])
            if not normalized_period or str(row.get("date", "")).startswith(normalized_period)
        )
        return {
            "invoiceCount": invoice_count,
            "expenseCount": expense_count,
            "whtDocumentCount": sum(
                1
                for row in data.get("withholdingTaxDocuments", [])
                if not normalized_period or str(row.get("filingMonth", "")).strip() == normalized_period
            ),
            "filingPeriod": normalized_period,
        }

    vat = overview["vatSummary"]
    wht_amount = round(
        sum(
            float(row.get("amount", 0) or 0)
            for row in data.get("withholdingTaxDocuments", [])
            if not normalized_period or str(row.get("filingMonth", "")).strip() == normalized_period
        ),
        2,
    )
    return {
        "vatAmount": vat["netVatPayable"],
        "withholdingAmount": wht_amount,
        "totalLiability": round(float(vat["netVatPayable"]) + wht_amount, 2),
        "filingPeriod": normalized_period,
    }


def list_tax_filings() -> list[dict[str, Any]]:
    return deepcopy(_db().get("taxFilings", []))


def get_tax_overview() -> dict[str, Any]:
    data = _db()
    overview = build_accounting_overview(data)
    pending_wht = len([row for row in data.get("withholdingTaxDocuments", []) if row.get("status") != "filed"])
    return {
        "vatSummary": overview["vatSummary"],
        "pendingWhtDocuments": pending_wht,
        "filingCount": len(data.get("taxFilings", [])),
    }


def create_tax_filing(payload: dict[str, Any]) -> dict[str, Any]:
    filing_type = str(payload.get("filingType", "")).strip()
    period = str(payload.get("period", "")).strip()
    status = str(payload.get("status", "draft")).strip() or "draft"

    if filing_type not in FILING_TYPES:
        raise ValueError("Unsupported filing type.")
    if not period:
        raise ValueError("Tax filing period is required.")

    def mutator(data: dict[str, Any]) -> dict[str, Any]:
        sequence = next_counter(data, "taxFiling", len(data.get("taxFilings", [])) + 1)
        filing_id = f"TAX-{period.replace('-', '')}-{sequence:03d}"
        record = {
            "id": filing_id,
            "filingType": filing_type,
            "period": period,
            "status": status,
            "note": str(payload.get("note", "")).strip(),
            "paymentDate": str(payload.get("paymentDate", "")).strip(),
            "paymentReference": str(payload.get("paymentReference", "")).strip(),
            "createdAt": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "summary": _build_summary(data, filing_type, period),
        }
        data.setdefault("taxFilings", []).insert(0, record)
        _push_activity(data, "Tax", f"created {filing_type.replace('_', ' ')} shell {filing_id}", "tax")
        return deepcopy(record)

    return _mutate(mutator)


def build_tax_filing_download(filing_id: str) -> dict[str, Any] | None:
    filing = next((row for row in _db().get("taxFilings", []) if row.get("id") == filing_id), None)
    if not filing:
        return None

    path = build_generated_path(f"tax-filing-{filing_id}", "txt")
    summary = filing.get("summary", {})
    lines = [
        f"Filing ID: {filing.get('id', '')}",
        f"Type: {filing.get('filingType', '')}",
        f"Period: {filing.get('period', '')}",
        f"Status: {filing.get('status', '')}",
        f"Created At: {filing.get('createdAt', '')}",
        "",
        "Summary:",
    ]
    lines.extend(f"- {key}: {value}" for key, value in summary.items())
    if filing.get("note"):
        lines.extend(["", f"Note: {filing.get('note', '')}"])
    path.write_text("\n".join(lines), encoding="utf-8")
    return {
        "path": path,
        "download_name": f"{filing_id}.txt",
        "mimetype": "text/plain",
    }

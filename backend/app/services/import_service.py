from __future__ import annotations

import csv
import re
from io import BytesIO, StringIO
from typing import Any

import openpyxl
import xlrd
from werkzeug.datastructures import FileStorage


IMPORT_MODES = ("contacts", "products", "sales_documents")

CONTACT_TEMPLATE_HEADERS = [
    "contact_type",
    "code",
    "name",
    "contact_person",
    "email",
    "phone",
    "tax_id",
    "address",
]

PRODUCT_TEMPLATE_HEADERS = [
    "sku",
    "name",
    "product_type",
    "sale_price",
    "status",
    "opening_qty",
    "opening_unit_cost",
    "opening_date",
]

SALES_TEMPLATE_HEADERS = [
    "document_number",
    "customer_code",
    "customer_name",
    "document_date",
    "due_date",
    "currency",
    "reference",
    "line_description",
    "qty",
    "unit_price",
    "tax_rate",
    "status",
    "record_payment",
    "payment_date",
    "payment_method",
    "notes",
]

TEMPLATE_HEADERS = {
    "contacts": CONTACT_TEMPLATE_HEADERS,
    "products": PRODUCT_TEMPLATE_HEADERS,
    "sales_documents": SALES_TEMPLATE_HEADERS,
}


def _normalize_header(header: Any) -> str:
    text = str(header or "").strip().lower()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return text.strip("_")


def _stringify(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float):
        if value.is_integer():
            return str(int(value))
        return f"{value:.10f}".rstrip("0").rstrip(".")
    return str(value).strip()


def _parse_number(value: str) -> float | None:
    cleaned = str(value or "").strip().replace(",", "")
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def _parse_bool(value: str) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "y", "paid", "cash"}


def _normalize_product_type(value: str) -> str:
    normalized = str(value or "").strip().lower().replace("_", "-")
    aliases = {
        "service": "service",
        "services": "service",
        "stock": "stock-counted",
        "stock-counted": "stock-counted",
        "stockcounted": "stock-counted",
        "stock-count": "stock-counted",
        "goods": "stock-counted",
        "non-stock": "non-stock",
        "nonstock": "non-stock",
        "non_stock": "non-stock",
        "digital": "non-stock",
    }
    return aliases.get(normalized, normalized or "service")


def _normalize_contact_type(value: str) -> str:
    normalized = str(value or "").strip().lower()
    if normalized in {"vendor", "supplier"}:
        return "vendor"
    return "customer"


def _normalize_status(value: str, fallback: str) -> str:
    normalized = str(value or "").strip().lower()
    return normalized or fallback


def _read_tabular_rows(file_storage: FileStorage) -> tuple[list[str], list[dict[str, str]], str]:
    filename = file_storage.filename or "import.csv"
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else "csv"
    content = file_storage.read()
    file_storage.stream.seek(0)

    if extension == "csv":
        text = content.decode("utf-8-sig", errors="replace")
        reader = csv.reader(StringIO(text))
        raw_rows = [row for row in reader]
    elif extension in {"xlsx", "xlsm"}:
        workbook = openpyxl.load_workbook(BytesIO(content), read_only=True, data_only=True)
        sheet = workbook.active
        raw_rows = [[_stringify(cell) for cell in row] for row in sheet.iter_rows(values_only=True)]
    elif extension == "xls":
        workbook = xlrd.open_workbook(file_contents=content)
        sheet = workbook.sheet_by_index(0)
        raw_rows = [[_stringify(sheet.cell_value(row, col)) for col in range(sheet.ncols)] for row in range(sheet.nrows)]
    else:
        raise ValueError("Unsupported file type. Use csv, xls, or xlsx.")

    if not raw_rows:
        return [], [], extension

    normalized_headers = [_normalize_header(header) for header in raw_rows[0]]
    rows: list[dict[str, str]] = []
    for row in raw_rows[1:]:
        if not any(str(cell or "").strip() for cell in row):
            continue
        mapped_row: dict[str, str] = {}
        for index, header in enumerate(normalized_headers):
            if not header:
                continue
            mapped_row[header] = _stringify(row[index] if index < len(row) else "")
        rows.append(mapped_row)

    return normalized_headers, rows, extension


def _validate_contacts(
    raw_rows: list[dict[str, str]],
    *,
    existing_codes: set[str],
) -> dict[str, Any]:
    seen_codes: set[str] = set()
    preview_rows: list[dict[str, Any]] = []

    if len(raw_rows) > 500:
        raise ValueError("Contacts import supports up to 500 rows per file.")

    for index, raw in enumerate(raw_rows, start=2):
        code = raw.get("code") or raw.get("id") or raw.get("contact_code") or ""
        mapped = {
            "contactType": _normalize_contact_type(raw.get("contact_type") or raw.get("type") or ""),
            "code": code.strip(),
            "name": str(raw.get("name", "")).strip(),
            "contactPerson": str(raw.get("contact_person") or raw.get("contact") or "").strip(),
            "email": str(raw.get("email", "")).strip(),
            "phone": str(raw.get("phone", "")).strip(),
            "taxId": str(raw.get("tax_id") or raw.get("taxid") or "").strip(),
            "address": str(raw.get("address", "")).strip(),
            "status": _normalize_status(raw.get("status", ""), "active"),
        }
        errors: list[str] = []

        if not mapped["code"]:
            errors.append("Contact code is required.")
        if not mapped["name"]:
            errors.append("Contact name is required.")
        lowered_code = mapped["code"].lower()
        if lowered_code:
            if lowered_code in existing_codes:
                errors.append("Contact code already exists.")
            if lowered_code in seen_codes:
                errors.append("Contact code must be unique in the file.")
            seen_codes.add(lowered_code)

        preview_rows.append(
            {
                "rowNumber": index,
                "raw": raw,
                "mapped": mapped,
                "errors": errors,
                "valid": not errors,
            }
        )

    return _build_preview_payload("contacts", preview_rows)


def _validate_products(
    raw_rows: list[dict[str, str]],
    *,
    existing_skus: set[str],
) -> dict[str, Any]:
    seen_skus: set[str] = set()
    preview_rows: list[dict[str, Any]] = []

    if len(raw_rows) > 500:
        raise ValueError("Products import supports up to 500 rows per file.")

    for index, raw in enumerate(raw_rows, start=2):
        sku = str(raw.get("sku") or raw.get("product_code") or raw.get("code") or "").strip()
        product_type = _normalize_product_type(raw.get("product_type") or raw.get("type") or "")
        sale_price = _parse_number(raw.get("sale_price") or raw.get("price") or "")
        opening_qty = _parse_number(raw.get("opening_qty") or raw.get("opening_stock_qty") or "")
        opening_unit_cost = _parse_number(raw.get("opening_unit_cost") or raw.get("opening_cost") or "")
        opening_date = str(raw.get("opening_date") or raw.get("opening_stock_date") or "").strip()
        mapped = {
            "sku": sku,
            "name": str(raw.get("name", "")).strip(),
            "productType": product_type,
            "salePrice": sale_price,
            "status": _normalize_status(raw.get("status", ""), "active"),
            "openingQty": opening_qty,
            "openingUnitCost": opening_unit_cost,
            "openingDate": opening_date,
        }
        errors: list[str] = []

        if not mapped["sku"]:
            errors.append("Product code / SKU is required.")
        if not mapped["name"]:
            errors.append("Product name is required.")
        if product_type not in {"service", "stock-counted", "non-stock"}:
            errors.append("Product type must be service, stock-counted, or non-stock.")
        if sale_price is None or sale_price < 0:
            errors.append("Sale price must be a valid positive number or zero.")

        lowered_sku = mapped["sku"].lower()
        if lowered_sku:
            if lowered_sku in existing_skus:
                errors.append("Product code / SKU already exists.")
            if lowered_sku in seen_skus:
                errors.append("Product code / SKU must be unique in the file.")
            seen_skus.add(lowered_sku)

        has_opening_values = opening_qty is not None or opening_unit_cost is not None or bool(opening_date)
        if product_type == "stock-counted":
            if opening_qty is None or opening_unit_cost is None or not opening_date:
                errors.append("Stock-counted products require opening qty, opening unit cost, and opening date together.")
            elif opening_qty < 0 or opening_unit_cost < 0:
                errors.append("Opening qty and opening unit cost cannot be negative.")
        elif has_opening_values:
            errors.append("Only stock-counted products can include opening stock fields.")

        preview_rows.append(
            {
                "rowNumber": index,
                "raw": raw,
                "mapped": mapped,
                "errors": errors,
                "valid": not errors,
            }
        )

    return _build_preview_payload("products", preview_rows)


def _validate_sales_documents(
    raw_rows: list[dict[str, str]],
    *,
    existing_invoice_ids: set[str],
    existing_customer_codes: set[str],
) -> dict[str, Any]:
    preview_rows: list[dict[str, Any]] = []
    seen_document_numbers: set[str] = set()
    grouped_indexes: dict[str, list[int]] = {}

    for index, raw in enumerate(raw_rows, start=2):
        document_number = str(raw.get("document_number") or raw.get("invoice_number") or raw.get("number") or "").strip()
        customer_code = str(raw.get("customer_code") or raw.get("contact_code") or "").strip()
        mapped = {
            "documentNumber": document_number,
            "customerCode": customer_code,
            "customerName": str(raw.get("customer_name") or raw.get("customer") or "").strip(),
            "documentDate": str(raw.get("document_date") or raw.get("date") or "").strip(),
            "dueDate": str(raw.get("due_date") or raw.get("due") or "").strip(),
            "currency": str(raw.get("currency") or "THB").strip() or "THB",
            "reference": str(raw.get("reference", "")).strip(),
            "lineDescription": str(raw.get("line_description") or raw.get("description") or "").strip(),
            "qty": _parse_number(raw.get("qty") or raw.get("quantity") or ""),
            "unitPrice": _parse_number(raw.get("unit_price") or raw.get("price") or ""),
            "taxRate": _parse_number(raw.get("tax_rate") or raw.get("tax") or "") or 7.0,
            "status": _normalize_status(raw.get("status", ""), "pending"),
            "recordPayment": _parse_bool(raw.get("record_payment") or raw.get("cash_sale") or ""),
            "paymentDate": str(raw.get("payment_date") or "").strip(),
            "paymentMethod": str(raw.get("payment_method") or "Cash").strip() or "Cash",
            "notes": str(raw.get("notes", "")).strip(),
        }
        errors: list[str] = []

        if not mapped["documentNumber"]:
            errors.append("Document number is required.")
        if not mapped["documentDate"]:
            errors.append("Document date is required.")
        if not mapped["customerName"] and not mapped["customerCode"]:
            errors.append("Customer name or customer code is required.")
        if mapped["customerCode"] and mapped["customerCode"].lower() not in existing_customer_codes and not mapped["customerName"]:
            errors.append("Unknown customer code. Provide customer name or import the customer first.")
        if mapped["qty"] is None or mapped["qty"] <= 0:
            errors.append("Qty must be greater than zero.")
        if mapped["unitPrice"] is None or mapped["unitPrice"] < 0:
            errors.append("Unit price must be zero or greater.")
        if not mapped["lineDescription"]:
            errors.append("Line description is required.")

        lowered_number = mapped["documentNumber"].lower()
        if lowered_number:
            grouped_indexes.setdefault(lowered_number, []).append(len(preview_rows))
            if lowered_number in existing_invoice_ids and lowered_number not in seen_document_numbers:
                errors.append("Document number already exists.")
            seen_document_numbers.add(lowered_number)

        preview_rows.append(
            {
                "rowNumber": index,
                "raw": raw,
                "mapped": mapped,
                "errors": errors,
                "valid": not errors,
            }
        )

    shared_fields = (
        "customerCode",
        "customerName",
        "documentDate",
        "dueDate",
        "currency",
        "reference",
        "status",
        "recordPayment",
        "paymentDate",
        "paymentMethod",
        "notes",
    )
    for indexes in grouped_indexes.values():
        if len(indexes) < 2:
            continue
        baseline = preview_rows[indexes[0]]["mapped"]
        for field in shared_fields:
            values = {preview_rows[index]["mapped"].get(field) for index in indexes}
            if len(values) > 1:
                for index in indexes:
                    preview_rows[index]["errors"].append(
                        f"Field '{field}' must be the same for all rows with the same document number."
                    )

    for row in preview_rows:
        row["errors"] = list(dict.fromkeys(row["errors"]))
        row["valid"] = not row["errors"]

    return _build_preview_payload("sales_documents", preview_rows)


def _build_preview_payload(mode: str, rows: list[dict[str, Any]]) -> dict[str, Any]:
    valid_rows = sum(1 for row in rows if row["valid"])
    invalid_rows = len(rows) - valid_rows
    return {
        "mode": mode,
        "rows": rows,
        "summary": {
            "totalRows": len(rows),
            "validRows": valid_rows,
            "invalidRows": invalid_rows,
        },
    }


def preview_import_file(
    mode: str,
    file_storage: FileStorage,
    *,
    existing_contact_codes: set[str],
    existing_product_skus: set[str],
    existing_invoice_ids: set[str],
    existing_customer_codes: set[str],
) -> dict[str, Any]:
    if mode not in IMPORT_MODES:
        raise ValueError(f"Unsupported import mode: {mode}")

    columns, raw_rows, extension = _read_tabular_rows(file_storage)
    payload = {
        "mode": mode,
        "fileName": file_storage.filename or f"{mode}.{extension}",
        "detectedColumns": columns,
        "fileType": extension,
    }

    if mode == "contacts":
        validated = _validate_contacts(raw_rows, existing_codes=existing_contact_codes)
    elif mode == "products":
        validated = _validate_products(raw_rows, existing_skus=existing_product_skus)
    else:
        validated = _validate_sales_documents(
            raw_rows,
            existing_invoice_ids=existing_invoice_ids,
            existing_customer_codes=existing_customer_codes,
        )

    return {**payload, **validated}


def revalidate_import_rows(
    mode: str,
    rows: list[dict[str, Any]],
    *,
    existing_contact_codes: set[str],
    existing_product_skus: set[str],
    existing_invoice_ids: set[str],
    existing_customer_codes: set[str],
) -> dict[str, Any]:
    raw_rows = [row.get("mapped", {}) if isinstance(row, dict) else {} for row in rows]

    if mode == "contacts":
        return _validate_contacts(
            [
                {
                    "contact_type": raw.get("contactType", raw.get("contact_type", "")),
                    "code": raw.get("code", ""),
                    "name": raw.get("name", ""),
                    "contact_person": raw.get("contactPerson", raw.get("contact_person", "")),
                    "email": raw.get("email", ""),
                    "phone": raw.get("phone", ""),
                    "tax_id": raw.get("taxId", raw.get("tax_id", "")),
                    "address": raw.get("address", ""),
                    "status": raw.get("status", "active"),
                }
                for raw in raw_rows
            ],
            existing_codes=existing_contact_codes,
        )
    if mode == "products":
        return _validate_products(
            [
                {
                    "sku": raw.get("sku", ""),
                    "name": raw.get("name", ""),
                    "product_type": raw.get("productType", raw.get("product_type", "")),
                    "sale_price": raw.get("salePrice", raw.get("sale_price", "")),
                    "status": raw.get("status", "active"),
                    "opening_qty": raw.get("openingQty", raw.get("opening_qty", "")),
                    "opening_unit_cost": raw.get("openingUnitCost", raw.get("opening_unit_cost", "")),
                    "opening_date": raw.get("openingDate", raw.get("opening_date", "")),
                }
                for raw in raw_rows
            ],
            existing_skus=existing_product_skus,
        )
    if mode == "sales_documents":
        return _validate_sales_documents(
            [
                {
                    "document_number": raw.get("documentNumber", raw.get("document_number", "")),
                    "customer_code": raw.get("customerCode", raw.get("customer_code", "")),
                    "customer_name": raw.get("customerName", raw.get("customer_name", "")),
                    "document_date": raw.get("documentDate", raw.get("document_date", "")),
                    "due_date": raw.get("dueDate", raw.get("due_date", "")),
                    "currency": raw.get("currency", "THB"),
                    "reference": raw.get("reference", ""),
                    "line_description": raw.get("lineDescription", raw.get("line_description", "")),
                    "qty": raw.get("qty", ""),
                    "unit_price": raw.get("unitPrice", raw.get("unit_price", "")),
                    "tax_rate": raw.get("taxRate", raw.get("tax_rate", 7)),
                    "status": raw.get("status", "pending"),
                    "record_payment": raw.get("recordPayment", raw.get("record_payment", False)),
                    "payment_date": raw.get("paymentDate", raw.get("payment_date", "")),
                    "payment_method": raw.get("paymentMethod", raw.get("payment_method", "Cash")),
                    "notes": raw.get("notes", ""),
                }
                for raw in raw_rows
            ],
            existing_invoice_ids=existing_invoice_ids,
            existing_customer_codes=existing_customer_codes,
        )
    raise ValueError(f"Unsupported import mode: {mode}")


def build_template_rows(mode: str) -> list[dict[str, str]]:
    if mode not in TEMPLATE_HEADERS:
        raise ValueError(f"Unsupported import mode: {mode}")

    samples = {
        "contacts": [
            {
                "contact_type": "customer",
                "code": "C-100",
                "name": "Siam Distribution Co., Ltd.",
                "contact_person": "Khun Nida",
                "email": "accounting@siamdist.example",
                "phone": "02-111-2222",
                "tax_id": "0105551234567",
                "address": "Bangkok, Thailand",
            }
        ],
        "products": [
            {
                "sku": "SKU-COFFEE-001",
                "name": "Arabica Coffee Pack 500g",
                "product_type": "stock-counted",
                "sale_price": "580",
                "status": "active",
                "opening_qty": "120",
                "opening_unit_cost": "330",
                "opening_date": "2026-01-01",
            }
        ],
        "sales_documents": [
            {
                "document_number": "INV-2026-0901",
                "customer_code": "C-001",
                "customer_name": "",
                "document_date": "2026-04-19",
                "due_date": "2026-05-03",
                "currency": "THB",
                "reference": "PO-7788",
                "line_description": "Coffee pack delivery",
                "qty": "10",
                "unit_price": "580",
                "tax_rate": "7",
                "status": "pending",
                "record_payment": "false",
                "payment_date": "",
                "payment_method": "Cash",
                "notes": "Imported from sales spreadsheet",
            }
        ],
    }
    return samples[mode]

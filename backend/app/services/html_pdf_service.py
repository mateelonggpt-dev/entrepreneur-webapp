from __future__ import annotations

import base64
import html
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from .storage_service import resolve_storage_path


def _text(value: Any, fallback: str = "-") -> str:
    text = str(value or "").strip()
    return text or fallback


def _escape(value: Any, fallback: str = "-") -> str:
    return html.escape(_text(value, fallback))


def _money(value: Any, currency: str = "THB") -> str:
    try:
        amount = float(value or 0)
    except (TypeError, ValueError):
        amount = 0.0
    return f"{currency} {amount:,.2f}"


def _number(value: Any) -> str:
    try:
        return f"{float(value or 0):g}"
    except (TypeError, ValueError):
        return "0"


def _percent(value: Any) -> str:
    try:
        return f"{float(value or 0):g}%"
    except (TypeError, ValueError):
        return "0%"


def _float(value: Any, fallback: float = 0.0) -> float:
    try:
        return float(value or fallback)
    except (TypeError, ValueError):
        return fallback


def _title_class(title: str) -> str:
    length = len(title or "")
    if length > 34:
        return "title-extra-long"
    if length > 26:
        return "title-long"
    if length > 18:
        return "title-medium"
    return ""


def _document_types(record: dict[str, Any], kind: str) -> list[str]:
    raw_types = record.get("documentTypes") or [kind]
    types = [str(item).strip() for item in raw_types if str(item).strip()]
    return types or [kind]


LABELS = {
    "en": {
        "original": "Original",
        "copy": "Copy",
        "seller": "Seller",
        "customer": "Customer",
        "document_no": "Document no.",
        "quotation_no": "Quotation no.",
        "customer_po": "Customer PO",
        "issue_date": "Issue date",
        "due_date": "Due date",
        "credit_terms": "Credit",
        "salesperson": "Salesperson",
        "code": "Code",
        "description": "Description",
        "qty": "Qty",
        "unit_price": "Unit price",
        "discount": "Discount",
        "vat": "VAT",
        "amount": "Amount",
        "summary": "Summary",
        "subtotal_before_discount": "Subtotal before discount",
        "total_discount": "Total discount",
        "amount_before_vat": "Amount before VAT",
        "grand_total": "Grand total",
        "withholding": "Withholding tax",
        "paid": "Paid",
        "amount_due": "Amount due",
        "amount_words": "Amount in words",
        "payment": "Payment",
        "notes": "Notes",
        "receiver": "Received by",
        "authorized": "Authorized signature",
        "date": "Date",
    },
    "th": {
        "original": "ต้นฉบับ",
        "copy": "สำเนา",
        "seller": "ผู้ขาย",
        "customer": "ลูกค้า",
        "document_no": "เลขที่เอกสาร",
        "quotation_no": "เลขที่ใบเสนอราคา",
        "customer_po": "เลขที่ PO ลูกค้า",
        "issue_date": "วันที่ออก",
        "due_date": "วันครบกำหนด",
        "credit_terms": "เครดิต",
        "salesperson": "ผู้ขาย",
        "code": "รหัส",
        "description": "คำอธิบาย",
        "qty": "จำนวน",
        "unit_price": "ราคา",
        "discount": "ส่วนลด",
        "vat": "VAT",
        "amount": "รวม",
        "summary": "สรุป",
        "subtotal_before_discount": "ยอดก่อนหักส่วนลด",
        "total_discount": "ส่วนลดรวม",
        "amount_before_vat": "ยอดก่อน VAT",
        "grand_total": "ยอดรวมสุทธิ",
        "withholding": "ภาษีหัก ณ ที่จ่าย",
        "paid": "จำนวนเงินที่ชำระแล้ว",
        "amount_due": "ยอดชำระ",
        "amount_words": "จำนวนเงินตัวอักษร",
        "payment": "การชำระเงิน",
        "notes": "หมายเหตุ",
        "receiver": "ผู้รับเอกสาร/สินค้า",
        "authorized": "ผู้มีอำนาจลงนาม",
        "date": "วันที่",
    },
}


DOCUMENT_LABELS = {
    "en": {
        "quotation": "Quotation",
        "invoice": "Billing Note / Invoice",
        "billing_note": "Billing Note / Invoice",
        "delivery_note": "Delivery Note",
        "tax_invoice": "Tax Invoice",
        "receipt": "Receipt",
        "credit_note": "Credit Note",
        "debit_note": "Debit Note",
    },
    "th": {
        "quotation": "ใบเสนอราคา",
        "invoice": "ใบวางบิล/ใบแจ้งหนี้",
        "billing_note": "ใบวางบิล/ใบแจ้งหนี้",
        "delivery_note": "ใบส่งของ",
        "tax_invoice": "ใบกำกับภาษี",
        "receipt": "ใบเสร็จรับเงิน",
        "credit_note": "ใบลดหนี้",
        "debit_note": "ใบเพิ่มหนี้",
    },
}


def _language(record: dict[str, Any]) -> str:
    return "th" if str(record.get("documentLanguage") or record.get("language") or "").lower().startswith("th") else "en"


def _document_title(record: dict[str, Any], kind: str, language: str) -> str:
    explicit = str(record.get("documentTitle") or "").strip()
    if explicit:
        return explicit
    labels = DOCUMENT_LABELS[language]
    seen: list[str] = []
    for document_type in _document_types(record, kind):
        normalized = "invoice" if document_type == "billing_note" else document_type
        if normalized not in seen:
            seen.append(normalized)
    return "/".join(labels.get(document_type, document_type.replace("_", " ").title()) for document_type in seen)


def _document_subtitle(record: dict[str, Any], kind: str, language: str) -> str:
    labels = DOCUMENT_LABELS["en" if language == "th" else "th"]
    seen: list[str] = []
    for document_type in _document_types(record, kind):
        normalized = "invoice" if document_type == "billing_note" else document_type
        if normalized not in seen:
            seen.append(normalized)
    return " / ".join(labels.get(document_type, document_type.replace("_", " ").title()) for document_type in seen)


def _copy_kinds(record: dict[str, Any]) -> list[str]:
    copy_generation = str(record.get("copyGeneration") or record.get("documentCopy") or "both")
    if copy_generation == "original":
        return ["original"]
    if copy_generation == "copy":
        return ["copy"]
    return ["original", "copy"]


def _party_lines(party: dict[str, Any], fallback_name: str = "-") -> list[str]:
    lines = [
        party.get("name") or fallback_name,
        party.get("address"),
        " ".join(str(item or "").strip() for item in [party.get("district"), party.get("province"), party.get("postcode")] if str(item or "").strip()),
        party.get("taxId") or party.get("vatId"),
        party.get("phone"),
        party.get("email"),
    ]
    return [str(item).strip() for item in lines if str(item or "").strip()]


def _initials(name: str) -> str:
    words = [item for item in name.replace(".", " ").split() if item]
    if not words:
        return "MA"
    return "".join(word[0].upper() for word in words[:2])[:3]


def _asset_data_uri(relative_path: str | None) -> str:
    if not relative_path:
        return ""
    try:
        path = resolve_storage_path(relative_path)
        if not path.exists() or not path.is_file():
            return ""
        suffix = path.suffix.lower()
        mime = "image/png"
        if suffix in {".jpg", ".jpeg"}:
            mime = "image/jpeg"
        elif suffix == ".svg":
            mime = "image/svg+xml"
        encoded = base64.b64encode(path.read_bytes()).decode("ascii")
        return f"data:{mime};base64,{encoded}"
    except Exception:
        return ""


def _info_rows(record: dict[str, Any], labels: dict[str, str]) -> list[tuple[str, str]]:
    reference_documents = [item for item in record.get("referenceDocuments", []) or [] if isinstance(item, dict)]
    quotation = next(
        (
            item
            for item in reference_documents
            if item.get("kind") == "quotation" or item.get("type") == "quotation" or "quotation" in (item.get("documentTypes") or [])
        ),
        None,
    )
    rows = [
        (labels["document_no"], record.get("number") or record.get("id") or "-"),
    ]
    if quotation:
        rows.append((labels["quotation_no"], quotation.get("number") or quotation.get("id") or "-"))
    elif record.get("sourceDocumentNumber") or record.get("sourceDocumentId"):
        rows.append((labels["quotation_no"], record.get("sourceDocumentNumber") or record.get("sourceDocumentId")))
    if str(record.get("reference") or "").strip():
        rows.append((labels["customer_po"], record.get("reference")))
    rows.extend(
        [
            (labels["issue_date"], record.get("date") or record.get("issueDate") or "-"),
            (labels["due_date"], record.get("due") or record.get("expiryDate") or "-"),
            (labels["credit_terms"], f"{record.get('creditTerms')} วัน" if str(record.get("creditTerms") or "").strip() else "-"),
            (labels["salesperson"], (record.get("sellerUserInfo") or {}).get("name") or record.get("salesperson") or record.get("documentContact") or "-"),
        ]
    )
    return rows


def _line_rows(record: dict[str, Any], labels: dict[str, str], currency: str) -> str:
    rows: list[str] = []
    for index, line in enumerate(record.get("lines", []) or [], start=1):
        code = _escape(line.get("displayCode") or line.get("sku") or "")
        description = _escape(line.get("desc") or line.get("description") or f"{labels['description']} {index}")
        details = str(line.get("details") or "").strip()
        details_html = f"<div class=\"line-detail\">{html.escape(details)}</div>" if details else ""
        amount = next(
            (
                line.get(key)
                for key in ("lineTotal", "totalAmount", "amountBeforeVat", "amount")
                if line.get(key) not in (None, "")
            ),
            _float(line.get("qty")) * _float(line.get("price")),
        )
        rows.append(
            "<tr>"
            f"<td class=\"code\">{code or '-'}</td>"
            f"<td class=\"description\"><strong>{index}. {description}</strong>{details_html}</td>"
            f"<td class=\"num\">{_number(line.get('qty'))}</td>"
            f"<td class=\"num\">{_money(line.get('price'), currency)}</td>"
            f"<td class=\"num\">{_percent(line.get('vatRate', line.get('tax')))}</td>"
            f"<td class=\"num strong\">{_money(amount, currency)}</td>"
            "</tr>"
        )
    if not rows:
        rows.append(f"<tr><td colspan=\"6\" class=\"empty\">{_escape(labels['description'])}</td></tr>")
    return "\n".join(rows)


def _payment_lines(record: dict[str, Any]) -> list[str]:
    method = str(record.get("paymentMethod") or "").strip()
    details = record.get("paymentDetails") if isinstance(record.get("paymentDetails"), dict) else {}
    selected_bank = details.get("selectedBankAccount") if isinstance(details.get("selectedBankAccount"), dict) else {}
    if method == "Bank Transfer" and selected_bank:
        return [
            str(selected_bank.get("bankName") or "").strip(),
            f"Account name: {selected_bank.get('accountName')}" if selected_bank.get("accountName") else "",
            f"Account number: {selected_bank.get('accountNumber')}" if selected_bank.get("accountNumber") else "",
            f"Branch: {selected_bank.get('branch')}" if selected_bank.get("branch") else "",
            f"SWIFT: {selected_bank.get('swiftCode')}" if selected_bank.get("swiftCode") else "",
            f"PromptPay: {selected_bank.get('promptPayId')}" if selected_bank.get("promptPayId") else "",
        ]
    if method == "Bank Transfer":
        return [
            str(details.get("bankAccount") or "").strip(),
            str(details.get("accountName") or "").strip(),
            str(details.get("accountNumber") or "").strip(),
        ]
    if method == "Cheque":
        return [
            f"Cheque: {details.get('chequeNumber')}" if details.get("chequeNumber") else "",
            str(details.get("chequeBankName") or "").strip(),
            str(details.get("chequeDate") or "").strip(),
        ]
    if method == "Credit Card":
        return [
            str(details.get("cardType") or "").strip(),
            f"Approval: {details.get('approvalCode')}" if details.get("approvalCode") else "",
        ]
    if method == "PromptPay":
        return [str(details.get("promptPayId") or selected_bank.get("promptPayId") or "").strip()]
    if method == "Other":
        return [str(details.get("otherNote") or "").strip()]
    return [method]


def _payment_html(record: dict[str, Any]) -> str:
    lines = [line for line in _payment_lines(record) if line]
    if not lines:
        return "<p>-</p>"
    heading = _escape(lines[0])
    details = "".join(f"<p>{_escape(line)}</p>" for line in lines[1:])
    return f"""
      <div class="bank-card">
        <div class="bank-strip"></div>
        <div>
          <strong>{heading}</strong>
          {details}
        </div>
      </div>
    """


def _summary_html(record: dict[str, Any], labels: dict[str, str], currency: str) -> str:
    subtotal = float(record.get("amountBeforeVat", record.get("subtotal", record.get("amount", 0))) or 0)
    discount = float(record.get("totalDiscount", 0) or 0)
    vat = float(record.get("taxAmount", record.get("vat", 0)) or 0)
    total = float(record.get("amount", subtotal + vat) or 0)
    withholding = float(record.get("totalWithholdingTax", record.get("withholdingAmount", 0)) or 0)
    paid = float(record.get("amountPaid", 0) or 0)
    amount_due = float(record.get("amountDue", total - withholding - paid) or 0)
    rows = [
        (labels["subtotal_before_discount"], record.get("subtotalBeforeDiscount", subtotal + discount), False),
    ]
    if discount:
        rows.append((labels["total_discount"], discount, False))
    rows.extend(
        [
            (labels["amount_before_vat"], subtotal, False),
            (labels["vat"], vat, False),
        ]
    )
    if withholding:
        rows.append((labels["withholding"], withholding, False))
    row_html = "\n".join(
        f"<div class=\"summary-row\"><span>{_escape(label)}</span><strong>{_money(value, currency)}</strong></div>"
        for label, value, _important in rows
    )
    return f"""
      {row_html}
      <div class="grand-total"><span>{labels["grand_total"]}</span><strong>{_money(total, currency)}</strong></div>
      <div class="summary-row muted"><span>{labels["paid"]}</span><strong>{_money(paid, currency)}</strong></div>
      <div class="summary-row due"><span>{labels["amount_due"]}</span><strong>{_money(amount_due, currency)}</strong></div>
    """


def _signature_html(record: dict[str, Any], labels: dict[str, str]) -> str:
    signature_uri = _asset_data_uri((record.get("brandingSnapshot") or {}).get("signaturePath"))
    signature_image = f"<img src=\"{signature_uri}\" alt=\"signature\" />" if signature_uri else ""
    date = _escape(record.get("date") or "")
    return f"""
      <section class="signatures">
        <div class="signature-box">
          <div class="signature-line">{signature_image}</div>
          <strong>{labels["receiver"]}</strong>
          <span>{labels["date"]}: ____/____/____</span>
        </div>
        <div class="signature-box">
          <div class="signature-line">{signature_image}</div>
          <strong>{labels["authorized"]}</strong>
          <span>{labels["date"]}: {date}</span>
        </div>
      </section>
    """


def render_document_html(kind: str, record: dict[str, Any]) -> str:
    language = _language(record)
    labels = LABELS[language]
    currency = str(record.get("currency") or "THB")
    title = _document_title(record, kind, language)
    title_class = _title_class(title)
    subtitle = _document_subtitle(record, kind, language)
    seller = record.get("sellerInfo") or {}
    customer_info = record.get("customerInfo") or {}
    seller_name = str(seller.get("name") or "Matter Acc.").strip()
    customer_name = str(record.get("customer") or customer_info.get("name") or record.get("receivedFrom") or "-").strip()
    seller_lines = _party_lines(seller, seller_name)
    customer_lines = _party_lines(customer_info, customer_name)
    logo_path = (record.get("brandingSnapshot") or {}).get("logoPath") or seller.get("logoPath")
    logo_uri = _asset_data_uri(logo_path)
    logo_html = f"<img src=\"{logo_uri}\" alt=\"logo\" />" if logo_uri else f"<span>{_escape(_initials(seller_name))}</span>"
    amount_words = record.get("amountInWordsThai") if language == "th" else record.get("amountInWordsEnglish")
    notes = record.get("notes") or record.get("paymentTerms") or ""

    pages = []
    for copy_kind in _copy_kinds(record):
        copy_label = labels[copy_kind]
        info_rows = "\n".join(
            f"<div class=\"info-row\"><span>{_escape(label)}</span><strong>{_escape(value)}</strong></div>"
            for label, value in _info_rows(record, labels)
        )
        pages.append(
            f"""
            <article class="page">
              <header class="doc-header">
                <div class="seller-head">
                  <div class="logo {'' if logo_uri else 'logo-fallback'}">{logo_html}</div>
                  <div>
                    <p class="eyebrow">{labels["seller"]}: <strong>{_escape(seller_name)}</strong></p>
                    <div class="party-lines">{"<br />".join(_escape(line) for line in seller_lines[1:])}</div>
                  </div>
                </div>
                <div class="title-zone">
                  <span class="copy-label">{_escape(copy_label)}</span>
                  <h1 class="{title_class}">{_escape(title)}</h1>
                  <p>{_escape(subtitle)}</p>
                </div>
              </header>

              <div class="divider"></div>

              <section class="main-info">
                <div class="party-card customer-card">
                  <h2>{labels["customer"]}</h2>
                  <strong>{_escape(customer_name)}</strong>
                  <div class="party-lines">{"<br />".join(_escape(line) for line in customer_lines[1:])}</div>
                </div>
                <div class="info-card">{info_rows}</div>
              </section>

              <section class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{labels["code"]}</th>
                      <th>{labels["description"]}</th>
                      <th class="num">{labels["qty"]}</th>
                      <th class="num">{labels["unit_price"]}</th>
                      <th class="num">{labels["vat"]}</th>
                      <th class="num">{labels["amount"]}</th>
                    </tr>
                  </thead>
                  <tbody>{_line_rows(record, labels, currency)}</tbody>
                </table>
              </section>

              <section class="bottom-grid">
                <div class="payment-card">
                  <h2>{labels["payment"]}</h2>
                  {_payment_html(record)}
                  {f'<h2 class="notes-title">{labels["notes"]}</h2><p>{_escape(notes)}</p>' if notes else ''}
                </div>
                <div class="summary-card">
                  <h2>{labels["summary"]}</h2>
                  {_summary_html(record, labels, currency)}
                  {f'<div class="amount-words"><span>{labels["amount_words"]}</span><strong>{_escape(amount_words)}</strong></div>' if amount_words else ''}
                </div>
              </section>

              {_signature_html(record, labels)}
            </article>
            """
        )

    return f"""<!doctype html>
<html lang="{language}">
<head>
  <meta charset="utf-8" />
  <title>{_escape(record.get("id") or record.get("number") or title)}</title>
  <style>
    @page {{ size: A4; margin: 0; }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background: #ffffff;
      color: #0f172a;
      font-family: "Noto Sans Thai", "Leelawadee UI", Tahoma, Arial, sans-serif;
      font-size: 10.7px;
      line-height: 1.4;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }}
    .page {{
      width: 210mm;
      min-height: 297mm;
      padding: 13.5mm 15.5mm;
      page-break-after: always;
      overflow: hidden;
    }}
    .page:last-child {{ page-break-after: auto; }}
    .doc-header {{ display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 76mm); gap: 9mm; align-items: start; padding-bottom: 9mm; border-bottom: 2px solid #2563eb; }}
    .seller-head {{ display: grid; grid-template-columns: 18mm minmax(0, 1fr); gap: 5mm; min-width: 0; }}
    .logo {{ width: 16.8mm; height: 16.8mm; border: 1px solid #ccfbf1; border-radius: 4.2mm; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #eff6ff; color: #2563eb; font-weight: 950; font-size: 18px; }}
    .logo img {{ width: 86%; height: 86%; object-fit: contain; }}
    .eyebrow {{ margin: 0 0 1mm; color: #2563eb; font-weight: 900; font-size: 11.2px; }}
    .party-lines {{ color: #334155; overflow-wrap: anywhere; word-break: break-word; }}
    .title-zone {{ text-align: right; min-width: 0; max-width: 100%; overflow: visible; }}
    .copy-label {{ display: inline-flex; border-radius: 999px; border: 1px solid #ccfbf1; background: #dcfce7; color: #2563eb; padding: 1mm 4mm; font-weight: 900; font-size: 8.8px; min-height: 22px; align-items: center; }}
    h1 {{ margin: 3mm 0 0.5mm; color: #2563eb; font-size: 30px; line-height: 1.24; font-weight: 950; letter-spacing: 0; max-width: 100%; white-space: nowrap; overflow: visible; padding: 0.5mm 0 1mm; }}
    h1.title-medium {{ font-size: 20px; line-height: 1.26; }}
    h1.title-long {{ font-size: 14px; line-height: 1.3; }}
    h1.title-extra-long {{ font-size: 11px; line-height: 1.34; }}
    .title-zone p {{ margin: 0; color: #64748b; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; font-size: 9.8px; }}
    .divider {{ display: none; }}
    .main-info {{ display: grid; grid-template-columns: minmax(0, 1fr) minmax(72mm, 82mm); gap: 7mm; margin-top: 8mm; align-items: start; }}
    .party-card, .info-card, .payment-card, .summary-card {{ border: 1px solid #dbeafe; border-radius: 4mm; padding: 5mm; min-width: 0; overflow-wrap: anywhere; word-break: break-word; break-inside: avoid; background: #fff; box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05); }}
    .customer-card {{ border-left: 1.2mm solid #2563eb; }}
    h2 {{ margin: 0 0 3mm; color: #2563eb; font-size: 10px; font-weight: 950; letter-spacing: .04em; }}
    .info-row {{ display: grid; grid-template-columns: 29mm minmax(0, 1fr); gap: 3mm; padding: 1.2mm 0; }}
    .info-row span {{ color: #64748b; font-weight: 700; }}
    .info-row strong {{ text-align: right; min-width: 0; overflow-wrap: anywhere; word-break: break-word; }}
    .table-wrap {{ margin-top: 8mm; }}
    table {{ width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed; border: 1px solid #dbeafe; border-radius: 3.5mm; overflow: hidden; }}
    thead {{ display: table-header-group; }}
    tr {{ break-inside: avoid; page-break-inside: avoid; }}
    th {{ background: #f1f5f9; color: #0f172a; font-size: 9.2px; padding: 2.2mm; text-align: left; border-bottom: 1px solid #b8c4d4; font-weight: 900; }}
    td {{ padding: 2.2mm; border-bottom: 1px solid #edf2f7; vertical-align: top; overflow-wrap: anywhere; word-break: break-word; }}
    tbody tr:last-child td {{ border-bottom: 0; }}
    th:nth-child(1), td:nth-child(1) {{ width: 21mm; }}
    th:nth-child(2), td:nth-child(2) {{ width: auto; }}
    th:nth-child(3), td:nth-child(3) {{ width: 17mm; }}
    th:nth-child(4), td:nth-child(4) {{ width: 28mm; }}
    th:nth-child(5), td:nth-child(5) {{ width: 17mm; }}
    th:nth-child(6), td:nth-child(6) {{ width: 28mm; }}
    .num {{ text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }}
    .strong {{ font-weight: 800; }}
    .line-detail {{ margin-top: 1mm; color: #64748b; font-size: 9px; }}
    .bottom-grid {{ border-top: 1px solid #b8c4d4; padding-top: 8mm; display: grid; grid-template-columns: minmax(0, 1fr) 78mm; gap: 7mm; margin-top: 9mm; align-items: start; }}
    .bank-card {{ display: grid; grid-template-columns: 5px minmax(0, 1fr); gap: 10px; border: 1px solid #dbeafe; border-radius: 3mm; padding: 4mm; background: #fff; }}
    .bank-strip {{ background: #2563eb; border-radius: 999px; }}
    .bank-card strong {{ display: block; margin-bottom: 1mm; color: #0f172a; }}
    .bank-card p {{ margin: 0; color: #334155; }}
    .summary-row {{ display: flex; justify-content: space-between; gap: 5mm; padding: 1.2mm 0; color: #475569; }}
    .summary-row strong {{ color: #0f172a; white-space: nowrap; }}
    .summary-row.muted {{ border-top: 1px solid #dbeafe; margin-top: 1.5mm; padding-top: 2.5mm; color: #64748b; font-weight: 800; }}
    .summary-row.due strong {{ color: #2563eb; font-size: 12.4px; }}
    .grand-total {{ background: linear-gradient(135deg, #2563eb 0%, #0f766e 100%); color: #fff; padding: 4mm 5mm; display: flex; justify-content: space-between; align-items: center; gap: 4mm; min-height: 13mm; border-radius: 4mm; box-shadow: 0 10px 22px rgba(15, 118, 110, 0.18); margin: 3mm 0; }}
    .grand-total span {{ font-weight: 900; color: rgba(255, 255, 255, 0.9); }}
    .grand-total strong {{ color: #fff; font-size: 18px; font-weight: 950; white-space: nowrap; }}
    .amount-words {{ margin-top: 3mm; border: 1px solid #dbeafe; border-radius: 3mm; background: #f8fafc; padding: 3mm; color: #475569; }}
    .amount-words strong {{ display: block; margin-top: 1mm; color: #0f172a; }}
    .notes-title {{ margin-top: 4mm; }}
    .signatures {{ display: grid; grid-template-columns: 1fr 1fr; gap: 12mm; margin-top: 12mm; break-inside: avoid; }}
    .signature-box {{ text-align: center; min-height: 28mm; }}
    .signature-line {{ height: 15mm; border-bottom: 1px solid #94a3b8; display: flex; align-items: end; justify-content: center; margin-bottom: 2mm; }}
    .signature-line img {{ max-height: 13mm; max-width: 55mm; object-fit: contain; }}
    .signature-box strong {{ display: block; }}
    .signature-box span {{ display: block; margin-top: 1mm; color: #64748b; }}
  </style>
</head>
<body>
  {"".join(pages)}
</body>
</html>"""


def _sanitize_preview_html(html_fragment: str) -> str:
    cleaned = re.sub(r"<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>", "", html_fragment, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s(on[a-z]+)\s*=\s*(['\"]).*?\2", "", cleaned, flags=re.IGNORECASE | re.DOTALL)
    cleaned = re.sub(r"\s(on[a-z]+)\s*=\s*[^\s>]+", "", cleaned, flags=re.IGNORECASE)
    return cleaned


def render_preview_html_shell(html_fragment: str) -> str:
    cleaned = _sanitize_preview_html(html_fragment)
    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page {{ size: A4 portrait; margin: 0; }}
    html, body {{
      margin: 0;
      padding: 0;
      width: 210mm;
      min-height: 297mm;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }}
    body {{
      overflow: visible;
    }}
    .sales-document-print-root.sales-document-pdf-export {{
      width: auto !important;
      min-height: 0 !important;
      padding: 0 !important;
      gap: 0 !important;
      background: #ffffff !important;
      align-items: flex-start !important;
    }}
  </style>
</head>
<body>
  {cleaned}
</body>
</html>"""


def _chrome_candidates() -> list[str]:
    candidates = [
        os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH"),
        os.environ.get("CHROME_PATH"),
        os.environ.get("CHROMIUM_PATH"),
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
        "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
        "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
        "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
        shutil.which("google-chrome"),
        shutil.which("chromium"),
        shutil.which("chromium-browser"),
        shutil.which("msedge"),
    ]
    return [str(item) for item in candidates if item]


def _print_with_playwright(html_text: str, path: Path) -> bool:
    try:
        from playwright.sync_api import sync_playwright
    except Exception:
        return False

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1240, "height": 1754}, device_scale_factor=1)
            page.set_content(html_text, wait_until="networkidle")
            page.pdf(
                path=str(path),
                format="A4",
                print_background=True,
                prefer_css_page_size=True,
                margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
            )
            browser.close()
        return path.exists() and path.stat().st_size > 1000
    except Exception:
        return False


def _print_with_chromium_cli(html_text: str, path: Path) -> bool:
    for executable in _chrome_candidates():
        if not Path(executable).exists() and not shutil.which(executable):
            continue
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            html_path = temp_path / "document.html"
            profile_path = temp_path / "chrome-profile"
            html_path.write_text(html_text, encoding="utf-8")
            command = [
                executable,
                "--headless=new",
                "--disable-gpu",
                "--no-sandbox",
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-dev-shm-usage",
                "--no-pdf-header-footer",
                "--run-all-compositor-stages-before-draw",
                "--virtual-time-budget=1000",
                f"--user-data-dir={profile_path}",
                f"--print-to-pdf={path.resolve()}",
                html_path.resolve().as_uri(),
            ]
            try:
                subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=45)
            except Exception:
                continue
            if path.exists() and path.stat().st_size > 1000:
                return True
    return False


def generate_html_document_pdf(path: Path, kind: str, record: dict[str, Any]) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    html_text = render_document_html(kind, record)
    if _print_with_playwright(html_text, path) or _print_with_chromium_cli(html_text, path):
        return path
    raise RuntimeError("Chromium PDF rendering is unavailable.")


def generate_html_fragment_pdf(path: Path, html_fragment: str) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    html_text = render_preview_html_shell(html_fragment)
    if _print_with_playwright(html_text, path) or _print_with_chromium_cli(html_text, path):
        return path
    raise RuntimeError("Chromium PDF rendering is unavailable.")

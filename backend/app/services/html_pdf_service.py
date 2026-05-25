from __future__ import annotations

import base64
import html
import os
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
        amount = line.get("lineTotal", line.get("totalAmount", line.get("amount", 0)))
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


def _summary_rows(record: dict[str, Any], labels: dict[str, str], currency: str) -> str:
    subtotal = float(record.get("amountBeforeVat", record.get("subtotal", record.get("amount", 0))) or 0)
    discount = float(record.get("totalDiscount", 0) or 0)
    vat = float(record.get("taxAmount", record.get("vat", 0)) or 0)
    total = float(record.get("amount", subtotal + vat) or 0)
    withholding = float(record.get("totalWithholdingTax", record.get("withholdingAmount", 0)) or 0)
    amount_due = float(record.get("amountDue", total - withholding) or 0)
    rows = [
        (labels["subtotal_before_discount"], record.get("subtotalBeforeDiscount", subtotal + discount), False),
    ]
    if discount:
        rows.append((labels["total_discount"], discount, False))
    rows.extend(
        [
            (labels["amount_before_vat"], subtotal, False),
            (labels["vat"], vat, False),
            (labels["grand_total"], total, True),
        ]
    )
    if withholding:
        rows.extend(
            [
                (labels["withholding"], withholding, False),
                (labels["amount_due"], amount_due, True),
            ]
        )
    return "\n".join(
        f"<div class=\"summary-row {'total' if important else ''}\"><span>{_escape(label)}</span><strong>{_money(value, currency)}</strong></div>"
        for label, value, important in rows
    )


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
                  <h1>{_escape(title)}</h1>
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
                  <p>{_escape(record.get("paymentMethod") or "-")}</p>
                  <p>{_escape(record.get("paymentTerms") or "")}</p>
                  {f'<h2 class="notes-title">{labels["notes"]}</h2><p>{_escape(notes)}</p>' if notes else ''}
                </div>
                <div class="summary-card">
                  <h2>{labels["summary"]}</h2>
                  {_summary_rows(record, labels, currency)}
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
      font-family: Tahoma, "Noto Sans Thai", Arial, sans-serif;
      font-size: 10.5px;
      line-height: 1.38;
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
    .doc-header {{ display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 72mm); gap: 14mm; align-items: start; }}
    .seller-head {{ display: grid; grid-template-columns: 20mm minmax(0, 1fr); gap: 7mm; min-width: 0; }}
    .logo {{ width: 18mm; height: 18mm; border: 1px solid #bfdbfe; border-radius: 5mm; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #eff6ff; color: #1d4ed8; font-weight: 800; font-size: 14px; }}
    .logo img {{ width: 100%; height: 100%; object-fit: contain; }}
    .eyebrow {{ margin: 0 0 2mm; color: #1d4ed8; font-weight: 700; }}
    .party-lines {{ color: #334155; overflow-wrap: anywhere; word-break: break-word; }}
    .title-zone {{ text-align: right; min-width: 0; }}
    .copy-label {{ display: inline-flex; border-radius: 999px; background: #dcfce7; color: #166534; padding: 1.5mm 5mm; font-weight: 800; font-size: 10px; }}
    h1 {{ margin: 4mm 0 1mm; color: #1d4ed8; font-size: 22px; line-height: 1.08; overflow-wrap: anywhere; word-break: break-word; }}
    .title-zone p {{ margin: 0; color: #64748b; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }}
    .divider {{ height: 1px; background: #2563eb; margin: 11mm 0 9mm; }}
    .main-info {{ display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, .95fr); gap: 8mm; align-items: start; }}
    .party-card, .info-card, .payment-card, .summary-card {{ border: 1px solid #dbeafe; border-radius: 4mm; padding: 5mm; min-width: 0; overflow-wrap: anywhere; word-break: break-word; break-inside: avoid; }}
    .customer-card {{ border-left: 1.4mm solid #2563eb; }}
    h2 {{ margin: 0 0 3mm; color: #1d4ed8; font-size: 11px; }}
    .info-row {{ display: grid; grid-template-columns: 29mm minmax(0, 1fr); gap: 3mm; padding: 1.2mm 0; }}
    .info-row span {{ color: #64748b; font-weight: 700; }}
    .info-row strong {{ text-align: right; min-width: 0; overflow-wrap: anywhere; word-break: break-word; }}
    .table-wrap {{ margin-top: 8mm; }}
    table {{ width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed; border: 1px solid #bfdbfe; border-radius: 3mm; overflow: hidden; }}
    thead {{ display: table-header-group; }}
    tr {{ break-inside: avoid; page-break-inside: avoid; }}
    th {{ background: #eff6ff; color: #1e40af; font-size: 9.2px; padding: 2.2mm; text-align: left; border-bottom: 1px solid #bfdbfe; }}
    td {{ padding: 2.4mm 2.2mm; border-bottom: 1px solid #e2e8f0; vertical-align: top; overflow-wrap: anywhere; word-break: break-word; }}
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
    .bottom-grid {{ display: grid; grid-template-columns: minmax(0, 1fr) 68mm; gap: 8mm; margin-top: 9mm; align-items: start; }}
    .summary-row {{ display: flex; justify-content: space-between; gap: 5mm; padding: 1.2mm 0; color: #475569; }}
    .summary-row strong {{ color: #0f172a; white-space: nowrap; }}
    .summary-row.total {{ margin-top: 1.2mm; border-top: 1px solid #bfdbfe; padding-top: 2.4mm; font-size: 12px; color: #0f172a; font-weight: 900; }}
    .amount-words {{ margin-top: 3mm; border-top: 1px dashed #bfdbfe; padding-top: 2.4mm; color: #475569; }}
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

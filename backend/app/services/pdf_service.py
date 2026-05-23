from __future__ import annotations

from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

from .storage_service import resolve_storage_path


PAGE_WIDTH, PAGE_HEIGHT = A4
FONT_REGULAR = "Helvetica"
FONT_BOLD = "Helvetica-Bold"


def _register_fonts() -> None:
    global FONT_REGULAR, FONT_BOLD
    candidates = [
        (Path("C:/Windows/Fonts/tahoma.ttf"), Path("C:/Windows/Fonts/tahomabd.ttf"), "TahomaMatter"),
        (Path("C:/Windows/Fonts/arial.ttf"), Path("C:/Windows/Fonts/arialbd.ttf"), "ArialMatter"),
    ]
    for regular, bold, name in candidates:
        if regular.exists() and bold.exists():
            try:
                pdfmetrics.registerFont(TTFont(name, str(regular)))
                pdfmetrics.registerFont(TTFont(f"{name}-Bold", str(bold)))
                FONT_REGULAR = name
                FONT_BOLD = f"{name}-Bold"
                return
            except Exception:
                continue


_register_fonts()


def _currency(value: float, currency: str = "THB") -> str:
    prefix = "THB " if currency == "THB" else f"{currency} "
    return f"{prefix}{value:,.2f}"


def _draw_kv(pdf: canvas.Canvas, x: float, y: float, label: str, value: str, label_color=colors.HexColor("#6b7280")) -> None:
    pdf.setFillColor(label_color)
    pdf.setFont(FONT_REGULAR, 9)
    pdf.drawString(x, y, label)
    pdf.setFillColor(colors.black)
    pdf.setFont(FONT_BOLD, 10)
    pdf.drawString(x, y - 12, value)


def _draw_table(
    pdf: canvas.Canvas,
    x: float,
    y: float,
    width: float,
    lines: list[dict[str, Any]],
    currency: str,
    *,
    show_wht: bool = False,
) -> float:
    headers = [
        ("Description", 0.43 if show_wht else 0.48),
        ("Qty", 0.10),
        ("Unit Price", 0.17),
        ("Tax", 0.09),
        *([("WHT", 0.08)] if show_wht else []),
        ("Amount", 0.16),
    ]
    pdf.setFillColor(colors.HexColor("#eff6ff"))
    pdf.rect(x, y - 18, width, 18, fill=1, stroke=0)
    pdf.setFillColor(colors.HexColor("#1d4ed8"))
    pdf.setFont(FONT_BOLD, 9)

    cursor = x + 10
    column_widths = []
    for title, ratio in headers:
        column_width = width * ratio
        column_widths.append(column_width)
        pdf.drawString(cursor, y - 12, title)
        cursor += column_width

    top = y - 18
    pdf.setFont(FONT_REGULAR, 9)
    pdf.setFillColor(colors.black)

    for line in lines:
        top -= 22
        pdf.setStrokeColor(colors.HexColor("#e5e7eb"))
        pdf.line(x, top, x + width, top)

        code = str(line.get("displayCode") or line.get("sku") or "").strip()
        desc_text = str(line.get("desc", "")).strip()
        desc = (f"{code} - {desc_text}" if code else desc_text)[:58]
        qty = f"{float(line.get('qty', 0)):g}"
        price = _currency(float(line.get("price", 0)), currency)
        tax = f"{float(line.get('vatRate', line.get('tax', 0))):g}%"
        wht = f"{float(line.get('withholdingRate', 0)):g}%"
        amount = _currency(float(line.get("amount", 0)), currency)

        values = [desc, qty, price, tax, *([wht] if show_wht else []), amount]
        cursor = x + 10
        for index, value in enumerate(values):
            column_width = column_widths[index]
            if index == 0:
                pdf.drawString(cursor, top + 7, value)
            else:
                value_width = stringWidth(value, FONT_REGULAR, 9)
                pdf.drawString(cursor + column_width - value_width - 10, top + 7, value)
            cursor += column_width

    return top - 16


def _copy_kinds(record: dict[str, Any]) -> list[str]:
    copy_generation = str(record.get("copyGeneration") or record.get("documentCopy") or "both")
    if copy_generation == "original":
        return ["original"]
    if copy_generation == "copy":
        return ["copy"]
    return ["original", "copy"]


def _label(record: dict[str, Any], en: str, th: str) -> str:
    return th if str(record.get("documentLanguage", "en")).lower() == "th" else en


SIGNATURE_LABELS = {
    "quotation": {"en": ("Customer acceptance", "Prepared by"), "th": ("ผู้ยอมรับใบเสนอราคา", "ผู้เสนอราคา")},
    "delivery_note": {"en": ("Receiver", "Sender"), "th": ("ผู้รับของ", "ผู้ส่งของ")},
    "invoice": {"en": ("Received by", "Issuer"), "th": ("ผู้รับเอกสาร", "ผู้ออกเอกสาร")},
    "tax_invoice": {"en": ("Received by", "Tax Invoice Issuer"), "th": ("ผู้รับเอกสาร", "ผู้ออกใบกำกับภาษี")},
    "billing_note": {"en": ("Billing Received by", "Billing Issuer"), "th": ("ผู้รับวางบิล", "ผู้วางบิล")},
    "receipt": {"en": ("Paid by", "Payment Receiver"), "th": ("ผู้ชำระเงิน", "ผู้รับเงิน")},
}


def _signature_labels(record: dict[str, Any], kind: str) -> tuple[str, str]:
    document_types = record.get("documentTypes") or [kind]
    received_by = _label(record, "Received by", "ผู้รับเอกสาร")
    authorized_signature = _label(record, "Authorized Signature", "ผู้มีอำนาจลงนาม")
    approved_by = _label(record, "Approved By", "ผู้อนุมัติ")
    received_goods_by = _label(record, "Received By", "ผู้รับสินค้า")
    for document_type in document_types:
        if document_type == "purchase_order":
            return received_by, approved_by
        if document_type in {"receiving_inventory", "delivery_note"}:
            return received_goods_by, received_goods_by
    return received_by, authorized_signature


def _group_rows(record: dict[str, Any], key: str, fallback_label: str, fallback_amount: float) -> list[tuple[str, float]]:
    rows = []
    for group in record.get(key, []) or []:
        try:
            rate = int(float(group.get("rate", 0) or 0))
            amount = float(group.get("taxAmount", 0) or 0)
        except (TypeError, ValueError):
            continue
        if amount > 0 or rate > 0:
            rows.append((f"{fallback_label} {rate:g}%", amount))
    if rows:
        return rows
    return [(fallback_label, fallback_amount)] if fallback_amount else []


def _draw_signature_box(
    pdf: canvas.Canvas,
    x: float,
    y: float,
    width: float,
    height: float,
    label: str,
    name: str,
    date: str,
    signature_path: str = "",
) -> None:
    pdf.setStrokeColor(colors.HexColor("#e5e7eb"))
    pdf.roundRect(x, y, width, height, 5, stroke=1, fill=0)
    line_y = y + 42
    if signature_path:
        try:
            path = resolve_storage_path(signature_path)
            if path.exists():
                image = ImageReader(str(path))
                image_width, image_height = image.getSize()
                max_width = width - 32
                max_height = 18 * mm
                scale = min(max_width / image_width, max_height / image_height)
                draw_width = image_width * scale
                draw_height = image_height * scale
                pdf.drawImage(
                    image,
                    x + (width - draw_width) / 2,
                    line_y + 4,
                    width=draw_width,
                    height=draw_height,
                    preserveAspectRatio=True,
                    mask="auto",
                )
        except Exception:
            pass
    pdf.setStrokeColor(colors.HexColor("#cbd5e1"))
    pdf.line(x + 14, line_y, x + width - 14, line_y)
    pdf.setFillColor(colors.black)
    pdf.setFont(FONT_BOLD, 10)
    pdf.drawCentredString(x + width / 2, line_y - 14, name or " ")
    pdf.setFillColor(colors.HexColor("#475569"))
    pdf.setFont(FONT_REGULAR, 9)
    pdf.drawCentredString(x + width / 2, line_y - 28, label)
    pdf.drawCentredString(x + width / 2, line_y - 41, date or "____/____/____")


SIGNATURE_APPROVED_STATUSES = {"approved", "paid", "partial", "partially_paid", "completed"}


def _should_render_uploaded_signature(record: dict[str, Any], slot: str) -> bool:
    if slot != "authorized":
        return False
    status = str(record.get("status", "") or "").strip().lower()
    return not status or status in SIGNATURE_APPROVED_STATUSES


def generate_document_pdf(path: Path, kind: str, record: dict[str, Any]) -> Path:
    pdf = canvas.Canvas(str(path), pagesize=A4)
    left = 20 * mm
    right = PAGE_WIDTH - (20 * mm)
    width = right - left
    currency = record.get("currency", "THB")

    document_title = str(record.get("documentTitle") or record.get("documentVariant") or kind.replace("_", " ").title())

    pdf.setTitle(record.get("id") or record.get("number") or f"{kind}-document")
    for copy_kind in _copy_kinds(record):
        cursor_y = PAGE_HEIGHT - (20 * mm)
        copy_label = _label(record, "Original", "ต้นฉบับ") if copy_kind == "original" else _label(record, "Copy", "สำเนา")

        pdf.setStrokeColor(colors.HexColor("#dbeafe"))
        pdf.setFillColor(colors.HexColor("#1d4ed8"))
        pdf.setFont(FONT_BOLD, 22)
        pdf.drawString(left, cursor_y, document_title[:80])
        pdf.setFillColor(colors.HexColor("#334155"))
        pdf.setFont(FONT_REGULAR, 10)
        pdf.drawString(left, cursor_y - 16, str(record.get("documentVariant") or "Matter Acc. generated document")[:90])
        pdf.setFont(FONT_BOLD, 11)
        pdf.drawRightString(right, cursor_y, copy_label)
        pdf.setFont(FONT_BOLD, 13)
        pdf.drawRightString(right, cursor_y - 18, str(record.get("number") or record.get("id") or "-"))

        cursor_y -= 44
        pdf.setStrokeColor(colors.HexColor("#dbeafe"))
        pdf.line(left, cursor_y, right, cursor_y)
        cursor_y -= 24

        seller = record.get("sellerInfo") or {}
        seller_user = record.get("sellerUserInfo") or {}
        seller_user_name = str(seller_user.get("name") or "").strip()
        seller_user_email = str(seller_user.get("email") or "").strip()
        seller_user_value = (
            f"{seller_user_name}{f' ({seller_user_email})' if seller_user_email else ''}".strip()
            or record.get("documentContact")
            or "-"
        )
        customer_info = record.get("customerInfo") or {}
        party_value = record.get("customer") or customer_info.get("name") or record.get("vendor") or record.get("receivedFrom") or "-"
        _draw_kv(pdf, left, cursor_y, _label(record, "Seller", "ผู้ขาย"), seller.get("name") or "-")
        _draw_kv(pdf, left + 88 * mm, cursor_y, _label(record, "Customer", "ลูกค้า"), party_value)
        _draw_kv(pdf, left + 145 * mm, cursor_y, _label(record, "Status", "สถานะ"), str(record.get("status", "draft")).title())

        cursor_y -= 42
        _draw_kv(pdf, left, cursor_y, _label(record, "Issue date", "วันที่ออก"), record.get("date", "-"))
        _draw_kv(pdf, left + 45 * mm, cursor_y, _label(record, "Due date", "วันครบกำหนด"), record.get("due") or record.get("expiryDate") or "-")
        reference_documents = record.get("referenceDocuments") or []
        reference_value = ", ".join(
            str(item.get("number") or item.get("id"))
            for item in reference_documents
            if isinstance(item, dict) and (item.get("number") or item.get("id"))
        )
        _draw_kv(pdf, left + 90 * mm, cursor_y, _label(record, "Reference", "อ้างอิง"), reference_value or record.get("reference") or record.get("relatedDocument") or "-")
        _draw_kv(pdf, left + 135 * mm, cursor_y, _label(record, "Currency", "สกุลเงิน"), currency)

        cursor_y -= 20
        _draw_kv(pdf, left + 90 * mm, cursor_y, _label(record, "Seller", "ผู้ขาย"), seller_user_value)

        cursor_y -= 28
        lines = record.get("lines", [])
        if lines:
            document_settings = record.get("documentSettingsSnapshot") or {}
            cursor_y = _draw_table(
                pdf,
                left,
                cursor_y,
                width,
                lines,
                currency,
                show_wht=bool(document_settings.get("perLineWithholdingTax")),
            )

        subtotal = float(record.get("subtotal", record.get("amountBeforeVat", record.get("amount", 0))))
        discount = float(record.get("totalDiscount", 0))
        tax_amount = float(record.get("taxAmount", record.get("vat", 0)))
        total = float(record.get("amount", subtotal + tax_amount))
        withholding = float(record.get("withholdingAmount", 0))
        due_amount = float(record.get("amountDue", total - withholding))

        summary_left = right - 78 * mm
        pdf.setStrokeColor(colors.HexColor("#e5e7eb"))
        pdf.line(summary_left, cursor_y + 8, right, cursor_y + 8)
        summary_rows = [
            (_label(record, "Subtotal before discount", "ยอดก่อนหักส่วนลด"), float(record.get("subtotalBeforeDiscount", subtotal + discount))),
            (_label(record, "Total discount", "ส่วนลดรวม"), discount),
            (_label(record, "Amount before VAT", "ยอดก่อน VAT"), subtotal),
            *_group_rows(record, "vatGroups", _label(record, "VAT", "ภาษีมูลค่าเพิ่ม"), tax_amount),
            (_label(record, "Grand total", "ยอดรวมสุทธิ"), total),
            *_group_rows(record, "withholdingGroups", _label(record, "WHT", "หัก ณ ที่จ่าย"), withholding),
            (_label(record, "Total withholding tax", "รวมภาษีหัก ณ ที่จ่าย"), withholding),
            (_label(record, "Amount after withholding", "ยอดชำระหลังหัก ณ ที่จ่าย"), due_amount),
        ]
        row_y = cursor_y - 10
        for index, (label, value) in enumerate(summary_rows):
            pdf.setFont(FONT_BOLD if index == len(summary_rows) - 1 else FONT_REGULAR, 10 if index == len(summary_rows) - 1 else 9)
            pdf.setFillColor(colors.black if index == len(summary_rows) - 1 else colors.HexColor("#475569"))
            pdf.drawString(summary_left, row_y, label)
            pdf.drawRightString(right, row_y, _currency(value, currency))
            row_y -= 15

        deductions = record.get("invoiceDeductions") or []
        if deductions:
            pdf.setFont(FONT_REGULAR, 9)
            pdf.setFillColor(colors.HexColor("#475569"))
            for deduction in deductions[:6]:
                deduction_type = str(deduction.get("type") or "")
                label = _label(
                    record,
                    "Deduct deposit" if deduction_type == "deposit" else "Deduct paid amount",
                    "หักเงินมัดจำ" if deduction_type == "deposit" else "หักยอดที่ชำระแล้ว",
                )
                amount = float(deduction.get("amount", 0) or 0)
                ref = str(deduction.get("label") or deduction.get("id") or "")
                pdf.drawString(summary_left, row_y, f"{label} {ref}".strip())
                pdf.drawRightString(right, row_y, f"-{_currency(amount, currency)}")
                row_y -= 12

        schedule = record.get("invoicePaymentSchedule") or []
        if record.get("invoicePaymentMode") == "partial_payment" and schedule:
            row_y -= 4
            pdf.setFillColor(colors.HexColor("#0f172a"))
            pdf.setFont(FONT_BOLD, 9)
            pdf.drawString(summary_left, row_y, _label(record, "Payment schedule", "ตารางชำระ"))
            row_y -= 13
            pdf.setFont(FONT_REGULAR, 8)
            pdf.setFillColor(colors.HexColor("#475569"))
            for item in schedule[:6]:
                label = str(item.get("label") or _label(record, "Installment", "งวดที่"))
                amount = float(item.get("amount", 0) or 0)
                due_date = str(item.get("dueDate") or "")
                pdf.drawString(summary_left, row_y, f"{label}{f' ({due_date})' if due_date else ''}")
                pdf.drawRightString(right, row_y, _currency(amount, currency))
                row_y -= 12

        notes = record.get("notes") or record.get("description") or ""
        if notes:
            row_y -= 12
            pdf.setFillColor(colors.HexColor("#475569"))
            pdf.setFont(FONT_BOLD, 10)
            pdf.drawString(left, row_y, _label(record, "Notes", "หมายเหตุ"))
            pdf.setFillColor(colors.black)
            pdf.setFont(FONT_REGULAR, 9)
            text = pdf.beginText(left, row_y - 14)
            text.setLeading(13)
            for chunk in str(notes).splitlines() or [""]:
                text.textLine(chunk[:95])
            pdf.drawText(text)

        customer_label, company_label = _signature_labels(record, kind)
        signature_y = 34 * mm
        box_width = (width - 12 * mm) / 2
        branding_snapshot = record.get("brandingSnapshot") or {}
        _draw_signature_box(pdf, left, signature_y, box_width, 38 * mm, customer_label, record.get("customerAcknowledgement", ""), record.get("date", ""))
        _draw_signature_box(
            pdf,
            left + box_width + 12 * mm,
            signature_y,
            box_width,
            38 * mm,
            company_label,
            record.get("documentContact") or record.get("salesperson") or "",
            record.get("date", ""),
            str(branding_snapshot.get("signaturePath") or "") if _should_render_uploaded_signature(record, "authorized") else "",
        )

        pdf.setStrokeColor(colors.HexColor("#dbeafe"))
        pdf.line(left, 18 * mm, right, 18 * mm)
        pdf.setFillColor(colors.HexColor("#64748b"))
        pdf.setFont(FONT_REGULAR, 8)
        pdf.drawString(left, 12 * mm, "Generated by Matter Acc.")
        pdf.drawRightString(right, 12 * mm, copy_label)
        pdf.showPage()
    pdf.save()
    return path

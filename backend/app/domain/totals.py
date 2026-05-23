from __future__ import annotations

from typing import Any

from .enums import TaxMode


def round_money(value: Any) -> float:
    return round(float(value or 0), 2)


def normalize_percentage(value: Any) -> float:
    return round(sanitize_whole_percent(value) / 100, 6)


def sanitize_whole_percent(value: Any) -> int:
    try:
        numeric = float(value or 0)
    except (TypeError, ValueError):
        return 0
    if numeric < 0:
        return 0
    if numeric > 100:
        return 100
    return int(numeric)


def sanitize_withholding_rate(value: Any) -> int:
    rate = sanitize_whole_percent(value)
    return rate if rate in {0, 1, 2, 3, 5} else 0


def calculate_line_subtotal(qty: Any, unit_price: Any) -> float:
    return round_money(float(qty or 0) * float(unit_price or 0))


def calculate_line_discount_amount(
    qty: Any,
    unit_price: Any,
    discount: Any = 0,
    *,
    as_percent: bool = True,
) -> float:
    subtotal = calculate_line_subtotal(qty, unit_price)
    if subtotal <= 0:
        return 0.0
    discount_value = float(discount or 0)
    if as_percent:
        return round_money(subtotal * normalize_percentage(discount_value))
    return round_money(min(discount_value, subtotal))


def _line_discount_amount(line: dict[str, Any]) -> float:
    qty = line.get("qty", 0)
    price = line.get("price", 0)
    discount = line.get("discountValue", line.get("discount", line.get("disc", 0)))
    discount_type = str(line.get("discountType", "percent")).lower()
    return calculate_line_discount_amount(qty, price, discount, as_percent=discount_type != "amount")


def calculate_vat_amount(base_amount: Any, rate_percent: Any, mode: TaxMode = TaxMode.EXCLUSIVE) -> tuple[float, float]:
    amount = round_money(base_amount)
    if amount <= 0:
        return 0.0, 0.0

    rate = normalize_percentage(rate_percent)
    if mode == TaxMode.EXEMPT or rate <= 0:
        return amount, 0.0

    tax_amount = round_money(amount * rate)
    return amount, tax_amount


def calculate_document_totals(
    lines: list[dict[str, Any]] | tuple[dict[str, Any], ...],
    *,
    default_tax_rate: Any = 0,
    tax_mode: TaxMode = TaxMode.EXCLUSIVE,
    withholding_rate: Any = 0,
    vat_enabled: bool = True,
    per_line_withholding: bool = False,
) -> dict[str, float]:
    subtotal_before_discount = 0.0
    subtotal = 0.0
    discount_total = 0.0
    tax_total = 0.0

    for line in lines:
        qty = line.get("qty", 0)
        price = line.get("price", 0)
        discount_amount = _line_discount_amount(line)
        raw_subtotal = calculate_line_subtotal(qty, price)
        subtotal_before_discount = round_money(subtotal_before_discount + raw_subtotal)
        line_base = round_money(max(raw_subtotal - discount_amount, 0))
        _, tax_amount = calculate_vat_amount(
            line_base,
            line.get("vatRate", line.get("tax", default_tax_rate)) if vat_enabled else 0,
            tax_mode,
        )
        subtotal = round_money(subtotal + line_base)
        discount_total = round_money(discount_total + discount_amount)
        tax_total = round_money(tax_total + tax_amount)

    vat_groups = group_vat_totals_by_rate(
        lines,
        default_tax_rate=default_tax_rate,
        tax_mode=tax_mode,
        vat_enabled=vat_enabled,
        include_zero_rate=vat_enabled,
    )
    withholding_groups = group_withholding_totals_by_rate(
        lines,
        default_withholding_rate=withholding_rate,
        per_line_withholding=per_line_withholding,
    )
    withholding_amount = round_money(sum(group["taxAmount"] for group in withholding_groups))
    grand_total = round_money(subtotal + tax_total)
    total = round_money(grand_total - withholding_amount)
    return {
        "subtotal": subtotal,
        "subtotalBeforeDiscount": subtotal_before_discount,
        "totalDiscount": discount_total,
        "amountBeforeVat": subtotal,
        "discountAmount": discount_total,
        "taxAmount": tax_total,
        "withholdingAmount": withholding_amount,
        "totalWithholdingTax": withholding_amount,
        "grandTotal": grand_total,
        "remainingDue": total,
        "total": total,
        "vatGroups": vat_groups,
        "withholdingGroups": withholding_groups,
    }


def _line_taxable_base(line: dict[str, Any]) -> float:
    discount_amount = _line_discount_amount(line)
    return round_money(max(calculate_line_subtotal(line.get("qty", 0), line.get("price", 0)) - discount_amount, 0))


def _add_group(groups: dict[int, dict[str, float]], rate: int, taxable_base: float, tax_amount: float) -> None:
    current = groups.setdefault(rate, {"rate": float(rate), "taxableBase": 0.0, "taxAmount": 0.0})
    current["taxableBase"] = round_money(current["taxableBase"] + taxable_base)
    current["taxAmount"] = round_money(current["taxAmount"] + tax_amount)


def _sort_groups(groups: dict[int, dict[str, float]]) -> list[dict[str, float]]:
    return sorted(groups.values(), key=lambda item: item["rate"], reverse=True)


def group_vat_totals_by_rate(
    lines: list[dict[str, Any]] | tuple[dict[str, Any], ...],
    *,
    default_tax_rate: Any = 0,
    tax_mode: TaxMode = TaxMode.EXCLUSIVE,
    vat_enabled: bool = True,
    include_zero_rate: bool = False,
) -> list[dict[str, float]]:
    groups: dict[int, dict[str, float]] = {}
    for line in lines:
        taxable_base = _line_taxable_base(line)
        rate = sanitize_whole_percent(line.get("vatRate", line.get("tax", default_tax_rate)) if vat_enabled else 0)
        vat_base, vat_amount = calculate_vat_amount(taxable_base, rate, tax_mode)
        if rate > 0 or (include_zero_rate and vat_base > 0):
            _add_group(groups, rate, vat_base, vat_amount)
    return _sort_groups(groups)


def group_withholding_totals_by_rate(
    lines: list[dict[str, Any]] | tuple[dict[str, Any], ...],
    *,
    default_withholding_rate: Any = 0,
    per_line_withholding: bool = False,
    include_zero_rate: bool = False,
) -> list[dict[str, float]]:
    groups: dict[int, dict[str, float]] = {}
    for line in lines:
        taxable_base = _line_taxable_base(line)
        rate = sanitize_withholding_rate(line.get("withholdingRate") if per_line_withholding else default_withholding_rate)
        amount = round_money(taxable_base * normalize_percentage(rate))
        if taxable_base > 0 and (rate > 0 or include_zero_rate):
            _add_group(groups, rate, taxable_base, amount)
    return _sort_groups(groups)

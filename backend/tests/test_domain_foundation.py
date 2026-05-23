import unittest

from backend.app.domain import (
    build_document_number,
    build_linked_document_graph,
    calculate_document_totals,
    editable_after_payment,
    reset_required_before_delete,
    validate_cheque_date,
)


class DomainFoundationTests(unittest.TestCase):
    def test_document_totals_support_discount_vat_and_withholding(self):
        totals = calculate_document_totals(
            [
                {"qty": 2, "price": 1000, "tax": 7, "discount": 10},
                {"qty": 1, "price": 500, "tax": 7, "discount": 0},
            ],
            default_tax_rate=7,
            withholding_rate=3,
        )

        self.assertEqual(2300.0, totals["subtotal"])
        self.assertEqual(200.0, totals["discountAmount"])
        self.assertEqual(161.0, totals["taxAmount"])
        self.assertEqual(69.0, totals["withholdingAmount"])
        self.assertEqual(2392.0, totals["total"])

    def test_document_totals_group_vat_and_wht_by_whole_rate(self):
        totals = calculate_document_totals(
            [
                {"qty": 1, "price": 1000, "tax": 7.25, "withholdingRate": 0},
                {"qty": 1, "price": 2000, "tax": 7, "withholdingRate": 3.5},
                {"qty": 1, "price": 3000, "tax": 0, "withholdingRate": 7},
            ],
            default_tax_rate=7,
            per_line_withholding=True,
        )

        self.assertEqual(
            [
                {"rate": 7.0, "taxableBase": 3000.0, "taxAmount": 210.0},
                {"rate": 0.0, "taxableBase": 3000.0, "taxAmount": 0.0},
            ],
            totals["vatGroups"],
        )
        self.assertEqual(
            [{"rate": 3.0, "taxableBase": 2000.0, "taxAmount": 60.0}],
            totals["withholdingGroups"],
        )
        self.assertEqual(60.0, totals["totalWithholdingTax"])
        self.assertEqual(6150.0, totals["remainingDue"])

    def test_document_totals_support_per_line_discount_types(self):
        totals = calculate_document_totals(
            [
                {"qty": 2, "price": 1000, "discountType": "percent", "discountValue": 10, "vatRate": 7, "withholdingRate": 3},
                {"qty": 1, "price": 500, "discountType": "amount", "discountValue": 700, "vatRate": 0, "withholdingRate": 5},
            ],
            per_line_withholding=True,
        )

        self.assertEqual(1800.0, totals["subtotal"])
        self.assertEqual(700.0, totals["discountAmount"])
        self.assertEqual([{"rate": 7.0, "taxableBase": 1800.0, "taxAmount": 126.0}], totals["vatGroups"])
        self.assertEqual(
            [{"rate": 3.0, "taxableBase": 1800.0, "taxAmount": 54.0}],
            totals["withholdingGroups"],
        )
        self.assertEqual(1872.0, totals["remainingDue"])

    def test_document_totals_use_after_discount_base_for_vat_and_wht(self):
        totals = calculate_document_totals(
            [{"qty": 1, "price": 580, "discountType": "amount", "discountValue": 0, "vatRate": 7, "withholdingRate": 2}],
            per_line_withholding=True,
        )

        self.assertEqual(580.0, totals["subtotal"])
        self.assertEqual(580.0, totals["amountBeforeVat"])
        self.assertEqual(40.6, totals["taxAmount"])
        self.assertEqual(620.6, totals["grandTotal"])
        self.assertEqual([{"rate": 2.0, "taxableBase": 580.0, "taxAmount": 11.6}], totals["withholdingGroups"])
        self.assertEqual(609.0, totals["remainingDue"])

    def test_document_totals_ignore_incorrect_manual_line_totals(self):
        totals = calculate_document_totals(
            [
                {
                    "qty": 1,
                    "price": 1000,
                    "discountType": "amount",
                    "discountValue": 250,
                    "discountAmount": 9999,
                    "amountBeforeVat": 9999,
                    "vatAmount": 9999,
                    "totalAmount": 9999,
                    "vatRate": 7,
                    "withholdingRate": 5,
                }
            ],
            per_line_withholding=True,
        )

        self.assertEqual(1000.0, totals["subtotalBeforeDiscount"])
        self.assertEqual(750.0, totals["amountBeforeVat"])
        self.assertEqual(250.0, totals["totalDiscount"])
        self.assertEqual(52.5, totals["taxAmount"])
        self.assertEqual(765.0, totals["remainingDue"])

    def test_document_totals_force_zero_vat_when_not_registered(self):
        totals = calculate_document_totals(
            [{"qty": 1, "price": 1000, "tax": 7, "vatRate": 7}],
            default_tax_rate=7,
            vat_enabled=False,
        )

        self.assertEqual(0.0, totals["taxAmount"])
        self.assertEqual([], totals["vatGroups"])
        self.assertEqual(1000.0, totals["total"])

    def test_document_number_generation_uses_fixed_monthly_format(self):
        counters = {}
        first = build_document_number(
            counters=counters,
            counter_key="invoice",
            prefix="INV",
            start_at=1,
            date_text="2026-04-19",
        )
        second = build_document_number(
            counters=counters,
            counter_key="invoice",
            prefix="INV",
            start_at=1,
            date_text="2026-04-19",
        )

        self.assertEqual("INV-2026-0400001", first)
        self.assertEqual("INV-2026-0400002", second)

    def test_document_number_generation_resets_by_type_year_and_month(self):
        counters = {}
        invoice_april = build_document_number(
            counters=counters,
            counter_key="invoice",
            prefix="INV",
            start_at=1,
            date_text="2026-04-19",
        )
        receipt_april = build_document_number(
            counters=counters,
            counter_key="receipt",
            prefix="RE",
            start_at=1,
            date_text="2026-04-19",
        )
        invoice_march = build_document_number(
            counters=counters,
            counter_key="invoice",
            prefix="INV",
            start_at=1,
            date_text="2026-03-31",
        )

        self.assertEqual("INV-2026-0400001", invoice_april)
        self.assertEqual("RE-2026-0400001", receipt_april)
        self.assertEqual("INV-2026-0300001", invoice_march)

    def test_linked_document_graph_collects_receipts_receives_and_attachments(self):
        graph = build_linked_document_graph(
            {
                "receipts": [{"id": "RC-1", "relatedInvoice": "INV-1"}],
                "receives": [{"id": "REC-1", "relatedDocument": "INV-1"}],
                "attachments": [{"id": "ATT-1", "entityId": "INV-1"}],
            }
        )

        self.assertEqual(["ATT-1", "RC-1", "REC-1"], graph["INV-1"])
        self.assertEqual(["INV-1"], graph["RC-1"])

    def test_editability_and_cheque_validation_rules(self):
        self.assertFalse(editable_after_payment(status="paid", lock_after_payment=True))
        self.assertTrue(editable_after_payment(status="paid", lock_after_payment=False))
        self.assertFalse(reset_required_before_delete(status="draft", linked_count=0, attachment_count=0))
        self.assertTrue(reset_required_before_delete(status="sent", linked_count=0, attachment_count=0))
        self.assertTrue(reset_required_before_delete(status="paid", linked_count=0, attachment_count=0))
        self.assertTrue(reset_required_before_delete(status="draft", linked_count=1, attachment_count=0))

        valid, message = validate_cheque_date(
            "2026-04-20",
            payment_date_text="2026-04-19",
        )
        self.assertTrue(valid)
        self.assertEqual("", message)

        invalid, message = validate_cheque_date(
            "2026-04-18",
            payment_date_text="2026-04-19",
        )
        self.assertFalse(invalid)
        self.assertIn("before the payment date", message)

        invalid, message = validate_cheque_date(
            "2026-04-20",
            payment_date_text="2026-04-19",
            cleared_date_text="2026-04-18",
        )
        self.assertFalse(invalid)
        self.assertIn("before the cheque date", message)


if __name__ == "__main__":
    unittest.main()

import unittest
from copy import deepcopy
from pathlib import Path

from backend.app.domain.document_workflow import normalize_workflow_fields, validate_document_transition
from backend.app.services.data_service import (
    SEED_DATABASE,
    convert_document,
    create_document,
    create_expense,
    create_payment,
    create_withholding_tax_document,
    get_document,
    get_document_next_actions,
    get_expense,
    override_workflow_warning,
    save_settings_section,
)
from backend.app.services.storage_service import DB_PATH, save_database


class WorkflowTaxRegressionTests(unittest.TestCase):
    def setUp(self):
        self._original_db = DB_PATH.read_text(encoding="utf-8") if DB_PATH.exists() else None
        seed = deepcopy(SEED_DATABASE)
        for key in (
            "quotations",
            "invoices",
            "receipts",
            "billings",
            "creditNotes",
            "debitNotes",
            "deposits",
            "purchaseOrders",
            "receives",
            "expenses",
            "payments",
            "withholdingTaxDocuments",
            "attachments",
            "recentActivity",
        ):
            seed[key] = []
        save_database(seed)

    def tearDown(self):
        if self._original_db is None:
            if DB_PATH.exists():
                DB_PATH.unlink()
            return
        DB_PATH.write_text(self._original_db, encoding="utf-8")

    def _line(self, price=1000.0, tax=7):
        return {"id": "line-1", "desc": "Consulting", "qty": 1, "price": price, "tax": tax}

    def test_create_invoice_without_quotation_allowed(self):
        invoice = create_document(
            "invoice",
            {
                "id": "INV-2026-050001",
                "customer": "Bangkok Foods Co., Ltd.",
                "date": "2026-05-24",
                "due": "2026-06-07",
                "lines": [self._line()],
            },
        )

        self.assertEqual("invoice", invoice["kind"])
        self.assertEqual([], invoice["sourceDocumentIds"])
        self.assertEqual("unpaid", invoice["paymentStatus"])
        self.assertEqual(1070.0, invoice["amountDue"])

    def test_create_tax_invoice_from_delivery_note_links_documents(self):
        delivery = create_document(
            "delivery_note",
            {
                "id": "DN-2026-050001",
                "receivedFrom": "Bangkok Foods Co., Ltd.",
                "date": "2026-05-24",
                "deliveryDate": "2026-05-24",
                "documentTypes": ["delivery_note"],
                "lines": [self._line()],
            },
        )

        tax_invoice = convert_document(
            "delivery_note",
            delivery["id"],
            {
                "targetKind": "tax_invoice",
                "id": "TI-2026-050001",
                "overrides": {"customer": "Bangkok Foods Co., Ltd."},
            },
        )

        refreshed_delivery = get_document("delivery_note", delivery["id"])
        self.assertEqual(["tax_invoice"], tax_invoice["documentTypes"])
        self.assertEqual(delivery["id"], tax_invoice["convertedFromId"])
        self.assertIn(delivery["id"], tax_invoice["sourceDocumentIds"])
        self.assertIn(tax_invoice["id"], refreshed_delivery["linkedDocumentIds"])
        self.assertIn(tax_invoice["id"], refreshed_delivery["convertedToIds"])

    def test_deposit_before_delivery_sets_tax_point_payment(self):
        deposit = create_document(
            "deposit_invoice",
            {
                "id": "DEP-2026-050001",
                "customer": "Bangkok Foods Co., Ltd.",
                "date": "2026-05-20",
                "paymentDate": "2026-05-20",
                "documentTypes": ["deposit_invoice"],
                "lines": [self._line(500.0)],
            },
        )

        self.assertEqual("payment_received", deposit["taxPointReason"])
        self.assertEqual("2026-05-20", deposit["taxPointDate"])
        self.assertEqual("2026-05", deposit["vatReportingPeriod"])

    def test_delivery_before_payment_sets_tax_point_delivery(self):
        delivery = create_document(
            "delivery_note",
            {
                "id": "DN-2026-050002",
                "receivedFrom": "Bangkok Foods Co., Ltd.",
                "date": "2026-05-23",
                "deliveryDate": "2026-05-24",
                "documentTypes": ["delivery_note"],
                "lines": [self._line()],
            },
        )

        self.assertEqual("delivery", delivery["taxPointReason"])
        self.assertEqual("2026-05-24", delivery["taxPointDate"])
        self.assertEqual("2026-05", delivery["vatReportingPeriod"])
        self.assertTrue(delivery["taxInvoiceRequired"])

    def test_receipt_cannot_exceed_amount_due_and_updates_partial_status(self):
        invoice = create_document(
            "invoice",
            {
                "id": "INV-2026-050002",
                "customer": "Bangkok Foods Co., Ltd.",
                "date": "2026-05-24",
                "lines": [self._line()],
            },
        )

        with self.assertRaises(ValueError):
            create_document(
                "receipt",
                {
                    "id": "RC-2026-050999",
                    "customer": "Bangkok Foods Co., Ltd.",
                    "date": "2026-05-25",
                    "relatedInvoice": invoice["id"],
                    "lines": [self._line(2000.0)],
                },
            )

        receipt = create_document(
            "receipt",
            {
                "id": "RC-2026-050001",
                "customer": "Bangkok Foods Co., Ltd.",
                "date": "2026-05-25",
                "relatedInvoice": invoice["id"],
                "lines": [self._line(500.0)],
            },
        )
        refreshed_invoice = get_document("invoice", invoice["id"])
        self.assertIn(receipt["id"], refreshed_invoice["linkedDocumentIds"])
        self.assertEqual("partial", refreshed_invoice["paymentStatus"])
        self.assertEqual(535.0, refreshed_invoice["amountPaid"])
        self.assertEqual(535.0, refreshed_invoice["amountDue"])

    def test_credit_note_requires_original_document(self):
        with self.assertRaises(ValueError):
            create_document(
                "credit_note",
                {
                    "id": "CN-2026-050001",
                    "customer": "Bangkok Foods Co., Ltd.",
                    "date": "2026-05-24",
                    "lines": [self._line(100.0)],
                },
            )

    def test_vendor_payment_can_create_wht_certificate_and_prevent_duplicate(self):
        expense = create_expense(
            {
                "id": "EXP-2026-050001",
                "vendor": "Office Plus Stationery",
                "category": "Office Supplies",
                "date": "2026-05-24",
                "amount": 1070.0,
                "status": "approved",
            }
        )
        payment = create_payment(
            {
                "id": "PAY-2026-050001",
                "vendor": expense["vendor"],
                "amount": 535.0,
                "currency": "THB",
                "paymentDate": "2026-05-25",
                "allocations": [{"documentId": expense["id"], "documentType": "expense", "amount": 535.0}],
                "autoCreateWht": True,
                "whtRate": 3,
                "taxableAmount": 535.0,
                "incomeType": "service",
                "filingMonth": "2026-05",
            }
        )

        refreshed_expense = get_expense(expense["id"])
        self.assertEqual("partial", refreshed_expense["paymentStatus"])
        self.assertEqual(535.0, refreshed_expense["amountDue"])
        self.assertIn(payment["id"], refreshed_expense["linkedDocumentIds"])
        self.assertTrue(payment["withholdingTaxId"])
        with self.assertRaises(ValueError):
            create_withholding_tax_document(
                {
                    "relatedPaymentId": payment["id"],
                    "sourceDocumentId": expense["id"],
                    "vendor": expense["vendor"],
                    "taxableAmount": 535.0,
                    "rate": 3,
                    "date": "2026-05-25",
                }
            )

    def test_non_vat_company_cannot_issue_tax_invoice(self):
        save_settings_section("company", {"vatRegistrationMode": "not_registered"})

        with self.assertRaises(ValueError):
            create_document(
                "tax_invoice",
                {
                    "id": "TI-2026-050002",
                    "customer": "Bangkok Foods Co., Ltd.",
                    "date": "2026-05-24",
                    "documentTypes": ["tax_invoice"],
                    "isTaxInvoice": True,
                    "invoiceTaxType": "tax",
                    "lines": [self._line()],
                },
            )

    def test_next_actions_and_override_warning_require_reason(self):
        invoice = create_document(
            "invoice",
            {
                "id": "INV-2026-050003",
                "customer": "Bangkok Foods Co., Ltd.",
                "date": "2026-05-24",
                "lines": [self._line()],
            },
        )

        actions = get_document_next_actions("invoice", invoice["id"])
        self.assertIn("receipt", [item["targetKind"] for item in actions["nextActions"]])
        validation = validate_document_transition("receipt", "purchase_order", mode="guided")
        self.assertTrue(validation["requiresOverrideReason"])
        with self.assertRaises(ValueError):
            override_workflow_warning("invoice", invoice["id"], {"overrideReason": ""})

        updated = override_workflow_warning("invoice", invoice["id"], {"overrideReason": "Approved by accountant"})
        self.assertEqual("Approved by accountant", updated["overrideReason"])
        self.assertEqual(1, len(updated["workflowOverrides"]))

    def test_old_documents_without_workflow_fields_still_normalize(self):
        legacy = normalize_workflow_fields({"id": "LEG-2026-0001", "amount": 1070.0}, kind="invoice")

        self.assertEqual("invoice", legacy["kind"])
        self.assertTrue(legacy["workflowId"].startswith("WF-"))
        self.assertEqual([], legacy["sourceDocumentIds"])
        self.assertEqual("unpaid", legacy["paymentStatus"])
        self.assertEqual(1070.0, legacy["amountDue"])

    def test_purchase_order_to_goods_receive_flow(self):
        purchase_order = create_document(
            "purchase_order",
            {
                "id": "PO-2026-050001",
                "vendor": "Office Plus Stationery",
                "date": "2026-05-24",
                "lines": [self._line()],
            },
        )
        receive = convert_document(
            "purchase_order",
            purchase_order["id"],
            {
                "targetKind": "goods_receive",
                "id": "GR-2026-050001",
                "overrides": {"receivedFrom": "Office Plus Stationery"},
            },
        )

        refreshed_po = get_document("purchase_order", purchase_order["id"])
        self.assertEqual(["goods_receive"], receive["documentTypes"])
        self.assertIn(purchase_order["id"], receive["sourceDocumentIds"])
        self.assertIn(receive["id"], refreshed_po["linkedDocumentIds"])

    def test_ui_language_source_does_not_mutate_document_language_source(self):
        repo_root = Path(__file__).resolve().parents[2]
        i18n_source = (repo_root / "frontend" / "lib" / "i18n.ts").read_text(encoding="utf-8")
        lang_switch_source = (repo_root / "frontend" / "components" / "brand" / "LangSwitch.tsx").read_text(encoding="utf-8")
        sales_form_source = (repo_root / "frontend" / "components" / "sales" / "SalesDocumentForm.tsx").read_text(encoding="utf-8")

        self.assertIn('const DEFAULT_UI_LANGUAGE = "th";', i18n_source)
        self.assertIn('order: ["localStorage"]', i18n_source)
        self.assertIn("i18n.changeLanguage(lng)", lang_switch_source)
        self.assertNotIn("documentLanguage", lang_switch_source)
        self.assertNotRegex(sales_form_source, r"setDocumentLanguage\([^)]*i18n\.language")


if __name__ == "__main__":
    unittest.main()

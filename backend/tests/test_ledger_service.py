import unittest
from copy import deepcopy

from backend.app.services.data_service import SEED_DATABASE
from backend.app.services.ledger_service import (
    build_accounting_events,
    build_accounting_overview,
    build_report_rows,
)


class LedgerServiceTests(unittest.TestCase):
    def make_sample_data(self):
        data = deepcopy(SEED_DATABASE)
        data["invoices"] = [
            {
                "id": "INV-2026-0001",
                "customer": "Acme Co., Ltd.",
                "date": "2026-04-01",
                "due": "2026-04-15",
                "amount": 1070.0,
                "status": "paid",
                "currency": "THB",
                "paymentTerms": "Net 14",
                "reference": "",
                "notes": "",
                "lines": [],
                "attachments": [],
            }
        ]
        data["receipts"] = [
            {
                "id": "RC-2026-0001",
                "customer": "Acme Co., Ltd.",
                "date": "2026-04-15",
                "amount": 1070.0,
                "status": "paid",
                "paymentMethod": "Bank transfer",
                "relatedInvoice": "INV-2026-0001",
            }
        ]
        data["expenses"] = [
            {
                "id": "EXP-2026-0001",
                "vendor": "Utility Partner",
                "category": "Utilities",
                "date": "2026-04-02",
                "amount": 214.0,
                "status": "approved",
                "paymentMethod": "Cash",
                "attachments": [],
            }
        ]
        data["receives"] = []
        data["financeAccounts"] = [
            {"name": "Bangkok Bank - Current", "number": "123-4-56789-0", "balance": 10000.0, "primary": True},
            {"name": "Petty Cash", "number": "Cash on hand", "balance": 500.0},
        ]
        return data

    def test_build_accounting_events_posts_balanced_entries(self):
        data = self.make_sample_data()
        entries = build_accounting_events(data)

        self.assertEqual(3, len(entries))

        invoice_entry = next(entry for entry in entries if entry["sourceType"] == "invoice")
        receipt_entry = next(entry for entry in entries if entry["sourceType"] == "receipt")
        expense_entry = next(entry for entry in entries if entry["sourceType"] == "expense")

        self.assertIn({"account": "Accounts Receivable", "side": "debit", "amount": 1070.0}, invoice_entry["lines"])
        self.assertIn({"account": "Sales Revenue", "side": "credit", "amount": 1000.0}, invoice_entry["lines"])
        self.assertIn({"account": "Output VAT Payable", "side": "credit", "amount": 70.0}, invoice_entry["lines"])

        self.assertIn({"account": "Bangkok Bank - Current", "side": "debit", "amount": 1070.0}, receipt_entry["lines"])
        self.assertIn({"account": "Accounts Receivable", "side": "credit", "amount": 1070.0}, receipt_entry["lines"])

        self.assertIn({"account": "Utilities Expense", "side": "debit", "amount": 200.0}, expense_entry["lines"])
        self.assertIn({"account": "Input VAT Recoverable", "side": "debit", "amount": 14.0}, expense_entry["lines"])
        self.assertIn({"account": "Petty Cash", "side": "credit", "amount": 214.0}, expense_entry["lines"])

    def test_payment_based_output_tax_is_reclassified_on_receipt(self):
        data = self.make_sample_data()
        data["settings"]["taxes"]["outputTaxRecognition"] = "payment"

        entries = build_accounting_events(data)
        invoice_entry = next(entry for entry in entries if entry["sourceType"] == "invoice")
        receipt_entry = next(entry for entry in entries if entry["sourceType"] == "receipt")

        self.assertIn({"account": "Deferred Output VAT", "side": "credit", "amount": 70.0}, invoice_entry["lines"])
        self.assertIn({"account": "Deferred Output VAT", "side": "debit", "amount": 70.0}, receipt_entry["lines"])
        self.assertIn({"account": "Output VAT Payable", "side": "credit", "amount": 70.0}, receipt_entry["lines"])

    def test_accounting_overview_and_report_rows_use_shared_logic(self):
        data = self.make_sample_data()
        overview = build_accounting_overview(data)
        vat_rows = build_report_rows(data, "vat-summary")

        self.assertEqual(1070.0, overview["dashboardSummary"]["revenue"])
        self.assertEqual(214.0, overview["dashboardSummary"]["expenses"])
        self.assertEqual(10500.0, overview["financeSummary"]["totalCash"])
        self.assertEqual(56.0, overview["vatSummary"]["netVatPayable"])
        self.assertEqual("Net VAT Payable", vat_rows[-1]["metric"])
        self.assertEqual(56.0, vat_rows[-1]["amount"])


if __name__ == "__main__":
    unittest.main()

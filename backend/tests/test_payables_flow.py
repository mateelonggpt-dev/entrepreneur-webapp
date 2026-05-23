import unittest
from copy import deepcopy

from backend.app.services.data_service import (
    SEED_DATABASE,
    create_expense,
    create_payment,
    get_expense,
    list_payables,
    list_payments,
    list_withholding_tax_documents,
)
from backend.app.services.storage_service import DB_PATH, save_database


class PayablesFlowTests(unittest.TestCase):
    def setUp(self):
        self._original_db = DB_PATH.read_text(encoding="utf-8") if DB_PATH.exists() else None
        seed = deepcopy(SEED_DATABASE)
        seed["payments"] = []
        seed["withholdingTaxDocuments"] = []
        save_database(seed)

    def tearDown(self):
        if self._original_db is None:
            if DB_PATH.exists():
                DB_PATH.unlink()
            return

        DB_PATH.write_text(self._original_db, encoding="utf-8")

    def test_payment_updates_expense_balance_and_creates_wht(self):
        expense = create_expense(
            {
                "vendor": "Office Plus Stationery",
                "category": "Office Supplies",
                "date": "2026-04-19",
                "amount": 1070.0,
                "status": "approved",
                "paymentMethod": "Bank transfer",
            }
        )

        payment = create_payment(
            {
                "vendor": expense["vendor"],
                "amount": 535.0,
                "currency": "THB",
                "paymentDate": "2026-04-20",
                "paymentMethod": "Cheque",
                "chequeDate": "2026-04-20",
                "chequeDepositDate": "2026-04-21",
                "allocations": [
                    {
                        "documentId": expense["id"],
                        "documentType": "expense",
                        "amount": 535.0,
                    }
                ],
                "autoCreateWht": True,
                "whtRate": 3,
                "taxableAmount": 535.0,
                "incomeType": "service",
                "filingMonth": "2026-04",
            }
        )

        refreshed_expense = get_expense(expense["id"])
        payables = list_payables()
        payments = list_payments()
        withholding_docs = list_withholding_tax_documents()

        self.assertIsNotNone(refreshed_expense)
        self.assertEqual("partial", refreshed_expense["status"])
        self.assertEqual(535.0, refreshed_expense["paymentSummary"]["paid"])
        self.assertEqual(535.0, refreshed_expense["paymentSummary"]["remaining"])
        self.assertEqual(1, len(payments))
        self.assertEqual(payment["id"], payments[0]["id"])
        self.assertEqual(1, len(withholding_docs))
        self.assertEqual(payment["withholdingTaxId"], withholding_docs[0]["id"])
        self.assertEqual(expense["id"], withholding_docs[0]["sourceDocumentId"])
        self.assertTrue(any(row["id"] == expense["id"] and row["remaining"] == 535.0 for row in payables))


if __name__ == "__main__":
    unittest.main()

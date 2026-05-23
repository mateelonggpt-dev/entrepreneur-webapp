import unittest
from copy import deepcopy

from backend.app.services.data_service import SEED_DATABASE
from backend.app.services.ledger_service import (
    build_account_movement_rows,
    build_accounting_events,
    build_project_profitability_rows,
    build_report_rows,
)


class FinanceReportingFlowTests(unittest.TestCase):
    def make_sample_data(self):
        data = deepcopy(SEED_DATABASE)
        data["projects"] = [
            {
                "id": "PRJ-001",
                "code": "ACME-OPS",
                "name": "Acme Operations",
                "status": "active",
                "customer": "Acme Co., Ltd.",
                "description": "Shared reporting setup.",
            }
        ]
        data["invoices"] = [
            {
                "id": "INV-2026-1001",
                "customer": "Acme Co., Ltd.",
                "date": "2026-04-10",
                "due": "2026-04-24",
                "amount": 10700.0,
                "status": "sent",
                "currency": "THB",
                "projectId": "PRJ-001",
                "lines": [],
            }
        ]
        data["expenses"] = [
            {
                "id": "EXP-2026-1001",
                "vendor": "Utility Partner",
                "category": "Utilities",
                "date": "2026-04-11",
                "amount": 2140.0,
                "status": "approved",
                "paymentMethod": "Petty Cash",
                "currency": "THB",
                "projectId": "PRJ-001",
                "paymentSummary": {
                    "paid": 2140.0,
                    "remaining": 0.0,
                    "status": "paid",
                    "lastPaymentId": "PAY-2026-0001",
                    "lastPaymentMethod": "Cheque",
                    "lastPaymentDate": "2026-04-13",
                },
                "lines": [],
            }
        ]
        data["receipts"] = [
            {
                "id": "RC-2026-1001",
                "customer": "Acme Co., Ltd.",
                "date": "2026-04-12",
                "amount": 10700.0,
                "status": "paid",
                "paymentMethod": "Bank transfer",
                "relatedInvoice": "INV-2026-1001",
                "currency": "THB",
            }
        ]
        data["payments"] = [
            {
                "id": "PAY-2026-0001",
                "vendor": "Utility Partner",
                "amount": 2140.0,
                "currency": "THB",
                "paymentDate": "2026-04-13",
                "paymentMethod": "Cheque",
                "paymentStatus": "paid",
                "accountName": "Bangkok Bank - Current",
                "accountNumber": "123-4-56789-0",
                "chequeDate": "2026-04-13",
                "chequeCutDate": "2026-04-14",
                "chequeDepositDate": "2026-04-15",
                "chequeClearedDate": "2026-04-16",
                "sourceDocumentIds": ["EXP-2026-1001"],
                "allocations": [
                    {
                        "documentId": "EXP-2026-1001",
                        "documentType": "expense",
                        "amount": 2140.0,
                    }
                ],
            }
        ]
        data["financeMovements"] = [
            {
                "id": "FMV-2026-0001",
                "date": "2026-04-09",
                "movementType": "top_up",
                "sourceAccountNumber": "123-4-56789-0",
                "sourceAccountName": "Bangkok Bank - Current",
                "destinationAccountNumber": "Cash on hand",
                "destinationAccountName": "Petty Cash",
                "amount": 5000.0,
                "currency": "THB",
                "note": "Weekly petty cash top up",
                "status": "posted",
            }
        ]
        data["withholdingTaxDocuments"] = [
            {
                "id": "WHT-2026-0001",
                "date": "2026-04-13",
                "vendor": "Utility Partner",
                "sourceDocumentId": "EXP-2026-1001",
                "incomeType": "service",
                "taxableAmount": 2140.0,
                "rate": 0.03,
                "amount": 64.2,
                "filingMonth": "2026-04",
                "status": "pending",
            }
        ]
        return data

    def test_finance_movements_feed_and_journal_include_internal_transfer(self):
        data = self.make_sample_data()

        movement_rows = build_account_movement_rows(data)
        entries = build_accounting_events(data)

        self.assertEqual(4, len(movement_rows))
        finance_rows = [row for row in movement_rows if row["sourceType"] == "finance_movement"]
        self.assertEqual(2, len(finance_rows))
        self.assertEqual(
            {"Bangkok Bank - Current", "Petty Cash"},
            {row["accountName"] for row in finance_rows},
        )

        finance_entry = next(entry for entry in entries if entry["sourceType"] == "finance_movement")
        self.assertEqual("JV", finance_entry["journalType"])
        self.assertIn(
            {"account": "Petty Cash", "side": "debit", "amount": 5000.0},
            finance_entry["lines"],
        )

    def test_project_profitability_and_reports_share_project_logic(self):
        data = self.make_sample_data()

        rows = build_project_profitability_rows(data)
        report_rows = build_report_rows(data, "project-profitability")

        self.assertEqual(1, len(rows))
        self.assertEqual(10700.0, rows[0]["revenue"])
        self.assertEqual(2140.0, rows[0]["cost"])
        self.assertEqual(8560.0, rows[0]["profit"])
        self.assertEqual(rows, report_rows)

    def test_new_report_exports_have_rows(self):
        data = self.make_sample_data()

        account_rows = build_report_rows(data, "financial-account-movement")
        cheque_rows = build_report_rows(data, "cheque-summary")
        tax_rows = build_report_rows(data, "tax-buy-summary")
        wht_rows = build_report_rows(data, "withholding-tax")

        self.assertGreaterEqual(len(account_rows), 1)
        self.assertEqual("PAY-2026-0001", cheque_rows[0]["documentId"])
        self.assertEqual("EXP-2026-1001", tax_rows[0]["documentId"])
        self.assertEqual("WHT-2026-0001", wht_rows[0]["documentId"])


if __name__ == "__main__":
    unittest.main()

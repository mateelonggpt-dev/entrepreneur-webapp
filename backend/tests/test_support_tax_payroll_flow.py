import unittest
from copy import deepcopy

from backend.app.services.data_service import SEED_DATABASE
from backend.app.services.payroll_service import (
    build_payroll_export,
    create_payroll_run,
    get_payroll_settings,
    list_employees,
)
from backend.app.services.storage_service import DB_PATH, save_database
from backend.app.services.support_service import request_password_reset, reset_password, submit_support_request
from backend.app.services.tax_service import build_tax_filing_download, create_tax_filing, get_tax_overview


class SupportTaxPayrollFlowTests(unittest.TestCase):
    def setUp(self):
        self._original_db = DB_PATH.read_text(encoding="utf-8") if DB_PATH.exists() else None
        save_database(deepcopy(SEED_DATABASE))

    def tearDown(self):
        if self._original_db is None:
            if DB_PATH.exists():
                DB_PATH.unlink()
            return

        DB_PATH.write_text(self._original_db, encoding="utf-8")

    def test_support_request_and_password_reset_shells(self):
        support_request = submit_support_request(
            {
                "firstName": "Aimmy",
                "lastName": "Admin",
                "email": "aimmy@example.com",
                "topic": "Sales / Pricing / Demo",
                "message": "Please contact me about a demo.",
            },
            request_type="demo",
        )
        reset_request = request_password_reset({"email": "aimmy@example.com"})
        reset_result = reset_password(
            {
                "token": reset_request["resetToken"],
                "password": "new-password-123",
            }
        )

        self.assertEqual("demo", support_request["type"])
        self.assertTrue(reset_request["supported"])
        self.assertTrue(reset_result["ok"])
        self.assertEqual("aimmy@example.com", reset_result["email"])

    def test_tax_filing_shell_and_payroll_run_exports(self):
        filing = create_tax_filing(
            {
                "filingType": "vat_summary",
                "period": "2026-04",
                "note": "VAT shell for April",
            }
        )
        tax_overview = get_tax_overview()
        filing_download = build_tax_filing_download(filing["id"])

        payroll_settings = get_payroll_settings()
        employees = list_employees()
        payroll_run = create_payroll_run(
            {
                "period": "2026-04",
                "payDate": payroll_settings["defaultPayDate"],
                "employeeIds": [employee["id"] for employee in employees],
            }
        )
        payroll_export = build_payroll_export(payroll_run["id"])

        self.assertEqual("vat_summary", filing["filingType"])
        self.assertGreaterEqual(tax_overview["filingCount"], 1)
        self.assertIsNotNone(filing_download)
        self.assertTrue(filing_download["path"].exists())
        self.assertEqual(len(employees), payroll_run["employeeCount"])
        self.assertIsNotNone(payroll_export)
        self.assertTrue(payroll_export["path"].exists())


if __name__ == "__main__":
    unittest.main()

import os
import unittest
from copy import deepcopy
from tempfile import TemporaryDirectory

from backend.app import create_app
from backend.app.extensions import db
from backend.app.services.data_service import SEED_DATABASE
from backend.app.services.storage_service import DB_PATH, save_database


class ApiSmokeTests(unittest.TestCase):
    def setUp(self):
        self._original_db = DB_PATH.read_text(encoding="utf-8") if DB_PATH.exists() else None
        self._original_database_url = os.environ.get("DATABASE_URL")
        self._tmpdir = TemporaryDirectory()
        sqlite_path = os.path.join(self._tmpdir.name, "test-app.db").replace("\\", "/")
        os.environ["DATABASE_URL"] = f"sqlite:///{sqlite_path}"
        save_database(deepcopy(SEED_DATABASE))
        self.app = create_app()
        self.client = self.app.test_client()

    def tearDown(self):
        if self._original_db is None:
            if DB_PATH.exists():
                DB_PATH.unlink()
        else:
            DB_PATH.write_text(self._original_db, encoding="utf-8")

        with self.app.app_context():
            db.session.remove()
            db.engine.dispose()

        if self._original_database_url is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = self._original_database_url
        self._tmpdir.cleanup()

    def test_core_route_smoke(self):
        for path in (
            "/api/health",
            "/api/bootstrap",
            "/api/accounting/overview",
            "/api/reports",
            "/api/tax/overview",
            "/api/payroll/settings",
            "/api/payroll/employees",
            "/api/payroll/runs",
        ):
            response = self.client.get(path)
            self.assertEqual(200, response.status_code, path)

    def test_support_auth_and_tax_post_routes(self):
        contact_response = self.client.post(
            "/api/support/contact",
            json={
                "firstName": "Aimmy",
                "lastName": "Admin",
                "email": "aimmy@example.com",
                "topic": "Technical question",
                "message": "Need help with exports.",
            },
        )
        self.assertEqual(201, contact_response.status_code)

        forgot_response = self.client.post(
            "/api/auth/forgot-password",
            json={"email": "aimmy@example.com"},
        )
        self.assertEqual(201, forgot_response.status_code)
        reset_token = forgot_response.get_json()["resetToken"]

        reset_response = self.client.post(
            "/api/auth/reset-password",
            json={"token": reset_token, "password": "new-password-123"},
        )
        self.assertEqual(200, reset_response.status_code)

        tax_response = self.client.post(
            "/api/tax/filings",
            json={
                "filingType": "wht_filing",
                "period": "2026-04",
                "note": "Smoke test filing",
            },
        )
        self.assertEqual(201, tax_response.status_code)

        payroll_response = self.client.post(
            "/api/payroll/runs",
            json={
                "period": "2026-04",
                "payDate": "2026-04-30",
            },
        )
        self.assertEqual(201, payroll_response.status_code)

    def test_auth_session_round_trip(self):
        initial_response = self.client.get("/api/auth/session")
        self.assertEqual(200, initial_response.status_code)
        self.assertEqual(False, initial_response.get_json()["isAuthed"])

        create_response = self.client.post(
            "/api/auth/session",
            json={"email": "aimmy@example.com", "name": "Aimmy", "company": "Matter Acc."},
        )
        self.assertEqual(201, create_response.status_code)
        self.assertEqual(True, create_response.get_json()["isAuthed"])

        follow_up_response = self.client.get("/api/auth/session")
        self.assertEqual(200, follow_up_response.status_code)
        self.assertEqual("aimmy@example.com", follow_up_response.get_json()["user"]["email"])

        delete_response = self.client.delete("/api/auth/session")
        self.assertEqual(200, delete_response.status_code)
        self.assertEqual(False, delete_response.get_json()["isAuthed"])

    def test_missing_route_returns_json_error(self):
        response = self.client.get("/api/does-not-exist")
        self.assertEqual(404, response.status_code)
        payload = response.get_json()
        self.assertEqual(False, payload["ok"])
        self.assertEqual(404, payload["error"]["status"])
        self.assertEqual("Not Found", payload["error"]["type"])

    def test_onboarding_draft_round_trip(self):
        initial_response = self.client.get("/api/onboarding/draft")
        self.assertEqual(200, initial_response.status_code)
        self.assertEqual(False, initial_response.get_json()["completed"])

        save_response = self.client.put(
            "/api/onboarding/draft",
            json={
                "step": 3,
                "companyName": "Aimmy Co., Ltd.",
                "productName": "Starter plan",
                "invites": [{"email": "team@example.com", "role": "Accountant"}],
            },
        )
        self.assertEqual(200, save_response.status_code)
        saved_payload = save_response.get_json()
        self.assertEqual("Aimmy Co., Ltd.", saved_payload["draft"]["companyName"])
        self.assertEqual(3, saved_payload["draft"]["step"])
        self.assertEqual("team@example.com", saved_payload["draft"]["invites"][0]["email"])

        complete_response = self.client.post(
            "/api/onboarding/complete",
            json={"step": 8, "companyName": "Aimmy Co., Ltd."},
        )
        self.assertEqual(200, complete_response.status_code)
        self.assertEqual(True, complete_response.get_json()["completed"])

        follow_up_response = self.client.get("/api/onboarding/draft")
        self.assertEqual(200, follow_up_response.status_code)
        self.assertEqual(True, follow_up_response.get_json()["completed"])

    def test_invoice_tax_and_payment_mode_round_trip(self):
        response = self.client.post(
            "/api/documents/invoice",
            json={
                "id": "INV-2026-0500001",
                "customer": "Bangkok Foods Co., Ltd.",
                "date": "2026-05-05",
                "due": "2026-05-12",
                "status": "pending",
                "currency": "THB",
                "documentTypes": ["tax_invoice"],
                "invoiceTaxType": "tax",
                "isTaxInvoice": True,
                "invoicePaymentMode": "deposit",
                "depositType": "amount",
                "depositValue": 250000,
                "depositAmount": 250000,
                "depositSourceDocumentId": "QT-2026-0500001",
                "depositSourceDocumentType": "quotation",
                "referenceDocuments": [
                    {
                        "id": "QT-2026-0500001",
                        "kind": "quotation",
                        "type": "quotation",
                        "number": "QT-2026-0500001",
                        "total": 535000,
                    }
                ],
                "lines": [
                    {
                        "id": "line-1",
                        "desc": "Deposit",
                        "details": "Quotation QT-2026-0500001 total THB 535,000.00",
                        "qty": 1,
                        "price": 250000,
                        "tax": 7,
                    }
                ],
            },
        )
        self.assertEqual(201, response.status_code)
        payload = response.get_json()
        self.assertEqual(["tax_invoice"], payload["documentTypes"])
        self.assertEqual("tax", payload["invoiceTaxType"])
        self.assertEqual(True, payload["isTaxInvoice"])
        self.assertEqual("deposit", payload["invoicePaymentMode"])
        self.assertEqual(250000, payload["depositAmount"])

        summary_response = self.client.get("/api/documents/invoice")
        self.assertEqual(200, summary_response.status_code)
        summary = next(item for item in summary_response.get_json() if item["id"] == "INV-2026-0500001")
        self.assertEqual(["tax_invoice"], summary["documentTypes"])
        self.assertEqual("tax", summary["invoiceTaxType"])
        self.assertEqual(True, summary["isTaxInvoice"])
        self.assertEqual("deposit", summary["invoicePaymentMode"])

    def test_user_settings_requires_owner(self):
        users_response = self.client.get("/api/settings/users")
        self.assertEqual(200, users_response.status_code)
        users_payload = users_response.get_json()
        self.assertIn("permissions", users_payload["members"][0])

        self.client.post("/api/auth/session", json={"email": "niran@example.com", "name": "Niran Finance"})
        denied_response = self.client.put("/api/settings/users", json=users_payload)
        self.assertEqual(403, denied_response.status_code)

        self.client.post("/api/auth/session", json={"email": "aimmy@example.com", "name": "Aimmy Admin"})
        changed_payload = deepcopy(users_payload)
        changed_payload["members"][1]["role"] = "employee"
        changed_payload["members"][1]["permissions"] = ["dashboard", "sales_documents"]
        allowed_response = self.client.put("/api/settings/users", json=changed_payload)
        self.assertEqual(200, allowed_response.status_code)
        saved_payload = allowed_response.get_json()
        self.assertEqual("employee", saved_payload["members"][1]["role"])
        self.assertEqual(["dashboard", "sales_documents"], saved_payload["members"][1]["permissions"])


if __name__ == "__main__":
    unittest.main()

import unittest
from copy import deepcopy
from io import BytesIO

from werkzeug.datastructures import FileStorage

from backend.app.services.data_service import (
    SEED_DATABASE,
    adjust_inventory_stock,
    confirm_import,
    create_document,
    get_document,
    list_document_summaries,
    list_inventory_movements,
    list_inventory_snapshot,
    preview_import,
)
from backend.app.services.storage_service import DB_PATH, save_database


class InventoryAndImportFlowTests(unittest.TestCase):
    def setUp(self):
        self._original_db = DB_PATH.read_text(encoding="utf-8") if DB_PATH.exists() else None
        save_database(deepcopy(SEED_DATABASE))

    def tearDown(self):
        if self._original_db is None:
            if DB_PATH.exists():
                DB_PATH.unlink()
            return

        DB_PATH.write_text(self._original_db, encoding="utf-8")

    def test_manual_stock_adjustment_updates_inventory_snapshot(self):
        before = next(item for item in list_inventory_snapshot() if item["sku"] == "GD-PKG-A")
        self.assertEqual(248, before["currentQty"])

        result = adjust_inventory_stock(
            {
                "sku": "GD-PKG-A",
                "adjustmentType": "decrease",
                "qty": 8,
                "effectiveDate": "2026-04-19",
                "reason": "Cycle count correction",
                "notes": "Counted fewer packs in warehouse.",
            }
        )

        after = next(item for item in list_inventory_snapshot() if item["sku"] == "GD-PKG-A")
        movement = result["movement"]

        self.assertEqual(240, after["currentQty"])
        self.assertEqual("out", movement["direction"])
        self.assertEqual("manual_adjustment", movement["sourceType"])

        history = list_inventory_movements("GD-PKG-A")
        self.assertEqual("Cycle count correction", history[0]["reason"])
        self.assertEqual(248, history[0]["beforeQty"])
        self.assertEqual(240, history[0]["afterQty"])

    def test_invoice_stock_policy_does_not_touch_draft_but_posts_pending_invoice(self):
        create_document(
            "invoice",
            {
                "number": "INV-2026-0900",
                "customer": "Bangkok Foods Co., Ltd.",
                "date": "2026-04-19",
                "status": "draft",
                "lines": [
                    {
                        "id": "1",
                        "desc": "Premium Coffee Pack 500g",
                        "qty": 5,
                        "price": 580,
                        "tax": 7,
                    }
                ],
            },
        )

        after_draft = next(item for item in list_inventory_snapshot() if item["sku"] == "GD-PKG-A")
        self.assertEqual(248, after_draft["currentQty"])

        create_document(
            "invoice",
            {
                "number": "INV-2026-0901",
                "customer": "Bangkok Foods Co., Ltd.",
                "date": "2026-04-19",
                "status": "pending",
                "lines": [
                    {
                        "id": "1",
                        "desc": "Premium Coffee Pack 500g",
                        "qty": 5,
                        "price": 580,
                        "tax": 7,
                    }
                ],
            },
        )

        after_pending = next(item for item in list_inventory_snapshot() if item["sku"] == "GD-PKG-A")
        self.assertEqual(243, after_pending["currentQty"])

    def test_document_numbers_use_fixed_monthly_sequences(self):
        first_invoice = create_document(
            "invoice",
            {
                "customer": "Bangkok Foods Co., Ltd.",
                "date": "2026-04-19",
                "status": "draft",
                "lines": [],
            },
        )
        second_invoice = create_document(
            "invoice",
            {
                "customer": "Bangkok Foods Co., Ltd.",
                "date": "2026-04-20",
                "status": "draft",
                "lines": [],
            },
        )
        backdated_invoice = create_document(
            "invoice",
            {
                "customer": "Bangkok Foods Co., Ltd.",
                "date": "2026-03-31",
                "status": "draft",
                "lines": [],
            },
        )
        quotation = create_document(
            "quotation",
            {
                "customer": "Bangkok Foods Co., Ltd.",
                "date": "2026-04-19",
                "status": "draft",
                "lines": [],
            },
        )

        self.assertEqual("INV-2026-0400001", first_invoice["id"])
        self.assertEqual("INV-2026-0400002", second_invoice["id"])
        self.assertEqual("INV-2026-0300001", backdated_invoice["id"])
        self.assertEqual("QT-2026-0400001", quotation["id"])

    def test_manual_document_number_must_be_unique_across_documents(self):
        create_document(
            "invoice",
            {
                "number": "MANUAL-001",
                "customer": "Bangkok Foods Co., Ltd.",
                "date": "2026-04-19",
                "status": "draft",
                "lines": [],
            },
        )

        with self.assertRaisesRegex(ValueError, "already exists"):
            create_document(
                "receipt",
                {
                    "number": "MANUAL-001",
                    "customer": "Bangkok Foods Co., Ltd.",
                    "date": "2026-04-19",
                    "status": "draft",
                    "lines": [],
                },
            )

    def test_product_import_preview_validates_uniqueness_and_opening_fields(self):
        csv_bytes = "\n".join(
            [
                "sku,name,product_type,sale_price,status,opening_qty,opening_unit_cost,opening_date",
                "GD-PKG-A,Duplicate Coffee,stock-counted,580,active,10,300,2026-01-01",
                "SKU-NEW-001,Missing Opening Date,stock-counted,350,active,5,100,",
            ]
        ).encode("utf-8")
        file_storage = FileStorage(
            stream=BytesIO(csv_bytes),
            filename="products.csv",
            content_type="text/csv",
        )

        preview = preview_import("products", file_storage)

        self.assertEqual(2, preview["summary"]["totalRows"])
        self.assertEqual(0, preview["summary"]["validRows"])
        self.assertEqual(2, preview["summary"]["invalidRows"])
        self.assertTrue(any("already exists" in message for message in preview["rows"][0]["errors"]))
        self.assertTrue(any("opening qty" in message.lower() for message in preview["rows"][1]["errors"]))

    def test_sales_document_import_creates_invoice_and_receipt_when_requested(self):
        result = confirm_import(
            "sales_documents",
            [
                {
                    "mapped": {
                        "documentNumber": "INV-2026-0950",
                        "customerCode": "C-001",
                        "customerName": "",
                        "documentDate": "2026-04-19",
                        "dueDate": "2026-04-19",
                        "currency": "THB",
                        "reference": "CASH-001",
                        "lineDescription": "Coffee pack cash sale",
                        "qty": 2,
                        "unitPrice": 580,
                        "taxRate": 7,
                        "status": "pending",
                        "recordPayment": True,
                        "paymentDate": "2026-04-19",
                        "paymentMethod": "Cash",
                        "notes": "Imported cash sale",
                    }
                }
            ],
        )

        imported_invoice = get_document("invoice", "INV-2026-0950")
        receipts = list_document_summaries("receipt")

        self.assertEqual(1, result["importedCount"])
        self.assertEqual(1, result["secondaryCount"])
        self.assertIsNotNone(imported_invoice)
        self.assertEqual("paid", imported_invoice["status"])
        self.assertTrue(any(receipt["party"] == "Bangkok Foods Co., Ltd." for receipt in receipts))


if __name__ == "__main__":
    unittest.main()

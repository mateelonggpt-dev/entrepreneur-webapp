import type { ImportMode } from "@/lib/types";

export const IMPORT_MODE_LABELS: Record<ImportMode, string> = {
  contacts: "Contacts",
  products: "Products",
  sales_documents: "Sales Documents / Cash Sales",
};

export const IMPORT_MODE_DESCRIPTIONS: Record<ImportMode, string> = {
  contacts: "Import customers or vendors with unique contact codes.",
  products: "Import catalog items, including strict opening stock fields for stock-counted SKUs.",
  sales_documents: "Import invoices or cash sales without auto-recording payment unless requested.",
};

export const IMPORT_EXPECTED_COLUMNS: Record<ImportMode, string[]> = {
  contacts: [
    "contact_type",
    "code",
    "name",
    "contact_person",
    "email",
    "phone",
    "tax_id",
    "address",
  ],
  products: [
    "sku",
    "name",
    "product_type",
    "sale_price",
    "status",
    "opening_qty",
    "opening_unit_cost",
    "opening_date",
  ],
  sales_documents: [
    "document_number",
    "customer_code",
    "customer_name",
    "document_date",
    "due_date",
    "currency",
    "reference",
    "line_description",
    "qty",
    "unit_price",
    "tax_rate",
    "status",
    "record_payment",
    "payment_date",
    "payment_method",
    "notes",
  ],
};

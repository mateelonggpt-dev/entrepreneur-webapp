# Translation Review TODO

This file tracks user-facing text that still cannot fully switch between English and Thai because it is hardcoded in components instead of coming from `frontend/lib/i18n.ts`.

## Translation-related files

- `frontend/lib/i18n.ts`
  - Central EN/TH translation dictionary and i18next setup.
- `frontend/components/brand/LangSwitch.tsx`
  - Language toggle UI that switches between `en` and `th`.
- `frontend/App.tsx`
  - Boots the frontend and imports the i18n setup.

## Confirmed Thai locale updates

- Added missing Thai key: `nav.payroll`
- Updated Thai wording to follow glossary terms:
  - `nav.sales` -> `รายรับ`
  - `nav.expenses` -> `รายจ่าย`
  - `nav.inventory` -> `สต็อกสินค้า`

## Hardcoded user-facing text to move into i18n

### High priority

- `frontend/components/modals/CombinedReceiptModal.tsx`
  - Hardcoded labels and errors such as `Create Combined Receipt`, `Source mode`, `Billing document`, `Add Split`, `Create Receipt`, and submit error messages.
- `frontend/components/modals/CombinedBillingModal.tsx`
  - Hardcoded labels and errors such as `Create Combined Billing`, `Create Billing`, and billing validation/error text.
- `frontend/views/sales/Receipts.tsx`
  - Hardcoded page title, empty state, action labels, and export/download messages.
- `frontend/views/sales/Billing.tsx`
  - Hardcoded page title, empty state, and action labels such as `New Billing` and `Create receipt`.
- `frontend/views/settings/Settings.tsx`
  - Section titles, menu labels, and settings descriptions are largely hardcoded English.

### Medium priority

- `frontend/views/contacts/Customers.tsx`
  - Hardcoded page title, search placeholder, empty state, action labels, and export success text.
- `frontend/views/contacts/Vendors.tsx`
  - Hardcoded page title, empty state, action labels, and export success text.
- `frontend/views/products/Products.tsx`
  - Hardcoded page title, action labels, and table/dropdown text like `Edit product`, `Adjust stock`, and `Export products`.
- `frontend/views/reports/Reports.tsx`
  - Hardcoded report page labels, confirm/delete prompts, and report error messages.

### Partial i18n usage still mixed with hardcoded text

- `frontend/components/modals/QuotationModal.tsx`
  - Uses i18n for many fields, but still contains hardcoded text like `Edit Quotation`, `Save Changes`, and `Saving quotation draft...`.

## Notes

- English strings were intentionally left unchanged.
- No business logic changes were made as part of this review.

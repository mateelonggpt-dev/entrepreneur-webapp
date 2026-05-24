# Phase 7 Manual QA Checklist

Use this checklist after the frontend dev server is running. Record screenshots or exported PDF samples only for flows that changed visually.

## Language

- [ ] Clear `localStorage` or open a fresh private browser session.
- [ ] First load shows Thai UI even when the browser language is English.
- [ ] Click `EN`; main navigation, buttons, modals, and page labels switch to English.
- [ ] Click the Thai language option; main navigation, buttons, modals, and page labels switch back to Thai.
- [ ] Change UI language while an income document form is open; `documentLanguage` and document preview language do not change.
- [ ] Change document language in the document form; preview/PDF language changes, but UI language does not change.
- [ ] Run the mojibake scan and confirm no user-facing mojibake remains.

## Income Workflow

- [ ] Open `/income/create`.
- [ ] Create a quotation.
- [ ] Convert the quotation to an invoice.
- [ ] Convert the quotation to a tax invoice.
- [ ] Create a direct invoice without a quotation.
- [ ] Create a delivery note first, then issue a tax invoice from it.
- [ ] Record a receipt for an invoice.
- [ ] Attempt to record a receipt above amount due and confirm the backend blocks it.
- [ ] Confirm next-action buttons appear with localized labels.

## Purchase Workflow

- [ ] Open `/expense/create`.
- [ ] Create a purchase order.
- [ ] Convert purchase order to goods receive.
- [ ] Create a vendor invoice.
- [ ] Create a direct expense.
- [ ] Record a supplier payment and confirm amount paid/due updates.
- [ ] Create or auto-create a WHT certificate and confirm it links to the payment/source document.
- [ ] Attach invoice/receipt, payment, delivery, and WHT evidence; remaining task behavior still works.

## VAT And Tax Guidance

- [ ] Delivery-before-payment shows tax point guidance.
- [ ] Payment-before-delivery/deposit shows prepayment guidance.
- [ ] VAT reporting period is recorded from `taxPointDate`.
- [ ] A non-VAT company cannot issue a full tax invoice unless the configured override path is used.
- [ ] Credit/debit note creation requires an original document link.

## Reports And Ledger

- [ ] Dashboard loads.
- [ ] Reports page loads.
- [ ] Existing report downloads work.
- [ ] VAT summary includes records with `taxPointDate`/`vatReportingPeriod` when present.
- [ ] WHT report includes linked payment/source document IDs.
- [ ] Legacy records without workflow fields still load.

## PDF Regression

- [ ] Browser preview renders for quotation, invoice, tax invoice, receipt, and purchase/expense documents.
- [ ] PDF export succeeds.
- [ ] A4 layout remains aligned.
- [ ] Original/copy pages render correctly.
- [ ] Long item lists paginate correctly.

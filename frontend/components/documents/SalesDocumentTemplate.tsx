import type { CSSProperties, RefObject } from "react";
import { SalesDocumentPage } from "@/components/documents/SalesDocumentPage";
import type { SalesDocumentCopyKind, SalesDocumentTemplateData } from "@/components/documents/types";

export const SalesDocumentTemplate = ({
  data,
  previewRef,
}: {
  data: SalesDocumentTemplateData;
  previewRef?: RefObject<HTMLDivElement>;
}) => {
  const copies: SalesDocumentCopyKind[] =
    data.copyGeneration === "both" ? ["original", "copy"] : [data.copyGeneration];
  const accentColor = data.branding.accentColor || "#14B8A6";

  return (
    <div
      ref={previewRef}
      className="preview-wrapper sales-document-print-root"
      style={{
        "--doc-brand": accentColor,
        "--doc-brand-soft": `${accentColor}14`,
      } as CSSProperties}
    >
      <style>{documentTemplateCss}</style>
      {copies.map((copyKind) => (
        <SalesDocumentPage key={copyKind} data={data} copyKind={copyKind} />
      ))}
    </div>
  );
};

const documentTemplateCss = `
  .sales-document-print-root {
    --doc-border: #d9e2ec;
    --doc-text: #0f172a;
    --doc-muted: #64748b;
    color: var(--doc-text);
    font-family: "Noto Sans Thai", "Sarabun", "Prompt", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 28px;
    padding: 24px;
    background: linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
  }

  .sales-document-page {
    width: 210mm;
    max-width: 100%;
    min-height: 297mm;
    padding: 14mm 16mm;
    box-sizing: border-box;
    background: #ffffff;
    display: flex;
    flex-direction: column;
    overflow: visible;
    page-break-after: always;
    break-after: page;
    font-family: inherit;
    font-size: 11.2px;
    line-height: 1.45;
    border: 1px solid rgba(148, 163, 184, 0.28);
    border-radius: 20px;
    box-shadow: 0 28px 90px rgba(15, 23, 42, 0.18);
  }

  .sales-document-page,
  .sales-document-page * {
    box-sizing: border-box;
    min-width: 0;
  }

  .sales-document-page:last-child { page-break-after: auto; break-after: auto; }

  .sales-doc-avoid-break,
  .sales-doc-header,
  .document-main-info,
  .sales-doc-bottom,
  .sales-doc-bottom-grid,
  .sales-doc-payment-notes,
  .sales-doc-signature-section,
  .sales-doc-table tr {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .sales-doc-header { display: grid; grid-template-columns: minmax(0, 1fr) minmax(64mm, 76mm); gap: 9mm; align-items: start; padding-bottom: 9mm; border-bottom: 2px solid var(--doc-brand); }
  .sales-doc-seller-head { display: flex; gap: 5mm; align-items: flex-start; min-width: 0; }
  .sales-doc-logo { width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; color: var(--doc-brand); flex: 0 0 auto; border: 1px solid #ccfbf1; border-radius: 16px; background: var(--doc-brand-soft); overflow: hidden; }
  .sales-doc-logo img { max-width: 86%; max-height: 86%; object-fit: contain; }
  .sales-doc-logo-fallback { font-size: 18px; font-weight: 950; line-height: 1; }
  .sales-doc-seller-copy { font-size: 10.6px; line-height: 1.42; color: #334155; max-width: 112mm; overflow-wrap: anywhere; word-break: break-word; }
  .sales-doc-seller-copy p { margin: 0; }
  .sales-doc-company-name { font-size: 15.6px; line-height: 1.28; font-weight: 800; color: #020617; margin: 0 0 4px !important; }
  .sales-doc-company-name span { color: var(--doc-brand); }
  .sales-doc-title-zone { text-align: right; min-width: 0; max-width: 100%; }
  .sales-doc-copy-label { display: inline-flex; border: 1px solid #ccfbf1; background: var(--doc-brand-soft); color: var(--doc-brand); font-size: 10px; font-weight: 800; min-height: 26px; padding: 4px 12px; margin: 0 0 7px; border-radius: 999px; letter-spacing: 0.08em; text-transform: uppercase; }
  .sales-doc-title-zone h1 { color: var(--doc-brand); font-size: 34px; line-height: 1.02; font-weight: 900; margin: 0; letter-spacing: 0; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: clip; }
  .sales-doc-title-zone h1.sales-doc-title-medium { font-size: 24px; line-height: 1.06; }
  .sales-doc-title-zone h1.sales-doc-title-long { font-size: 16px; line-height: 1.12; }
  .sales-doc-title-zone h1.sales-doc-title-extra-long { font-size: 12.5px; line-height: 1.14; }
  .sales-doc-title-en { color: var(--doc-muted); font-size: 11.2px; font-weight: 700; margin: 2mm 0 0; letter-spacing: 0.04em; text-transform: uppercase; }

  .document-main-info { display: grid; grid-template-columns: minmax(0, 1fr) minmax(72mm, 82mm); gap: 7mm; margin-top: 8mm; font-size: 10.8px; line-height: 1.42; }
  .left-info-column, .right-info-column { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
  .sales-doc-party, .sales-doc-info-box { border: 1px solid var(--doc-border); border-radius: 16px; background: #fff; padding: 5mm; box-shadow: 0 10px 26px rgba(15, 23, 42, 0.045); }
  .sales-doc-party { border-left: 4px solid var(--doc-brand); }
  .sales-doc-section-label { color: var(--doc-brand); font-weight: 900; margin: 0 0 3mm; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; }
  .sales-doc-party-grid { display: grid; grid-template-columns: 76px minmax(0, 1fr); gap: 2mm 4mm; }
  .sales-doc-field-label, .sales-doc-info-row span, .sales-doc-summary-line span { color: var(--doc-muted); font-weight: 800; }
  .sales-doc-strong { font-weight: 900; color: #0f172a; }
  .sales-doc-party-grid p, .sales-doc-info-box p, .sales-doc-payment-grid p, .sales-doc-note-block p, .sales-doc-words-line p { margin: 0; }
  .sales-doc-preline, .sales-doc-payment-grid p, .sales-doc-note-block p { white-space: pre-line; }
  .sales-doc-info-row, .sales-doc-summary-line { display: grid; gap: 12px; align-items: start; min-height: 21px; padding: 2px 0; }
  .sales-doc-info-row { grid-template-columns: minmax(76px, 34%) minmax(0, 1fr); }
  .sales-doc-summary-line { grid-template-columns: minmax(0, 1fr) auto; }
  .sales-doc-info-row span { min-width: 0; overflow-wrap: anywhere; word-break: break-word; }
  .sales-doc-info-row strong, .sales-doc-summary-line strong { text-align: right; font-weight: 800; color: #0f172a; }
  .sales-doc-info-value {
    min-width: 0;
    max-width: 100%;
    overflow-wrap: anywhere;
    word-break: break-word;
    white-space: normal;
  }
  .sales-doc-info-value.sales-doc-preline {
    text-align: left;
    white-space: pre-wrap;
    line-height: 1.35;
  }
  .sales-doc-reference-list {
    display: grid;
    gap: 6px;
    max-width: 100%;
    min-width: 0;
    text-align: left;
  }
  .sales-doc-reference-item {
    max-width: 100%;
    min-width: 0;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .sales-doc-reference-item p {
    margin: 0;
    color: #334155;
    font-weight: 650;
    line-height: 1.32;
  }
  .sales-doc-reference-primary {
    color: #0f172a !important;
    font-weight: 900 !important;
  }

  .sales-doc-table-zone { flex: 0 0 auto; min-height: 0; margin-top: 8mm; overflow-x: auto; }
  .sales-doc-table { width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed; font-size: 10.4px; border: 1px solid var(--doc-border); border-radius: 16px; overflow: hidden; }
  .sales-doc-table th { background: #f1f5f9; border-bottom: 1px solid #b8c4d4; color: #0f172a; padding: 8px 7px; text-align: center; font-weight: 900; }
  .sales-doc-table td { border-bottom: 1px solid #edf2f7; padding: 7px; vertical-align: top; text-align: right; overflow-wrap: anywhere; word-break: break-word; color: #1e293b; }
  .sales-doc-table tbody tr:nth-child(even) td { background: #fbfdff; }
  .sales-doc-text-left { text-align: left !important; }
  .sales-doc-line-title { font-weight: 850; margin: 0; color: #0f172a; }
  .sales-doc-line-detail { color: var(--doc-muted); margin: 1.2mm 0 0; font-size: 9.8px; line-height: 1.35; }

  .sales-doc-bottom { margin-top: 9mm; flex-shrink: 0; }
  .sales-doc-bottom-grid { border-top: 1px solid #b8c4d4; padding-top: 8mm; display: grid; grid-template-columns: minmax(0, 1fr) minmax(64mm, 78mm); gap: 7mm; font-size: 10.6px; line-height: 1.4; }
  .sales-doc-summary-words { border: 1px solid var(--doc-border); border-radius: 14px; margin-top: 5mm; padding: 4mm; background: #f8fafc; }
  .sales-doc-summary-words span { display: block; color: var(--doc-brand); font-weight: 900; font-size: 9.8px; text-transform: uppercase; }
  .sales-doc-summary-words p { margin: 2mm 0 0; color: #334155; line-height: 1.42; white-space: pre-line; overflow-wrap: anywhere; word-break: break-word; }
  .sales-doc-grand-total { background: linear-gradient(135deg, var(--doc-brand) 0%, #0f766e 100%); color: #fff; padding: 5mm; display: flex; justify-content: space-between; align-items: center; gap: 4mm; min-height: 44px; border-radius: 16px; box-shadow: 0 16px 32px rgba(15, 118, 110, 0.18); margin: 3mm 0; }
  .sales-doc-grand-total span { font-weight: 900; color: rgba(255, 255, 255, 0.9); text-transform: uppercase; }
  .sales-doc-grand-total strong { color: #fff; font-size: 18px; font-weight: 950; white-space: nowrap; }
  .sales-doc-summary-strong { border-top: 1px solid var(--doc-border); margin-top: 2mm; padding-top: 3mm; }
  .sales-doc-summary-strong strong { color: var(--doc-brand); font-size: 12.4px; }

  .sales-doc-payment-notes { font-size: 10.6px; line-height: 1.42; overflow-wrap: anywhere; word-break: break-word; }
  .sales-doc-bank-card, .sales-doc-payment-block, .sales-doc-note-block { border: 1px solid var(--doc-border); border-radius: 16px; padding: 5mm; background: #fff; box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05); }
  .sales-doc-bank-card { display: grid; grid-template-columns: 5px 1fr; gap: 10px; }
  .sales-doc-bank-strip { background: var(--doc-brand); border-radius: 999px; }
  .sales-doc-bank-name { color: #0f172a; font-weight: 900; }
  .sales-doc-note-block { margin-top: 4mm; }

  .sales-doc-signature-section { border-top: 1px solid #b8c4d4; margin-top: 8mm; padding-top: 6mm; font-size: 10.2px; min-height: 86px; overflow: hidden; }
  .sales-doc-signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 42px; text-align: center; }
  .sales-doc-signature-box { min-height: 78px; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; padding: 0 8px; }
  .sales-doc-signature-image-frame { display: flex; align-items: center; justify-content: center; width: 58mm; max-width: 100%; height: 16mm; margin: 0 auto 2.5mm; overflow: hidden; }
  .sales-doc-signature-image { max-width: 58mm; max-height: 16mm; object-fit: contain; display: block; }
  .sales-doc-signature-line { border-top: 1px solid #334155; width: 76%; margin: 0 auto; }
  .sales-doc-signature-box p { margin: 4px 0 0; font-weight: 850; }
  .sales-doc-signature-box span { display: block; margin: 4px 0 0; color: var(--doc-muted); font-size: 9.2px; }



  .sales-document-print-root.sales-document-pdf-export {
    width: auto !important;
    min-height: 0 !important;
    padding: 0 !important;
    gap: 0 !important;
    background: #ffffff !important;
    align-items: flex-start !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-document-page {
    width: 794px !important;
    min-width: 794px !important;
    max-width: 794px !important;
    height: 1123px !important;
    min-height: 1123px !important;
    margin: 0 !important;
    padding: 38px 50px !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    overflow: visible !important;
    font-size: 10.7px !important;
    line-height: 1.34 !important;
    page-break-after: always;
    break-after: page;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-document-page:last-child {
    page-break-after: auto;
    break-after: auto;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-header {
    gap: 28px !important;
    padding-bottom: 24px !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-logo {
    width: 52px !important;
    height: 52px !important;
    border-radius: 12px !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-seller-head {
    gap: 18px !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-seller-copy {
    font-size: 9.4px !important;
    line-height: 1.24 !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-company-name {
    font-size: 14px !important;
    line-height: 1.18 !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-copy-label {
    min-height: 22px !important;
    padding: 3px 10px !important;
    margin-bottom: 6px !important;
    font-size: 8.8px !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-title-zone h1 {
    font-size: 30px !important;
    line-height: 1 !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-title-zone h1.sales-doc-title-medium {
    font-size: 20px !important;
    line-height: 1.05 !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-title-zone h1.sales-doc-title-long {
    font-size: 14px !important;
    line-height: 1.1 !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-title-zone h1.sales-doc-title-extra-long {
    font-size: 11px !important;
    line-height: 1.1 !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-title-en {
    font-size: 9.8px !important;
    margin-top: 6px !important;
  }

  .sales-document-print-root.sales-document-pdf-export .document-main-info {
    gap: 22px !important;
    margin-top: 24px !important;
    font-size: 10px !important;
    line-height: 1.28 !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-party,
  .sales-document-print-root.sales-document-pdf-export .sales-doc-info-box {
    padding: 16px !important;
    border-radius: 12px !important;
    box-shadow: none !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-section-label {
    margin-bottom: 10px !important;
    font-size: 9.4px !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-party-grid {
    gap: 6px 14px !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-info-row,
  .sales-document-print-root.sales-document-pdf-export .sales-doc-summary-line {
    min-height: 18px !important;
    padding: 1px 0 !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-table-zone {
    min-height: 150px !important;
    margin-top: 24px !important;
    overflow: visible !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-table {
    font-size: 9.6px !important;
    border-radius: 10px !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-table th {
    padding: 6px 6px !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-table td {
    padding: 5px 6px !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-line-detail {
    font-size: 8.7px !important;
    line-height: 1.2 !important;
    margin-top: 4px !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-bottom-grid {
    padding-top: 20px !important;
    gap: 22px !important;
    font-size: 9.8px !important;
    line-height: 1.28 !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-summary-words {
    margin-top: 14px !important;
    padding: 12px !important;
    border-radius: 10px !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-summary-words span {
    font-size: 8.7px !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-grand-total {
    padding: 14px 18px !important;
    min-height: 38px !important;
    border-radius: 12px !important;
    margin: 10px 0 !important;
    box-shadow: none !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-grand-total strong {
    font-size: 16px !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-summary-strong {
    margin-top: 8px !important;
    padding-top: 10px !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-payment-notes {
    font-size: 9.8px !important;
    line-height: 1.28 !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-bank-card,
  .sales-document-print-root.sales-document-pdf-export .sales-doc-payment-block,
  .sales-document-print-root.sales-document-pdf-export .sales-doc-note-block {
    padding: 12px !important;
    border-radius: 12px !important;
    box-shadow: none !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-note-block {
    margin-top: 14px !important;
    min-height: 0 !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-signature-section {
    margin-top: 18px !important;
    padding-top: 14px !important;
    min-height: 58px !important;
    font-size: 9px !important;
    overflow: visible !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-signatures {
    gap: 34px !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-signature-box {
    min-height: 52px !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-signature-image-frame {
    height: 42px !important;
    margin-bottom: 8px !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-signature-image {
    max-height: 42px !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-signature-box span {
    font-size: 8px !important;
  }


  /* PDF_NATURAL_SPACING_HOTFIX
     Keep short documents readable. Do not stretch the item table to fill A4. */
  .sales-document-print-root.sales-document-pdf-export .sales-doc-table-zone {
    flex: 0 0 auto !important;
    min-height: 0 !important;
    margin-top: 24px !important;
    overflow: visible !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-bottom {
    margin-top: 24px !important;
    flex-shrink: 0 !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-bottom-grid {
    padding-top: 18px !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-signature-section {
    margin-top: 22px !important;
  }


  /* REFERENCE_OVERFLOW_HOTFIX
     Long customer PO/reference document text must wrap inside the right info box. */
  .sales-doc-info-box {
    min-width: 0;
    overflow: hidden;
  }

  .sales-doc-info-box .sales-doc-info-row {
    grid-template-columns: minmax(74px, 32%) minmax(0, 1fr) !important;
  }

  .sales-doc-info-box .sales-doc-info-row span,
  .sales-doc-info-box .sales-doc-info-row strong {
    min-width: 0 !important;
  }

  .sales-doc-info-box .sales-doc-info-value {
    max-width: 100% !important;
    overflow-wrap: anywhere !important;
    word-break: break-word !important;
    white-space: normal !important;
  }

  .sales-doc-info-box .sales-doc-info-value.sales-doc-preline {
    text-align: left !important;
    white-space: pre-wrap !important;
    line-height: 1.32 !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-info-box .sales-doc-info-row {
    grid-template-columns: 84px minmax(0, 1fr) !important;
    gap: 8px !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-info-box .sales-doc-info-value.sales-doc-preline {
    font-size: 8.9px !important;
    line-height: 1.22 !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-reference-list {
    gap: 4px !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-reference-item p {
    font-size: 8.9px !important;
    line-height: 1.2 !important;
  }

  @media (max-width: 920px) {
    .sales-document-print-root { padding: 12px; }
    .sales-document-page { width: 100%; min-height: auto; padding: 24px; border-radius: 16px; font-size: 12px; }
    .sales-doc-header, .document-main-info, .sales-doc-bottom-grid { grid-template-columns: 1fr; }
    .sales-doc-title-zone { text-align: left; }
    .sales-doc-title-zone h1 { font-size: 30px; }
    .sales-doc-title-zone h1.sales-doc-title-medium { font-size: 22px; }
    .sales-doc-title-zone h1.sales-doc-title-long { font-size: 15px; }
    .sales-doc-title-zone h1.sales-doc-title-extra-long { font-size: 12px; }
    .sales-doc-party-grid, .sales-doc-info-row { grid-template-columns: 1fr; gap: 2px; }
    .sales-doc-table { min-width: 720px; }
  }

  /* PDF export desktop/A4 guard */

  .sales-document-print-root.sales-document-pdf-export .sales-doc-header {
    grid-template-columns: minmax(0, 1fr) minmax(240px, 288px) !important;
  }

  .sales-document-print-root.sales-document-pdf-export .document-main-info {
    grid-template-columns: minmax(0, 1fr) minmax(272px, 310px) !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-bottom-grid {
    grid-template-columns: minmax(0, 1fr) minmax(242px, 295px) !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-title-zone {
    text-align: right !important;
    align-items: flex-end !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-party-grid {
    grid-template-columns: 76px minmax(0, 1fr) !important;
  }

  .sales-document-print-root.sales-document-pdf-export .sales-doc-info-row {
    grid-template-columns: minmax(88px, 34%) minmax(0, 1fr) !important;
  }


  @media print {
    @page { size: A4 portrait; margin: 0; }
    .sales-document-print-root { width: 100%; background: #fff; gap: 0; padding: 0; }
    .sales-document-page { width: 210mm; min-height: 297mm; margin: 0; border: 0; border-radius: 0; box-shadow: none !important; page-break-after: always; break-after: page; }
    .sales-document-page:last-child { page-break-after: auto; break-after: auto; }
  }
`;

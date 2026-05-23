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
  const accentColor = data.branding.accentColor || "#2DD4BF";

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
    --doc-border: #d1d5db;
    --doc-text: #111827;
    color: var(--doc-text);
    font-family: "Noto Sans Thai", "Sarabun", "Prompt", Tahoma, Arial, sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    background: #f8fafc;
  }

  .sales-document-page {
    width: 210mm;
    height: 297mm;
    margin: 0;
    padding: 8mm 10mm;
    box-sizing: border-box;
    background: #ffffff;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    page-break-after: always;
    break-after: page;
    font-family: "Noto Sans Thai", "Sarabun", "Prompt", Tahoma, Arial, sans-serif;
  }

  .sales-document-page:last-child {
    page-break-after: auto;
    break-after: auto;
  }

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

  .sales-doc-header {
    display: grid;
    grid-template-columns: 1fr 70mm;
    gap: 5mm;
    align-items: start;
    padding-bottom: 5px;
    border-bottom: 1px solid var(--doc-brand);
  }

  .sales-doc-seller-head {
    display: flex;
    gap: 4mm;
    min-width: 0;
  }

  .sales-doc-logo {
    width: 54px;
    height: 54px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
    flex: 0 0 auto;
  }

  .sales-doc-logo img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .sales-doc-seller-copy {
    font-size: 8.2px;
    line-height: 1.16;
    color: #334155;
    max-width: 100mm;
  }

  .sales-doc-company-name {
    font-size: 11.8px;
    line-height: 1.18;
    font-weight: 700;
    color: #020617;
    margin: 0 0 3px;
  }

  .sales-doc-title-zone {
    text-align: right;
  }

  .sales-doc-copy-label {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #d1d5db;
    background: #ffffff;
    color: var(--doc-brand);
    font-size: 8.2px;
    font-weight: 700;
    min-height: 18px;
    padding: 1px 8px;
    margin: 0 0 3px;
    line-height: 1;
  }

  .sales-doc-title-zone h1 {
    color: var(--doc-brand);
    font-size: 22px;
    line-height: 1.08;
    font-weight: 800;
    margin: 0;
    overflow-wrap: anywhere;
  }

  .sales-doc-title-en {
    color: #64748b;
    font-size: 8.2px;
    font-weight: 600;
    margin: 1mm 0 0;
  }

  .document-main-info {
    display: grid;
    grid-template-columns: 1fr 285px;
    gap: 12px;
    margin-top: 5px;
    font-size: 8.2px;
    line-height: 1.15;
  }

  .left-info-column,
  .right-info-column {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .sales-doc-party {
    border-top: 1px solid var(--doc-border);
    padding-top: 3px;
  }

  .sales-doc-section-label {
    display: flex;
    align-items: center;
    color: var(--doc-brand);
    font-weight: 800;
    margin: 0 0 2px;
    font-size: 8.2px;
    min-height: 12px;
    line-height: 1.05;
  }

  .sales-doc-party-grid {
    display: grid;
    grid-template-columns: 62px 1fr;
    gap: 1px 6px;
  }

  .sales-doc-field-label {
    color: #334155;
    font-weight: 700;
    white-space: nowrap;
  }

  .sales-doc-strong {
    font-weight: 800;
  }

  .sales-doc-party-grid p,
  .sales-doc-info-box p,
  .sales-doc-payment-grid p,
  .sales-doc-note-block p,
  .sales-doc-words-line p {
    margin: 0;
  }

  .sales-doc-preline,
  .sales-doc-payment-grid p,
  .sales-doc-note-block p {
    white-space: pre-line;
  }

  .sales-doc-info-box {
    border-top: 1px solid var(--doc-border);
    border-bottom: 1px solid var(--doc-border);
    background: transparent;
    padding: 4px 0;
    font-size: 8.2px;
    line-height: 1.15;
  }

  .sales-doc-info-row {
    display: grid;
    grid-template-columns: 78px 1fr;
    gap: 5px;
    align-items: center;
    min-height: 15px;
    line-height: 1.15;
  }

  .sales-doc-summary-line {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 10px;
    align-items: center;
    min-height: 15px;
    line-height: 1.15;
  }

  .sales-doc-info-row span,
  .sales-doc-summary-line span {
    color: var(--doc-brand);
    font-weight: 700;
  }

  .sales-doc-info-row strong,
  .sales-doc-summary-line strong {
    text-align: right;
    font-weight: 600;
  }

  .sales-doc-contact-box {
    border-top: 1px solid var(--doc-border);
    padding-top: 4px;
    font-size: 8px;
    line-height: 1.18;
  }

  .sales-doc-table-zone {
    flex: 1 1 auto;
    min-height: 210px;
    max-height: none;
    margin-top: 5px;
  }

  .sales-doc-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 8.2px;
  }

  .sales-doc-table th {
    background: transparent;
    border-top: 1px solid #cbd5e1;
    border-bottom: 1px solid #cbd5e1;
    color: #0f172a;
    padding: 3px 5px;
    text-align: center;
    font-weight: 800;
    vertical-align: middle;
    line-height: 1.15;
    height: 18px;
  }

  .sales-doc-table td {
    border-bottom: 1px solid #eef2f7;
    padding: 2.5px 5px;
    vertical-align: top;
    text-align: right;
    overflow-wrap: anywhere;
  }

  .sales-doc-text-left {
    text-align: left !important;
  }

  .sales-doc-line-title {
    font-weight: 700;
    margin: 0;
  }

  .sales-doc-line-detail {
    color: #64748b;
    margin: 0.5mm 0 0;
  }

  .sales-doc-bottom {
    margin-top: auto;
    flex-shrink: 0;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .sales-doc-bottom-grid {
    border-top: 1px solid #cbd5e1;
    padding-top: 8px;
    display: grid;
    grid-template-columns: 1fr 58mm;
    gap: 12px;
    font-size: 8.2px;
    line-height: 1.15;
  }

  .sales-doc-words-line {
    border-top: 0;
    margin-top: 0;
    padding-top: 0;
  }

  .sales-doc-summary-words {
    border-top: 1px solid #e2e8f0;
    margin-top: 5px;
    padding-top: 4px;
  }

  .sales-doc-summary-words span {
    display: block;
    color: var(--doc-brand);
    font-weight: 700;
    line-height: 1.1;
  }

  .sales-doc-summary-words p {
    margin: 2px 0 0;
    color: #334155;
    line-height: 1.18;
    white-space: pre-line;
  }

  .sales-doc-words-line strong {
    display: block;
    margin-bottom: 0.8mm;
  }

  .sales-doc-grand-total {
    border: 0;
    border-top: 1px solid var(--doc-border);
    border-bottom: 1px solid var(--doc-border);
    background: #ffffff;
    padding: 4px 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 3mm;
    min-height: 25px;
    line-height: 1.1;
  }

  .sales-doc-grand-total span {
    font-weight: 800;
  }

  .sales-doc-grand-total strong {
    color: var(--doc-brand);
    font-size: 13px;
  }

  .sales-doc-total-details {
    margin-top: 4px;
  }

  .sales-doc-summary-strong strong {
    color: var(--doc-brand);
    font-size: 10px;
  }

  .sales-doc-payment-notes {
    font-size: 8.2px;
    line-height: 1.15;
  }

  .sales-doc-payment-grid {
    display: block;
  }

  .sales-doc-bank-card {
    display: grid;
    grid-template-columns: 4px 1fr;
    gap: 7px;
    border: 1px solid #ccfbf1;
    background: #f8fffd;
    padding: 5px 6px;
    color: #334155;
  }

  .sales-doc-bank-strip {
    background: var(--doc-brand);
    min-height: 100%;
  }

  .sales-doc-bank-name {
    color: #0f172a;
    font-weight: 800;
  }

  .sales-doc-payment-block {
    border-top: 1px solid #e2e8f0;
    margin-top: 4px;
    padding-top: 3px;
  }

  .sales-doc-note-block {
    border-top: 1px solid #e2e8f0;
    margin-top: 4px;
    padding-top: 3px;
    min-height: 16px;
  }

  .sales-doc-signature-section {
    border-top: 1px solid #cbd5e1;
    margin-top: 7px;
    padding-top: 4px;
    font-size: 8.2px;
    min-height: 66px;
    flex-shrink: 0;
    page-break-inside: avoid;
    break-inside: avoid;
    position: relative;
    overflow: hidden;
  }

  .sales-doc-signatures {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 34px;
    align-items: stretch;
    text-align: center;
  }

  .sales-doc-signature-box {
    min-height: 58px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    padding: 0 8px;
    overflow: hidden;
  }

  .sales-doc-signature-image-frame {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 58mm;
    max-width: 100%;
    height: 14mm;
    margin: 0 auto 1.5mm;
    overflow: hidden;
  }

  .sales-doc-signature-image {
    max-width: 58mm;
    max-height: 14mm;
    object-fit: contain;
    display: block;
  }

  .sales-doc-signature-line {
    border-top: 1px solid #475569;
    height: 0;
    width: 76%;
    margin: 0 auto;
  }

  .sales-doc-signature-box p {
    margin: 3px 0 0;
    font-weight: 700;
    line-height: 1.05;
  }

  .sales-doc-signature-box span {
    display: block;
    margin: 4px 0 0;
    color: #64748b;
    font-size: 7.6px;
    line-height: 1.05;
  }

  @media print {
    @page {
      size: A4 portrait;
      margin: 0;
    }

    body * {
      visibility: hidden;
    }

    .sales-document-print-root,
    .sales-document-print-root * {
      visibility: visible;
    }

    .sales-document-print-root {
      position: absolute;
      inset: 0;
      width: 100%;
      background: #ffffff;
      gap: 0;
    }

    .sales-document-page {
      width: 210mm;
      height: 297mm;
      margin: 0;
      border: 0;
      box-shadow: none !important;
    }
  }
`;

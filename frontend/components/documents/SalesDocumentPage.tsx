import { DocumentHeader } from "@/components/documents/DocumentHeader";
import { DocumentInfoBox } from "@/components/documents/DocumentInfoBox";
import { DocumentSummary } from "@/components/documents/DocumentSummary";
import { LineItemsTable } from "@/components/documents/LineItemsTable";
import { PartyInfoBlock } from "@/components/documents/PartyInfoBlock";
import { PaymentBlock } from "@/components/documents/PaymentBlock";
import { SignatureBlock } from "@/components/documents/SignatureBlock";
import type { SalesDocumentCopyKind, SalesDocumentTemplateData } from "@/components/documents/types";

export const SalesDocumentPage = ({
  data,
  copyKind,
}: {
  data: SalesDocumentTemplateData;
  copyKind: SalesDocumentCopyKind;
}) => (
  <div className="sales-document-page">
    <DocumentHeader data={data} copyKind={copyKind} />
    <section className="document-main-info">
      <div className="left-info-column">
        <PartyInfoBlock type="customer" party={data.customer} language={data.language} />
      </div>
      <div className="right-info-column">
        <DocumentInfoBox data={data} />
      </div>
    </section>
    <LineItemsTable data={data} />
    <div className="document-bottom sales-doc-bottom">
      <section className="sales-doc-bottom-grid">
        <PaymentBlock data={data} />
        <DocumentSummary data={data} />
      </section>
      <SignatureBlock data={data} />
    </div>
  </div>
);

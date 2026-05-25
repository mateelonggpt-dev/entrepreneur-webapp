import type { ReactNode } from "react";
import type { SalesDocumentTemplateData } from "@/components/documents/types";

const labels = {
  en: {
    documentNo: "Document No.",
    issueDate: "Date",
    creditTerm: "Credit",
    dueDate: "Due date",
    reference: "Reference / RE",
    referenceDocuments: "Reference documents",
    quotationNo: "Quotation No.",
    customerPo: "Customer PO No.",
    seller: "Seller",
    days: "days",
  },
  th: {
    documentNo: "เลขที่เอกสาร",
    issueDate: "วันที่",
    creditTerm: "เครดิต",
    dueDate: "วันครบกำหนด",
    reference: "อ้างอิง / RE",
    referenceDocuments: "เอกสารอ้างอิง",
    quotationNo: "เลขที่ใบเสนอราคา",
    customerPo: "เลขที่ PO ลูกค้า",
    seller: "ผู้ขาย",
    days: "วัน",
  },
};

type ReferenceDocument = NonNullable<SalesDocumentTemplateData["referenceDocuments"]>[number];

const referenceKind = (reference: ReferenceDocument) =>
  reference.type || reference.kind || reference.documentTypes?.[0] || "";

const isQuotationReference = (reference: ReferenceDocument) =>
  referenceKind(reference) === "quotation" || Boolean(reference.documentTypes?.includes("quotation"));

const uniqueValues = (values: string[]) => Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const printableReferenceInfo = (references: ReferenceDocument[]) => {
  const quotationReferences = references.filter(isQuotationReference);
  const printableReferences = quotationReferences.length ? quotationReferences : references;
  return {
    isQuotationOnly: quotationReferences.length > 0,
    numbers: uniqueValues(printableReferences.map((reference) => reference.number || reference.id)),
  };
};

export const DocumentInfoBox = ({ data }: { data: SalesDocumentTemplateData }) => {
  const t = labels[data.language];
  const referenceDocuments = data.referenceDocuments ?? [];
  const referenceInfo = printableReferenceInfo(referenceDocuments);
  const fallbackReference = data.relatedDocument?.trim();
  const customerPoReference = data.reference?.trim();
  const sellerValue = data.sellerUser?.name
    ? `${data.sellerUser.name}${data.sellerUser.email ? ` (${data.sellerUser.email})` : ""}`
    : data.documentContact?.trim() || data.seller.contactPerson || data.seller.name || "-";

  return (
    <aside className="sales-doc-info-stack sales-doc-avoid-break">
      <div className="sales-doc-info-box">
        <InfoRow label={`${t.documentNo}:`} value={data.documentNumber || "-"} />
        {referenceInfo.numbers.length ? (
          <InfoRow
            label={`${referenceInfo.isQuotationOnly ? t.quotationNo : t.referenceDocuments}:`}
            value={referenceInfo.numbers.join(", ")}
          />
        ) : fallbackReference ? (
          <InfoRow label={`${t.reference}:`} value={fallbackReference} />
        ) : null}
        {customerPoReference ? <InfoRow label={`${t.customerPo}:`} value={customerPoReference} /> : null}
        <InfoRow label={`${t.issueDate}:`} value={data.issueDate || "-"} />
        <InfoRow label={`${t.creditTerm}:`} value={`${data.creditTerms || 0} ${t.days}`} />
        <InfoRow label={`${t.dueDate}:`} value={data.dueDate || "-"} />
        <InfoRow label={`${t.seller}:`} value={sellerValue} />
      </div>
    </aside>
  );
};

const InfoRow = ({ label, value, children }: { label: string; value?: string; children?: ReactNode }) => (
  <div className="sales-doc-info-row">
    <span>{label}</span>
    {children ?? (
      <strong className="sales-doc-info-value" title={value}>
        {value}
      </strong>
    )}
  </div>
);

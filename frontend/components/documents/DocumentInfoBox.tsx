import type { SalesDocumentTemplateData } from "@/components/documents/types";
import { formatDocumentMoney } from "@/components/documents/document-utils";

const labels = {
  en: {
    documentNo: "Document No.",
    issueDate: "Date",
    creditTerm: "Credit",
    dueDate: "Due date",
    reference: "Reference / RE",
    referenceDocuments: "Reference documents",
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
    seller: "ผู้ขาย",
    days: "วัน",
  },
};

export const DocumentInfoBox = ({ data }: { data: SalesDocumentTemplateData }) => {
  const t = labels[data.language];
  const referenceRows = (data.referenceDocuments ?? []).map((reference) =>
    [
      reference.type || reference.kind,
      reference.number || reference.id,
      reference.party,
      reference.date,
      formatDocumentMoney(reference.total ?? reference.amount ?? 0, data.currency),
      reference.status,
    ]
      .filter(Boolean)
      .join(" · ")
  );
  const reference = referenceRows.length ? referenceRows.join("\n") : data.relatedDocument || data.reference || "-";
  const sellerValue = data.sellerUser?.name
    ? `${data.sellerUser.name}${data.sellerUser.email ? ` (${data.sellerUser.email})` : ""}`
    : data.documentContact?.trim() || data.seller.contactPerson || data.seller.name || "-";

  return (
    <aside className="sales-doc-info-stack sales-doc-avoid-break">
      <div className="sales-doc-info-box">
        <InfoRow label={`${t.documentNo}:`} value={data.documentNumber || "-"} />
        <InfoRow label={`${referenceRows.length ? t.referenceDocuments : t.reference}:`} value={reference} multiline={referenceRows.length > 0} />
        <InfoRow label={`${t.issueDate}:`} value={data.issueDate || "-"} />
        <InfoRow label={`${t.creditTerm}:`} value={`${data.creditTerms || 0} ${t.days}`} />
        <InfoRow label={`${t.dueDate}:`} value={data.dueDate || "-"} />
        <InfoRow label={`${t.seller}:`} value={sellerValue} />
      </div>
    </aside>
  );
};

const InfoRow = ({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) => (
  <div className="sales-doc-info-row">
    <span>{label}</span>
    <strong className={multiline ? "sales-doc-preline" : undefined}>{value}</strong>
  </div>
);

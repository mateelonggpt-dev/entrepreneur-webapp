import type { ReactNode } from "react";
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

const referenceKindLabels = {
  en: {
    quotation: "Quotation",
    delivery_note: "Delivery Note",
    invoice: "Invoice",
    tax_invoice: "Tax Invoice",
    receipt: "Receipt",
    billing_note: "Billing Note",
    combined_receipt: "Combined Receipt",
    credit_note: "Credit Note",
    debit_note: "Debit Note",
  },
  th: {
    quotation: "ใบเสนอราคา",
    delivery_note: "ใบส่งของ",
    invoice: "ใบแจ้งหนี้",
    tax_invoice: "ใบกำกับภาษี",
    receipt: "ใบเสร็จรับเงิน",
    billing_note: "ใบวางบิล",
    combined_receipt: "ใบเสร็จรวม",
    credit_note: "ใบลดหนี้",
    debit_note: "ใบเพิ่มหนี้",
  },
} as const;

const formatReferenceKind = (kind: string | undefined, language: "th" | "en") => {
  const normalized = String(kind ?? "").trim();
  if (!normalized) return "";
  const mapped = referenceKindLabels[language][normalized as keyof (typeof referenceKindLabels)["th"]];
  return mapped ?? normalized.replace(/_/g, " ");
};

export const DocumentInfoBox = ({ data }: { data: SalesDocumentTemplateData }) => {
  const t = labels[data.language];
  const referenceDocuments = data.referenceDocuments ?? [];
  const sellerValue = data.sellerUser?.name
    ? `${data.sellerUser.name}${data.sellerUser.email ? ` (${data.sellerUser.email})` : ""}`
    : data.documentContact?.trim() || data.seller.contactPerson || data.seller.name || "-";

  return (
    <aside className="sales-doc-info-stack sales-doc-avoid-break">
      <div className="sales-doc-info-box">
        <InfoRow label={`${t.documentNo}:`} value={data.documentNumber || "-"} />
        {referenceDocuments.length ? (
          <InfoRow label={`${t.referenceDocuments}:`}>
            <div className="sales-doc-reference-list">
              {referenceDocuments.map((reference, index) => {
                const kindLabel = formatReferenceKind(reference.type || reference.kind, data.language);
                const numberLabel = reference.number || reference.id;
                const amountValue = reference.total ?? reference.amount;
                const amountLabel =
                  typeof amountValue === "number" && amountValue > 0
                    ? formatDocumentMoney(amountValue, data.currency)
                    : "";
                const secondLine = [reference.party, reference.date].filter(Boolean).join(" · ");
                const thirdLine = [amountLabel, reference.status].filter(Boolean).join(" · ");

                return (
                  <div className="sales-doc-reference-item" key={`${reference.id || reference.number || index}-${index}`}>
                    <p className="sales-doc-reference-primary">{[kindLabel, numberLabel].filter(Boolean).join(" · ") || "-"}</p>
                    {secondLine ? <p>{secondLine}</p> : null}
                    {thirdLine ? <p>{thirdLine}</p> : null}
                  </div>
                );
              })}
            </div>
          </InfoRow>
        ) : (
          <InfoRow label={`${t.reference}:`} value={data.relatedDocument || data.reference || "-"} />
        )}
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

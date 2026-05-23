import type { SalesDocumentTemplateData } from "@/components/documents/types";
import { resolveDocumentAssetUrl } from "@/components/documents/document-utils";

const labels = {
  en: {
    receivedBy: "Received by",
    authorizedSignature: "Authorized Signature",
    approvedBy: "Approved By",
    receivedGoodsBy: "Received By",
    date: "Date ____ / ____ / ____",
  },
  th: {
    receivedBy: "ผู้รับเอกสาร",
    authorizedSignature: "ผู้มีอำนาจลงนาม",
    approvedBy: "ผู้อนุมัติ",
    receivedGoodsBy: "ผู้รับสินค้า",
    date: "วันที่ ____ / ____ / ____",
  },
} as const;

const signatureLabelByDocumentType = {
  invoice: "authorizedSignature",
  tax_invoice: "authorizedSignature",
  receipt: "authorizedSignature",
  cash_sale: "authorizedSignature",
  short_tax_invoice: "authorizedSignature",
  quotation: "authorizedSignature",
  delivery_note: "receivedGoodsBy",
  purchase_order: "approvedBy",
  receiving_inventory: "receivedGoodsBy",
  credit_note: "authorizedSignature",
  debit_note: "authorizedSignature",
  billing_note: "authorizedSignature",
  combined_billing_note: "authorizedSignature",
  combined_receipt: "authorizedSignature",
  deposit: "authorizedSignature",
} as const;

const getSignatureLabel = (data: SalesDocumentTemplateData) => {
  const t = labels[data.language];
  const documentTypes = data.documentTypes?.length ? data.documentTypes : ["invoice"];
  const labelKey =
    documentTypes
      .map((documentType) => signatureLabelByDocumentType[documentType as keyof typeof signatureLabelByDocumentType])
      .find(Boolean) ?? "authorizedSignature";
  return t[labelKey];
};

type SignatureSlot = "receiver" | "authorized";

const SIGNATURE_APPROVED_STATUSES = new Set(["approved", "paid", "partial", "partially_paid", "completed"]);

export const shouldRenderUploadedSignature = (
  documentTypes: string[] = [],
  status: string | undefined,
  signatureSlot: SignatureSlot
) => {
  if (signatureSlot !== "authorized") return false;
  const normalizedStatus = String(status ?? "").trim().toLowerCase();
  if (!normalizedStatus) return true;
  if (!SIGNATURE_APPROVED_STATUSES.has(normalizedStatus)) return false;
  const normalizedTypes = documentTypes.length ? documentTypes : ["invoice"];
  return normalizedTypes.some((documentType) =>
    Boolean(signatureLabelByDocumentType[documentType as keyof typeof signatureLabelByDocumentType])
  );
};

export const SignatureBlock = ({
  data,
}: {
  data: SalesDocumentTemplateData;
}) => {
  if (data.documentSettingsSnapshot?.showSignatureLine === false) {
    return null;
  }

  const t = labels[data.language];
  const companySignatureLabel = getSignatureLabel(data);
  const companySignatureUrl = shouldRenderUploadedSignature(data.documentTypes, data.status, "authorized")
    ? data.branding.signatureUrl
    : undefined;

  return (
    <section className="signature-section sales-doc-signature-section sales-doc-avoid-break">
      <div className="sales-doc-signatures">
        <SignatureBox label={t.receivedBy} dateLabel={t.date} />
        <SignatureBox label={companySignatureLabel} dateLabel={t.date} signatureUrl={companySignatureUrl} />
      </div>
    </section>
  );
};

const SignatureBox = ({ label, dateLabel, signatureUrl }: { label: string; dateLabel: string; signatureUrl?: string }) => (
  <div className="sales-doc-signature-box">
    {signatureUrl ? (
      <span className="sales-doc-signature-image-frame">
        <img className="sales-doc-signature-image" src={resolveDocumentAssetUrl(signatureUrl)} alt={label} />
      </span>
    ) : null}
    <div className="sales-doc-signature-line" />
    <p>{label}</p>
    <span>{dateLabel}</span>
  </div>
);

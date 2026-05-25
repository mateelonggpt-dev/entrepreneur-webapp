import type { SalesDocumentCopyKind, SalesDocumentTemplateData } from "@/components/documents/types";
import { getCopyLabel, resolveDocumentAssetUrl } from "@/components/documents/document-utils";

const sellerLabel = {
  en: "Seller",
  th: "ผู้ขาย",
};

const taxIdLabel = {
  en: "Tax ID",
  th: "เลขที่ภาษี",
};

const initialsFor = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) return "MA";
  const latin = trimmed.match(/[A-Za-z0-9]/g);
  if (latin?.length) return latin.slice(0, 2).join("").toUpperCase();
  return Array.from(trimmed).slice(0, 2).join("");
};

export const DocumentHeader = ({
  data,
  copyKind,
}: {
  data: SalesDocumentTemplateData;
  copyKind: SalesDocumentCopyKind;
}) => {
  const titleLength = Array.from(data.title).length;
  const titleClassName =
    titleLength > 34
      ? "sales-doc-title-extra-long"
      : titleLength > 26
        ? "sales-doc-title-long"
        : titleLength > 18
          ? "sales-doc-title-medium"
          : undefined;

  return (
    <header className="sales-doc-avoid-break sales-doc-header">
      <div className="sales-doc-seller-head">
        <div className="sales-doc-logo">
          {data.branding.logoUrl ? (
            <img src={resolveDocumentAssetUrl(data.branding.logoUrl)} alt="Company logo" />
          ) : (
            <span className="sales-doc-logo-fallback">{initialsFor(data.seller.name || "")}</span>
          )}
        </div>
        <div className="sales-doc-seller-copy">
          <p className="sales-doc-company-name">
            <span>{sellerLabel[data.language]}:</span> {data.seller.name || "-"}
          </p>
          <p>{data.seller.address || "-"}</p>
          <p>
            {taxIdLabel[data.language]}: {data.seller.taxId || "-"}
            {data.seller.branch ? ` (${data.seller.branch})` : ""}
          </p>
          <p>
            {data.seller.phone || "-"}
            {data.seller.email ? `  |  ${data.seller.email}` : ""}
            {data.seller.website ? `  |  ${data.seller.website}` : ""}
          </p>
        </div>
      </div>
      <div className="sales-doc-title-zone">
        <p className="sales-doc-copy-label">{getCopyLabel(copyKind, data.language)}</p>
        <h1 className={titleClassName}>{data.title}</h1>
        {data.titleEn ? <p className="sales-doc-title-en">{data.titleEn}</p> : null}
      </div>
    </header>
  );
};

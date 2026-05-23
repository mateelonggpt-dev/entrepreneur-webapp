import { Image } from "lucide-react";
import type { SalesDocumentCopyKind, SalesDocumentTemplateData } from "@/components/documents/types";
import { getCopyLabel, resolveDocumentAssetUrl } from "@/components/documents/document-utils";

const sellerLabel = {
  en: "Seller",
  th: "ผู้ขาย",
};

export const DocumentHeader = ({
  data,
  copyKind,
}: {
  data: SalesDocumentTemplateData;
  copyKind: SalesDocumentCopyKind;
}) => (
  <header className="sales-doc-avoid-break sales-doc-header">
    <div className="sales-doc-seller-head">
      <div className="sales-doc-logo">
        {data.branding.logoUrl ? (
          <img src={resolveDocumentAssetUrl(data.branding.logoUrl)} alt="Company logo" />
        ) : (
          <Image size={24} />
        )}
      </div>
      <div className="sales-doc-seller-copy">
        <p className="sales-doc-company-name">
          <span>{sellerLabel[data.language]} :</span> {data.seller.name || "-"}
        </p>
        <p>{data.seller.address || "-"}</p>
        <p>
          {data.language === "th" ? "เลขที่ภาษี" : "Tax ID"}: {data.seller.taxId || "-"}
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
      <h1>{data.title}</h1>
      {data.titleEn ? <p className="sales-doc-title-en">{data.titleEn}</p> : null}
    </div>
  </header>
);

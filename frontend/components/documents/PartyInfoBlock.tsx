import type { SalesDocumentLanguage, SalesDocumentParty } from "@/components/documents/types";

const labels = {
  en: {
    seller: "Seller",
    customer: "Customer",
    address: "Address",
    taxId: "Tax ID",
    attention: "Attention",
    tel: "Tel",
    email: "Email",
  },
  th: {
    seller: "ผู้ขาย",
    customer: "ลูกค้า",
    address: "ที่อยู่",
    taxId: "เลขที่ภาษี",
    attention: "เรียน",
    tel: "โทร",
    email: "อีเมล",
  },
};

export const PartyInfoBlock = ({
  party,
  language,
  type = "customer",
}: {
  party: SalesDocumentParty;
  language: SalesDocumentLanguage;
  type?: "seller" | "customer";
}) => {
  const t = labels[language];
  const title = type === "seller" ? t.seller : t.customer;
  const displayName = [party.code, party.name].filter(Boolean).join(" ") || "-";

  return (
    <section className="sales-doc-party sales-doc-avoid-break">
      <p className="sales-doc-section-label">{title}</p>
      <div className="sales-doc-party-grid">
        <p className="sales-doc-field-label">{title} :</p>
        <p className="sales-doc-strong">{displayName}</p>
        <p className="sales-doc-field-label">{t.address} :</p>
        <p className="sales-doc-preline">{party.address || "-"}</p>
        <p className="sales-doc-field-label">{t.taxId} :</p>
        <p>
          {party.taxId || "-"}
          {party.branch ? ` (${party.branch})` : ""}
        </p>
        <p className="sales-doc-field-label">{t.attention} :</p>
        <p>{party.contactPerson || "-"}</p>
        <p className="sales-doc-field-label">{t.tel} :</p>
        <p>{party.phone || party.mobile || "-"}</p>
        <p className="sales-doc-field-label">{t.email} :</p>
        <p>{party.email || "-"}</p>
      </div>
    </section>
  );
};

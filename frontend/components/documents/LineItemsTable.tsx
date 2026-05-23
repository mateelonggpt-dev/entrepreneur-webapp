import type { SalesDocumentTemplateData } from "@/components/documents/types";
import {
  formatDocumentNumber,
  formatDocumentPercent,
  formatDocumentQuantity,
  getLineDisplayTotal,
  validDocumentLines,
} from "@/components/documents/document-utils";

const labels = {
  en: {
    code: "Code",
    description: "Description",
    quantity: "Qty",
    unitPrice: "Unit price",
    discount: "Discount",
    vat: "VAT",
    wht: "WHT",
    beforeVat: "Total",
  },
  th: {
    code: "รหัส",
    description: "คำอธิบาย",
    quantity: "จำนวน",
    unitPrice: "ราคา",
    discount: "ส่วนลด",
    vat: "ภาษีมูลค่าเพิ่ม",
    wht: "หัก ณ ที่จ่าย",
    beforeVat: "รวม",
  },
};

export const LineItemsTable = ({ data }: { data: SalesDocumentTemplateData }) => {
  const t = labels[data.language];
  const lines = validDocumentLines(data.lines);
  const settings = data.documentSettingsSnapshot;
  const perLineDiscount = settings?.perLineDiscount ?? true;
  const vatEnabled = data.totals.vatAmount > 0 || data.lines.some((line) => Number(line.vatRate ?? line.tax) > 0);
  const perLineVat = Boolean(settings?.perLineVat) && vatEnabled;
  const perLineWithholding = Boolean(settings?.perLineWithholdingTax);
  const taxMode = settings?.taxMode ?? "exclusive";

  return (
    <section className="line-items-area sales-doc-table-zone">
      <table className="sales-doc-table">
        <colgroup>
          <col style={{ width: "13%" }} />
          <col style={{ width: "36%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "12%" }} />
          {perLineDiscount ? <col style={{ width: "8%" }} /> : null}
          {perLineVat ? <col style={{ width: "7%" }} /> : null}
          {perLineWithholding ? <col style={{ width: "7%" }} /> : null}
          <col style={{ width: "9%" }} />
        </colgroup>
        <thead>
          <tr>
            <th className="sales-doc-text-left">{t.code}</th>
            <th className="sales-doc-text-left">{t.description}</th>
            <th>{t.quantity}</th>
            <th>{t.unitPrice}</th>
            {perLineDiscount ? <th>{t.discount}</th> : null}
            {perLineVat ? <th>{t.vat}</th> : null}
            {perLineWithholding ? <th>{t.wht}</th> : null}
            <th>{t.beforeVat}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={line.id}>
              <td className="sales-doc-text-left">{line.displayCode || line.sku || "-"}</td>
              <td className="sales-doc-text-left">
                <p className="sales-doc-line-title">
                  {index + 1}. {line.desc}
                </p>
                {line.details ? <p className="sales-doc-line-detail">{line.details}</p> : null}
              </td>
              <td>{formatDocumentQuantity(line.qty)}</td>
              <td>{formatDocumentNumber(line.price)}</td>
              {perLineDiscount ? (
                <td>
                  {line.discountType === "amount"
                    ? formatDocumentNumber(line.discountValue ?? line.discountAmount ?? line.discount ?? 0)
                    : formatDocumentPercent(line.discountValue ?? line.discount ?? 0)}
                </td>
              ) : null}
              {perLineVat ? <td>{formatDocumentPercent(line.vatRate ?? line.tax ?? 0)}</td> : null}
              {perLineWithholding ? <td>{formatDocumentPercent(line.withholdingRate ?? 0)}</td> : null}
              <td>{formatDocumentNumber(getLineDisplayTotal(line, { taxMode, perLineDiscount }))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};

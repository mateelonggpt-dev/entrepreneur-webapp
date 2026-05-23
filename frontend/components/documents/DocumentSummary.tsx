import type { SalesDocumentTemplateData } from "@/components/documents/types";
import {
  formatDocumentMoney,
  formatDocumentPercent,
  groupVatTotalsByRate,
  groupWithholdingTotalsByRate,
} from "@/components/documents/document-utils";

const labels = {
  en: {
    summary: "Summary",
    subtotal: "Total",
    amountBeforeVat: "Amount before VAT",
    vatAmount: "VAT",
    grandTotal: "Grand Total",
    discount: "Discount",
    wht: "Withholding tax",
    totalWht: "Total withholding tax",
    amountAfterWht: "Amount after withholding",
    paid: "Amount already paid",
    remaining: "Payment Amount",
    deductDeposit: "Deduct deposit",
    deductPaidAmount: "Deduct paid amount",
    currentPaymentAmount: "Current payment amount",
    amountWords: "Amount in words",
    receiptAdjustment: "Receipt adjustment",
    paymentSchedule: "Payment schedule",
  },
  th: {
    summary: "สรุป",
    subtotal: "รวม",
    amountBeforeVat: "ยอดก่อนภาษีมูลค่าเพิ่ม",
    vatAmount: "ภาษีมูลค่าเพิ่ม",
    grandTotal: "ยอดรวมสุทธิ",
    discount: "ส่วนลด",
    wht: "หัก ณ ที่จ่าย",
    totalWht: "รวมภาษีหัก ณ ที่จ่าย",
    amountAfterWht: "ยอดชำระหลังหัก ณ ที่จ่าย",
    paid: "จำนวนเงินที่ชำระแล้ว",
    remaining: "จำนวนเงินที่ชำระ",
    amountWords: "จำนวนเงินตัวอักษร",
    receiptAdjustment: "รายการปรับลด",
  },
};

export const DocumentSummary = ({ data }: { data: SalesDocumentTemplateData }) => {
  const t = labels[data.language];
  const settings = data.documentSettingsSnapshot;
  const showWithholding = settings?.showWhtFooter ?? true;
  const perLineWithholding = Boolean(settings?.perLineWithholdingTax);
  const showReceiptAdjustments = Boolean(settings?.receiptAdjustmentFooter && data.documentTypes.includes("receipt"));
  const vatGroups = data.totals.vatGroups?.length
    ? data.totals.vatGroups
    : groupVatTotalsByRate(data.lines, {
        taxMode: settings?.taxMode ?? "exclusive",
        vatEnabled: data.totals.vatAmount > 0 || Boolean(settings?.perLineVat),
        perLineDiscount: settings?.perLineDiscount ?? true,
        includeZeroRate: true,
      });
  const withholdingGroups = data.totals.withholdingGroups?.length
    ? data.totals.withholdingGroups
    : groupWithholdingTotalsByRate(data.lines, {
        defaultWithholdingRate: data.withholdingRate,
        perLineWithholding,
        perLineDiscount: settings?.perLineDiscount ?? true,
      });
  const totalWithholding = data.totals.totalWithholdingTax ?? data.totals.withholdingAmount;
  const amountWords =
    data.language === "th"
      ? data.amountWordsThai || data.amountWordsEnglish
      : data.amountWordsEnglish || data.amountWordsThai;

  return (
    <div className="sales-doc-total-side">
      <p className="sales-doc-section-label">{t.summary}</p>
      <div className="sales-doc-total-details">
        <SummaryLine label={t.subtotal} value={formatDocumentMoney(data.totals.subtotalBeforeDiscount, data.currency)} />
        <SummaryLine
          label={`${t.discount} ${formatDocumentPercent(data.discountRate)}`}
          value={formatDocumentMoney(data.totals.totalDiscount, data.currency)}
        />
        <SummaryLine label={t.amountBeforeVat} value={formatDocumentMoney(data.totals.amountBeforeVat, data.currency)} />
        {vatGroups.length ? (
          vatGroups.map((group) => (
            <SummaryLine
              key={`vat-${group.rate}`}
              label={`${t.vatAmount} ${formatDocumentPercent(group.rate)}`}
              value={formatDocumentMoney(group.taxAmount, data.currency)}
            />
          ))
        ) : data.totals.vatAmount > 0 ? (
          <SummaryLine label={t.vatAmount} value={formatDocumentMoney(data.totals.vatAmount, data.currency)} />
        ) : null}
      </div>
      <div className="sales-doc-grand-total">
        <span>{t.grandTotal}</span>
        <strong>{formatDocumentMoney(data.totals.grandTotal, data.currency)}</strong>
      </div>
      <div className="sales-doc-total-details">
        {showWithholding || perLineWithholding ? (
          <>
            {withholdingGroups.map((group) => (
              <SummaryLine
                key={`wht-${group.rate}`}
                label={`${t.wht} ${formatDocumentPercent(group.rate)}`}
                value={formatDocumentMoney(group.taxAmount, data.currency)}
              />
            ))}
            {totalWithholding > 0 ? (
              <SummaryLine label={t.totalWht} value={formatDocumentMoney(totalWithholding, data.currency)} />
            ) : null}
          </>
        ) : null}
        {data.showAmountPaid ? (
          <SummaryLine label={t.paid} value={formatDocumentMoney(data.totals.amountPaid, data.currency)} />
        ) : null}
        {data.invoiceDeductions?.map((deduction) => (
          <SummaryLine
            key={deduction.id}
            label={`${
              deduction.type === "deposit"
                ? "deductDeposit" in t
                  ? t.deductDeposit
                  : "หักเงินมัดจำ"
                : "deductPaidAmount" in t
                  ? t.deductPaidAmount
                  : "หักยอดที่ชำระแล้ว"
            } ${deduction.label}`}
            value={`-${formatDocumentMoney(deduction.amount, data.currency)}`}
          />
        ))}
        {showReceiptAdjustments
          ? data.receiptAdjustments?.map((adjustment) => (
              <SummaryLine
                key={adjustment.id}
                label={adjustment.note || t.receiptAdjustment}
                value={formatDocumentMoney(adjustment.amount, data.currency)}
              />
            ))
          : null}
        <SummaryLine
          label={
            data.invoiceDeductions?.length
              ? "currentPaymentAmount" in t
                ? t.currentPaymentAmount
                : "ยอดชำระงวดนี้"
              : (showWithholding || perLineWithholding) && totalWithholding > 0
                ? t.amountAfterWht
                : t.remaining
          }
          value={formatDocumentMoney(data.totals.remainingDue, data.currency)}
          strong
        />
      </div>
      <div className="sales-doc-summary-words">
        <span>{t.amountWords}</span>
        <p>{amountWords || "-"}</p>
      </div>
      {data.invoicePaymentMode === "partial_payment" && data.invoicePaymentSchedule?.length ? (
        <div className="sales-doc-summary-words">
          <span>{"paymentSchedule" in t ? t.paymentSchedule : "ตารางชำระ"}</span>
          {data.invoicePaymentSchedule.map((row) => (
            <p key={row.id}>
              {row.label}: {formatDocumentMoney(row.amount, data.currency)}
              {row.dueDate ? ` (${row.dueDate})` : ""}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const SummaryLine = ({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) => (
  <div className={`sales-doc-summary-line ${strong ? "sales-doc-summary-strong" : ""}`}>
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

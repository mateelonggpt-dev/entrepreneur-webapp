import type { SalesDocumentTemplateData } from "@/components/documents/types";
import { formatPaymentDetailsForDocument } from "@/components/documents/document-utils";

const labels = {
  en: {
    payment: "Payment",
    notes: "Customer note",
  },
  th: {
    payment: "วิธีชำระเงิน",
    notes: "หมายเหตุถึงลูกค้า",
  },
};

export const PaymentBlock = ({ data }: { data: SalesDocumentTemplateData }) => {
  const t = labels[data.language];
  const paymentText =
    formatPaymentDetailsForDocument(data.paymentMethod, data.paymentDetails, data.selectedBankAccount) ||
    data.paymentMethod ||
    "-";
  const bankAccount = data.paymentMethod === "Bank Transfer" ? data.selectedBankAccount : null;

  return (
    <div className="sales-doc-payment-notes">
      <div className="sales-doc-payment-block">
        <p className="sales-doc-section-label">{t.payment}</p>
        {bankAccount ? (
          <div className="sales-doc-bank-card">
            <div className="sales-doc-bank-strip" />
            <div>
              <p className="sales-doc-bank-name">{bankAccount.bankName || data.paymentMethod}</p>
              <p>Account name: {bankAccount.accountName || "-"}</p>
              <p>Account number: {bankAccount.accountNumber || "-"}</p>
              {bankAccount.branch ? <p>Branch: {bankAccount.branch}</p> : null}
              {bankAccount.swiftCode ? <p>SWIFT: {bankAccount.swiftCode}</p> : null}
              {bankAccount.promptPayId ? <p>PromptPay: {bankAccount.promptPayId}</p> : null}
            </div>
          </div>
        ) : (
          <div className="sales-doc-payment-grid">
            <p>{paymentText}</p>
          </div>
        )}
      </div>
      <div className="sales-doc-note-block">
        <p className="sales-doc-section-label">{t.notes}</p>
        <p>{data.notes || "-"}</p>
      </div>
    </div>
  );
};

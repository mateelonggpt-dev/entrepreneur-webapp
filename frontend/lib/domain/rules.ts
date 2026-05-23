import type { DocumentStatus, DocumentType } from "@/lib/domain/enums";

export const requiresResetBeforeDelete = ({
  status,
  linkedCount = 0,
  attachmentCount = 0,
}: {
  status: DocumentStatus;
  linkedCount?: number;
  attachmentCount?: number;
}) =>
  !["draft", "void", "cancelled"].includes(status) || linkedCount > 0 || attachmentCount > 0;

export const isEditableAfterPayment = ({
  status,
  lockAfterPayment,
}: {
  status: DocumentStatus;
  lockAfterPayment: boolean;
}) => {
  if (!lockAfterPayment) {
    return !["void", "cancelled"].includes(status);
  }
  return !["paid", "partial", "approved", "void", "cancelled"].includes(status);
};

export const validateChequeLifecycle = ({
  chequeDate,
  paymentDate,
  depositDate,
  cutDate,
  clearedDate,
  allowFutureDate = true,
}: {
  chequeDate?: string;
  paymentDate?: string;
  depositDate?: string;
  cutDate?: string;
  clearedDate?: string;
  allowFutureDate?: boolean;
}) => {
  if (!chequeDate) {
    return { valid: false, message: "Cheque date is required." };
  }

  const cheque = new Date(chequeDate);
  if (Number.isNaN(cheque.getTime())) {
    return { valid: false, message: "Cheque date must be valid." };
  }

  if (paymentDate) {
    const payment = new Date(paymentDate);
    if (!Number.isNaN(payment.getTime()) && cheque < payment) {
      return { valid: false, message: "Cheque date cannot be before the payment date." };
    }
  }

  const compareDates = (
    value: string | undefined,
    label: string,
    comparisonLabel: string,
    comparisonDate: Date
  ) => {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return { valid: false, message: `${label} must be valid.` };
    }

    if (parsed < comparisonDate) {
      return {
        valid: false,
        message: `${label} cannot be before the ${comparisonLabel}.`,
      };
    }

    return null;
  };

  const cutValidation = compareDates(cutDate, "Cheque cut date", "cheque date", cheque);
  if (cutValidation) {
    return cutValidation;
  }

  const depositValidation = compareDates(depositDate, "Cheque deposit date", "cheque date", cheque);
  if (depositValidation) {
    return depositValidation;
  }

  const clearedValidation = compareDates(clearedDate, "Cheque cleared date", "cheque date", cheque);
  if (clearedValidation) {
    return clearedValidation;
  }

  if (!allowFutureDate && cheque > new Date()) {
    return { valid: false, message: "Cheque date cannot be in the future." };
  }

  return { valid: true, message: "" };
};

export const validateChequeDate = validateChequeLifecycle;

export const shouldDeductStock = ({
  documentType,
  status,
  stockDeductionTiming,
}: {
  documentType: DocumentType;
  status: DocumentStatus;
  stockDeductionTiming: "invoice" | "delivery";
}) => {
  if (["draft", "cancelled", "void"].includes(status)) {
    return false;
  }
  if (stockDeductionTiming === "delivery") {
    return documentType === "receive";
  }
  return documentType === "invoice";
};

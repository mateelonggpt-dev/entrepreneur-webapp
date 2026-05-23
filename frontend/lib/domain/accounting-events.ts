import type { AccountingEventType, DocumentType, TaxMode } from "@/lib/domain/enums";
import type { AccountingEvent } from "@/lib/domain/models";

export const buildAccountingEvent = ({
  sourceDocumentId,
  sourceType,
  eventType,
  eventDate,
  subtotal,
  taxAmount,
  totalAmount,
  linkedProjectId,
  linkedContactId,
  linkedAccountId,
  linkedDocumentIds,
  journalPayload,
  taxMode = "exclusive" as TaxMode,
  withholdingRate = 0,
  withholdingAmount = 0,
}: {
  sourceDocumentId: string;
  sourceType: DocumentType;
  eventType: AccountingEventType;
  eventDate: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  linkedProjectId?: string;
  linkedContactId?: string;
  linkedAccountId?: string;
  linkedDocumentIds?: string[];
  journalPayload?: Array<Record<string, unknown>>;
  taxMode?: TaxMode;
  withholdingRate?: number;
  withholdingAmount?: number;
}): AccountingEvent => ({
  sourceDocumentId,
  sourceType,
  eventType,
  eventDate,
  amountSummary: {
    subtotal,
    discountAmount: 0,
    taxAmount,
    withholdingAmount,
    totalWithholdingTax: withholdingAmount,
    grandTotal: subtotal + taxAmount,
    remainingDue: totalAmount,
    total: totalAmount,
    vatGroups: taxAmount > 0 ? [{ rate: subtotal > 0 ? (taxAmount / subtotal) * 100 : 0, taxableBase: subtotal, taxAmount }] : [],
    withholdingGroups: withholdingAmount > 0 ? [{ rate: withholdingRate, taxableBase: subtotal, taxAmount: withholdingAmount }] : [],
  },
  taxSummary: {
    mode: taxMode,
    rate: subtotal > 0 ? (taxAmount / subtotal) * 100 : 0,
    taxableBase: subtotal,
    taxAmount,
    withholdingRate,
    withholdingAmount,
  },
  linkedProjectId,
  linkedContactId,
  linkedAccountId,
  linkedDocumentIds,
  journalPayload,
});

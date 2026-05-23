export const buildLinkedDocumentGraph = (
  records: Array<{
    id: string;
    relatedInvoice?: string;
    relatedDocument?: string;
    relatedBilling?: string;
    sourceDocumentId?: string;
    sourceBillingId?: string;
    parentQuotationId?: string;
    installmentSourceId?: string;
    linkedDocumentIds?: string[];
    sourceInvoiceIds?: string[];
    attachments?: string[];
  }>
) => {
  const graph = new Map<string, Set<string>>();

  const link = (from: string, to?: string) => {
    if (!to) {
      return;
    }
    if (!graph.has(from)) {
      graph.set(from, new Set());
    }
    graph.get(from)?.add(to);
  };

  for (const record of records) {
    link(record.id, record.relatedInvoice);
    link(record.id, record.relatedDocument);
    link(record.id, record.relatedBilling);
    link(record.id, record.sourceDocumentId);
    link(record.id, record.sourceBillingId);
    link(record.id, record.parentQuotationId);
    link(record.id, record.installmentSourceId);
    for (const linkedDocumentId of record.linkedDocumentIds ?? []) {
      link(record.id, linkedDocumentId);
    }
    for (const sourceInvoiceId of record.sourceInvoiceIds ?? []) {
      link(record.id, sourceInvoiceId);
    }
    for (const attachmentId of record.attachments ?? []) {
      link(record.id, attachmentId);
    }
  }

  return Object.fromEntries(
    Array.from(graph.entries()).map(([key, values]) => [key, Array.from(values).sort()])
  );
};

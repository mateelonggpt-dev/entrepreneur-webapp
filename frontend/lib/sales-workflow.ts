import type { AppData, DocumentKind, DocumentSummary, Invoice } from "@/lib/types";
import { invoiceToSalesSummary } from "@/lib/document-sections";

export type SalesWorkflowStepId = "quotation" | "billing_note" | "invoice" | "delivery_note" | "receipt";
export type SalesWorkflowStatus = "complete" | "partial" | "not_started";

export interface SalesWorkflowStep {
  id: SalesWorkflowStepId;
  status: SalesWorkflowStatus;
  documents: DocumentSummary[];
  amount: number;
  targetAmount: number;
}

export interface SalesWorkflow {
  source: DocumentSummary;
  chainDocuments: DocumentSummary[];
  steps: SalesWorkflowStep[];
  baseAmount: number;
}

export const SALES_WORKFLOW_STEPS: SalesWorkflowStepId[] = [
  "quotation",
  "invoice",
  "delivery_note",
  "receipt",
];

export const SALES_WORKFLOW_LABELS: Record<SalesWorkflowStepId, { en: string; th: string }> = {
  quotation: { en: "Quotation", th: "ใบเสนอราคา" },
  billing_note: { en: "Billing Note / Invoice", th: "ใบวางบิล/ใบแจ้งหนี้" },
  invoice: { en: "Billing Note / Invoice", th: "ใบวางบิล/ใบแจ้งหนี้" },
  delivery_note: { en: "Delivery Note", th: "ใบส่งของ" },
  receipt: { en: "Receipt", th: "ใบเสร็จรับเงิน" },
};

export const getWorkflowStepLabel = (step: SalesWorkflowStepId, language: "en" | "th") =>
  SALES_WORKFLOW_LABELS[step][language];

export const collectSalesWorkflowDocuments = (data: AppData): DocumentSummary[] => [
  ...data.quotations,
  ...data.invoices.map(invoiceToSalesSummary),
  ...data.receipts,
  ...data.billings,
];

const asInvoiceSummary = (document: DocumentSummary | Invoice): DocumentSummary =>
  "customer" in document ? invoiceToSalesSummary(document) : document;

const inferDocumentTypes = (document: DocumentSummary) => {
  const types = document.documentTypes?.length ? document.documentTypes : [document.kind === "billing" ? "billing_note" : document.kind];
  return Array.from(new Set(types.map((type) => (type === "tax_invoice" ? "invoice" : type))));
};

export const documentWorkflowSteps = (document: DocumentSummary): SalesWorkflowStepId[] =>
  inferDocumentTypes(document).flatMap((type) => {
    if (type === "quotation") return ["quotation" as const];
    if (type === "billing_note") return ["invoice" as const];
    if (type === "invoice") return ["invoice" as const];
    if (type === "delivery_note") return ["delivery_note" as const];
    if (type === "receipt") return ["receipt" as const];
    return [];
  });

const relationIds = (document: DocumentSummary) =>
  new Set(
    [
      document.sourceDocumentId,
      document.sourceDocumentNumber,
      document.sourceBillingId,
      document.parentQuotationId,
      document.depositSourceDocumentId,
      ...(document.sourceInvoiceIds ?? []),
      ...(document.relatedDocumentIds ?? []),
      ...(document.linkedDocumentIds ?? []),
      ...(document.referenceDocuments?.map((reference) => reference.id) ?? []),
    ].filter(Boolean) as string[]
  );

const areRelated = (left: DocumentSummary, right: DocumentSummary, graph?: Record<string, string[]>) => {
  if (left.id === right.id) return true;
  if (relationIds(left).has(right.id) || relationIds(right).has(left.id)) return true;
  return Boolean(graph?.[left.id]?.includes(right.id) || graph?.[right.id]?.includes(left.id));
};

const uniqueById = (documents: DocumentSummary[]) =>
  Array.from(new Map(documents.map((document) => [document.id, document])).values());

const collectChain = (source: DocumentSummary, allDocuments: DocumentSummary[], graph?: Record<string, string[]>) => {
  const byId = new Map(allDocuments.map((document) => [document.id, document]));
  const visited = new Set<string>();
  const queue = [source.id];

  while (queue.length) {
    const id = queue.shift();
    if (!id || visited.has(id)) continue;
    visited.add(id);
    const current = byId.get(id);
    if (!current) continue;

    const nextIds = new Set<string>([
      ...relationIds(current),
      ...(graph?.[current.id] ?? []),
    ]);
    allDocuments.forEach((candidate) => {
      if (areRelated(current, candidate, graph)) nextIds.add(candidate.id);
    });
    nextIds.forEach((nextId) => {
      if (byId.has(nextId) && !visited.has(nextId)) queue.push(nextId);
    });
  }

  return uniqueById(allDocuments.filter((document) => visited.has(document.id) || areRelated(source, document, graph)));
};

const sumAmount = (documents: DocumentSummary[]) =>
  documents.reduce((sum, document) => sum + (Number(document.depositAmount ?? document.amount) || 0), 0);

const paidAmount = (documents: DocumentSummary[]) =>
  documents.reduce((sum, document) => {
    if (document.kind === "receipt") return sum + (Number(document.amount) || 0);
    return sum + (Number(document.paymentSummary?.paid ?? (document.status === "paid" ? document.amount : 0)) || 0);
  }, 0);

const stepStatus = ({
  step,
  documents,
  baseAmount,
  amount,
}: {
  step: SalesWorkflowStepId;
  documents: DocumentSummary[];
  baseAmount: number;
  amount: number;
}): SalesWorkflowStatus => {
  if (!documents.length) return "not_started";
  if (step === "invoice") {
    const hasPartialMode = documents.some((document) =>
      ["deposit", "partial_payment"].includes(document.invoicePaymentMode ?? "") || document.status === "partial"
    );
    if (hasPartialMode || (baseAmount > 0 && amount > 0 && amount < baseAmount - 0.01)) return "partial";
    return "complete";
  }
  if (step === "receipt") {
    if (baseAmount > 0 && amount > 0 && amount < baseAmount - 0.01) return "partial";
    return "complete";
  }
  return "complete";
};

export const buildSalesWorkflow = (
  sourceInput: DocumentSummary | Invoice,
  allInputs: Array<DocumentSummary | Invoice>,
  graph?: Record<string, string[]>
): SalesWorkflow => {
  const source = asInvoiceSummary(sourceInput);
  const allDocuments = uniqueById(allInputs.map(asInvoiceSummary));
  const chainDocuments = collectChain(source, allDocuments, graph);
  const quotationTotal = chainDocuments.find((document) => documentWorkflowSteps(document).includes("quotation"))?.amount ?? 0;
  const invoiceTotal = sumAmount(chainDocuments.filter((document) => documentWorkflowSteps(document).includes("invoice")));
  const baseAmount = Math.max(quotationTotal, invoiceTotal, source.amount, 0);

  const steps = SALES_WORKFLOW_STEPS.map((step) => {
    const stepDocuments = chainDocuments.filter((document) => documentWorkflowSteps(document).includes(step));
    const amount = step === "receipt" ? paidAmount(stepDocuments) : sumAmount(stepDocuments);
    return {
      id: step,
      documents: stepDocuments,
      amount,
      targetAmount: baseAmount,
      status: stepStatus({ step, documents: stepDocuments, baseAmount, amount }),
    };
  });

  return { source, chainDocuments, steps, baseAmount };
};

export const workflowStepToDocumentType = (step: SalesWorkflowStepId) =>
  step === "billing_note" ? "invoice" : step;

export const workflowStepSourceKind = (document: DocumentSummary): DocumentKind =>
  document.kind === "billing" ? "billing" : document.kind;

export interface SalesDocumentPack {
  id: string;
  main: DocumentSummary;
  documents: DocumentSummary[];
  workflow: SalesWorkflow;
}

export const buildSalesDocumentPacks = (
  visibleDocuments: DocumentSummary[],
  allDocuments: DocumentSummary[],
  graph?: Record<string, string[]>
): SalesDocumentPack[] => {
  const seenPackIds = new Set<string>();
  return visibleDocuments
    .map((document) => {
      const workflow = buildSalesWorkflow(document, allDocuments, graph);
      const documents = [...workflow.chainDocuments].sort((left, right) => right.date.localeCompare(left.date));
      const packId = documents.map((item) => item.id).sort().join("|") || document.id;
      return {
        id: packId,
        main: documents[0] ?? document,
        documents,
        workflow,
      };
    })
    .filter((pack) => {
      if (seenPackIds.has(pack.id)) return false;
      seenPackIds.add(pack.id);
      return true;
    });
};

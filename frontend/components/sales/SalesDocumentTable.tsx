import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { SalesWorkflowProgress } from "@/components/sales/SalesWorkflowProgress";
import { fmtTHB } from "@/lib/demo-data";
import type { DocumentSummary } from "@/lib/types";
import {
  buildSalesDocumentPacks,
  buildSalesWorkflow,
  documentWorkflowSteps,
  getWorkflowStepLabel,
  type SalesDocumentPack,
  type SalesWorkflow,
  type SalesWorkflowStepId,
} from "@/lib/sales-workflow";
import { cn } from "@/lib/utils";
import { ChevronDown, Paperclip } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  documents: DocumentSummary[];
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  onRowClick: (summary: DocumentSummary) => void;
  allDocuments?: DocumentSummary[];
  linkedDocumentGraph?: Record<string, string[]>;
  groupPacks?: boolean;
  onWorkflowCreateStep?: (source: DocumentSummary, step: SalesWorkflowStepId) => void;
  onAttachmentClick?: (summary: DocumentSummary) => void;
  renderRowActions: (summary: DocumentSummary) => ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: { label: string; onClick?: () => void };
}

export const SalesDocumentTable = ({
  documents,
  selectedIds,
  onSelectedIdsChange,
  onRowClick,
  allDocuments,
  linkedDocumentGraph,
  groupPacks = true,
  onWorkflowCreateStep,
  onAttachmentClick,
  renderRowActions,
  emptyTitle,
  emptyDescription,
  emptyAction,
}: Props) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language?.startsWith("th") ? "th" : "en";
  const [expandedPacks, setExpandedPacks] = useState<Record<string, boolean>>({});
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" } | null>(null);
  const allSelected = documents.length > 0 && selectedIds.length === documents.length;
  const workflowDocuments = allDocuments?.length ? allDocuments : documents;
  const grouped = groupPacks && sort?.key !== "type";
  const rows = useMemo(() => {
    const packRows = grouped
      ? buildSalesDocumentPacks(documents, workflowDocuments, linkedDocumentGraph)
      : documents.map((document): SalesDocumentPack => ({
          id: document.id,
          main: document,
          documents: [document],
          workflow: buildSalesWorkflow(document, workflowDocuments, linkedDocumentGraph),
        }));
    return sortRows(packRows, sort);
  }, [documents, grouped, linkedDocumentGraph, sort, workflowDocuments]);

  const toggleSort = (key: SortKey) => {
    setSort((current) => ({
      key,
      direction: current?.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const toggleSelection = (id: string) => {
    onSelectedIdsChange(
      selectedIds.includes(id)
        ? selectedIds.filter((selectedId) => selectedId !== id)
        : [...selectedIds, id]
    );
  };

  const toggleAll = (checked: boolean) => {
    onSelectedIdsChange(checked ? documents.map((document) => document.id) : []);
  };

  return (
    <Card className="card-premium overflow-hidden">
      {documents.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                <th className="w-10 px-4 py-3">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(value) => toggleAll(Boolean(value))}
                  />
                </th>
                <SortableHeader label={t("salesDocumentTable.date", { defaultValue: "Date" })} sortKey="date" activeSort={sort} onToggle={toggleSort} />
                <SortableHeader label={t("salesDocumentTable.document", { defaultValue: "Document" })} sortKey="document" activeSort={sort} onToggle={toggleSort} />
                <SortableHeader label="Type" sortKey="type" activeSort={sort} onToggle={toggleSort} />
                <SortableHeader label={t("salesDocumentTable.party", { defaultValue: "Party" })} sortKey="party" activeSort={sort} onToggle={toggleSort} />
                <SortableHeader label={t("salesDocumentTable.amount", { defaultValue: "Amount" })} sortKey="amount" activeSort={sort} onToggle={toggleSort} align="right" />
                <SortableHeader label="Paid" sortKey="paid" activeSort={sort} onToggle={toggleSort} align="right" />
                <SortableHeader label="Remaining" sortKey="remaining" activeSort={sort} onToggle={toggleSort} align="right" />
                <SortableHeader label={t("salesDocumentTable.status", { defaultValue: "Status" })} sortKey="status" activeSort={sort} onToggle={toggleSort} />
                <SortableHeader label="Created by" sortKey="createdBy" activeSort={sort} onToggle={toggleSort} />
                <th className="w-10 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((pack) => {
                const document = pack.main;
                const attachmentCount = document.attachmentCount ?? document.attachments?.length ?? 0;
                const documentTypes = document.documentTypes?.length
                  ? document.documentTypes.join(" / ").replace(/_/g, " ")
                  : (document.documentVariant ?? document.kind).replace(/_/g, " ");
                const paidAmount = document.paymentSummary?.paid ?? (document.status === "paid" ? document.amount : 0);
                const remainingAmount = document.paymentSummary?.remaining ?? Math.max(document.amount - paidAmount, 0);
                const expanded = Boolean(expandedPacks[pack.id]);
                return (
                  <tr
                    key={pack.id}
                    onClick={() => onRowClick(document)}
                    className="cursor-pointer border-t border-border/50 transition hover:bg-secondary/40"
                  >
                    <td
                      className="px-4 py-3.5"
                      onClick={(event) => {
                        event.stopPropagation();
                      }}
                    >
                      <Checkbox
                        checked={selectedIds.includes(document.id)}
                        onCheckedChange={() => toggleSelection(document.id)}
                      />
                    </td>
                    <td className="px-3 py-3.5 text-muted-foreground">{document.date}</td>
                    <td className="min-w-[340px] px-3 py-3.5 align-top" onClick={(event) => event.stopPropagation()}>
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          className="mt-0.5 rounded p-1 text-muted-foreground hover:bg-secondary"
                          onClick={() => setExpandedPacks((current) => ({ ...current, [pack.id]: !current[pack.id] }))}
                          aria-label={expanded ? "Collapse pack" : "Expand pack"}
                        >
                          <ChevronDown className={cn("h-4 w-4 transition", expanded && "rotate-180")} />
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <button type="button" className="font-mono text-xs font-semibold text-primary hover:underline" onClick={() => onRowClick(document)}>
                              {document.id}
                            </button>
                            <AttachmentBadge count={attachmentCount} onClick={attachmentCount ? () => onAttachmentClick?.(document) : undefined} />
                            {pack.documents.length > 1 ? (
                              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                {pack.documents.length} {language === "th" ? "เอกสาร" : "docs"}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-2">
                            <SalesWorkflowProgress
                              workflow={pack.workflow}
                              language={language}
                              onOpenDocument={onRowClick}
                              onCreateStep={(step, source) => onWorkflowCreateStep?.(source, step)}
                            />
                          </div>
                          {expanded ? (
                            <PackDetails
                              pack={pack}
                              language={language}
                              onOpenDocument={onRowClick}
                              onAttachmentClick={onAttachmentClick}
                              renderRowActions={renderRowActions}
                            />
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="rounded-md bg-secondary px-2 py-0.5 text-xs capitalize">
                        {documentTypes}
                      </span>
                      {document.documentTitle ? (
                        <p className="mt-1 max-w-[160px] truncate text-[11px] text-muted-foreground">{document.documentTitle}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3.5 font-medium">{document.party}</td>
                    <td className="px-3 py-3.5 text-right font-semibold tabular-nums">{fmtTHB(document.amount)}</td>
                    <td className="px-3 py-3.5 text-right font-semibold tabular-nums text-emerald-700">{fmtTHB(paidAmount)}</td>
                    <td className="px-3 py-3.5 text-right font-semibold tabular-nums">{fmtTHB(remainingAmount)}</td>
                    <td className="px-3 py-3.5">
                      <StatusBadge status={document.status} />
                    </td>
                    <td className="px-3 py-3.5 text-xs text-muted-foreground">{createdByValue(document)}</td>
                    <td
                      className="px-3 py-3.5"
                      onClick={(event) => {
                        event.stopPropagation();
                      }}
                    >
                      {renderRowActions(document)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      )}
    </Card>
  );
};

type SortKey = "date" | "document" | "type" | "party" | "amount" | "paid" | "remaining" | "status" | "createdBy";

const SortableHeader = ({
  label,
  sortKey,
  activeSort,
  onToggle,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  activeSort: { key: SortKey; direction: "asc" | "desc" } | null;
  onToggle: (key: SortKey) => void;
  align?: "left" | "right";
}) => (
  <th className={cn("px-3 py-3 font-semibold", align === "right" ? "text-right" : "text-left")}>
    <button type="button" className="inline-flex items-center gap-1" onDoubleClick={() => onToggle(sortKey)}>
      {label}
      {activeSort?.key === sortKey ? <span>{activeSort.direction === "asc" ? "↑" : "↓"}</span> : null}
    </button>
  </th>
);

const sortRows = (rows: SalesDocumentPack[], sort: { key: SortKey; direction: "asc" | "desc" } | null) => {
  if (!sort) return rows;
  const multiplier = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    const leftValue = sortValue(left.main, sort.key);
    const rightValue = sortValue(right.main, sort.key);
    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return (leftValue - rightValue) * multiplier;
    }
    return String(leftValue).localeCompare(String(rightValue)) * multiplier;
  });
};

const sortValue = (document: DocumentSummary, key: SortKey) => {
  if (key === "date") return document.date;
  if (key === "document") return document.id;
  if (key === "type") return document.documentTypes?.join(" ") ?? document.kind;
  if (key === "party") return document.party;
  if (key === "amount") return document.amount;
  if (key === "paid") return document.paymentSummary?.paid ?? (document.status === "paid" ? document.amount : 0);
  if (key === "remaining") return document.paymentSummary?.remaining ?? Math.max(document.amount - (document.paymentSummary?.paid ?? 0), 0);
  if (key === "createdBy") return createdByValue(document);
  return document.status;
};

const createdByValue = (document: DocumentSummary) =>
  document.createdBy || document.sellerUserInfo?.name || document.salesperson || "Matter Acc.";

const AttachmentBadge = ({ count, onClick }: { count: number; onClick?: () => void }) =>
  count > 0 ? (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 hover:bg-sky-100"
      title={`${count} attached file(s)`}
    >
      <Paperclip className="h-3 w-3" />
      {count}
    </button>
  ) : null;

const PackDetails = ({
  pack,
  language,
  onOpenDocument,
  onAttachmentClick,
  renderRowActions,
}: {
  pack: SalesDocumentPack;
  language: "en" | "th";
  onOpenDocument: (document: DocumentSummary) => void;
  onAttachmentClick?: (document: DocumentSummary) => void;
  renderRowActions: (summary: DocumentSummary) => ReactNode;
}) => (
  <div className="mt-3 rounded-lg border border-border/70 bg-secondary/20">
    {pack.documents.map((document) => {
      const attachmentCount = document.attachmentCount ?? document.attachments?.length ?? 0;
      const steps = documentWorkflowSteps(document).map((step) => getWorkflowStepLabel(step, language)).join(" / ");
      const documentTypes = document.documentTypes?.length ? document.documentTypes.join(" / ").replace(/_/g, " ") : document.kind.replace(/_/g, " ");
      return (
        <div key={document.id} className="grid gap-2 border-t border-border/50 px-3 py-2 text-xs first:border-t-0 md:grid-cols-[1fr_auto_auto] md:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="font-mono font-semibold text-primary hover:underline" onClick={() => onOpenDocument(document)}>
                {document.id}
              </button>
              <AttachmentBadge count={attachmentCount} onClick={attachmentCount ? () => onAttachmentClick?.(document) : undefined} />
              {(document.documentTypes?.length ?? 0) > 1 ? (
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  {language === "th" ? "เอกสารรวม" : "Combined document"}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-muted-foreground">
              {documentTypes} · {document.date} · {steps || "-"}
            </p>
          </div>
          <div className="text-right font-semibold tabular-nums">{fmtTHB(document.amount)}</div>
          <div className="flex items-center justify-end gap-2">
            <StatusBadge status={document.status} />
            {renderRowActions(document)}
          </div>
        </div>
      );
    })}
  </div>
);

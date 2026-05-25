import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { DocumentSummary } from "@/lib/types";
import {
  getWorkflowStepLabel,
  type SalesWorkflow,
  type SalesWorkflowStep,
  type SalesWorkflowStepId,
  type SalesWorkflowStatus,
} from "@/lib/sales-workflow";
import {
  ClipboardList,
  FileCheck2,
  FileText,
  ReceiptText,
  Truck,
} from "lucide-react";
import { useState } from "react";

const stepIcons = {
  quotation: ClipboardList,
  billing_note: FileText,
  invoice: FileCheck2,
  delivery_note: Truck,
  receipt: ReceiptText,
} satisfies Record<SalesWorkflowStepId, typeof FileText>;

interface SalesWorkflowProgressProps {
  workflow: SalesWorkflow;
  language: "en" | "th";
  onOpenDocument: (document: DocumentSummary) => void;
  onCreateStep: (step: SalesWorkflowStepId, source: DocumentSummary) => void;
}

export const SalesWorkflowProgress = ({
  workflow,
  language,
  onOpenDocument,
  onCreateStep,
}: SalesWorkflowProgressProps) => {
  const [open, setOpen] = useState(false);
  const completeCount = workflow.steps.filter((step) => step.status === "complete").length;
  const hasPartial = workflow.steps.some((step) => step.status === "partial");
  const nextStep = workflow.steps.find((step) => step.status !== "complete");
  const source = workflow.source;
  const stepTotal = workflow.steps.length;
  const summaryLabel =
    language === "th"
      ? `${completeCount}/${stepTotal} ขั้นตอน${hasPartial ? " มีบางส่วน" : ""}`
      : `${completeCount}/${stepTotal} steps${hasPartial ? " with partial" : ""}`;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-auto min-w-[180px] justify-start gap-2 rounded-lg px-2 py-1.5 text-left"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center gap-1">
            {workflow.steps.map((step) => (
              <span key={step.id} className={cn("h-2.5 w-2.5 rounded-full", statusDotClass(step.status))} />
            ))}
          </div>
          <span className="text-xs font-semibold">{summaryLabel}</span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent onClick={(event) => event.stopPropagation()}>
        <div className="mt-2 min-w-[260px] rounded-lg border border-border bg-background p-3 shadow-sm">
          <div className="space-y-0">
            {workflow.steps.map((step, index) => (
              <WorkflowStepRow
                key={step.id}
                step={step}
                language={language}
                last={index === workflow.steps.length - 1}
                onOpenDocument={onOpenDocument}
                onCreate={() => onCreateStep(step.id, source)}
              />
            ))}
          </div>
          {nextStep ? (
            <p className="mt-2 border-t pt-2 text-[11px] text-muted-foreground">
              {language === "th" ? "ขั้นตอนถัดไป" : "Next step"}: {getWorkflowStepLabel(nextStep.id, language)}
            </p>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const WorkflowStepRow = ({
  step,
  language,
  last,
  onOpenDocument,
  onCreate,
}: {
  step: SalesWorkflowStep;
  language: "en" | "th";
  last: boolean;
  onOpenDocument: (document: DocumentSummary) => void;
  onCreate: () => void;
}) => {
  const Icon = stepIcons[step.id];
  const combinedLabel = language === "th" ? "เอกสารรวม" : "Combined document";
  const emptyLabel = language === "th" ? "สร้างเอกสาร" : "Create document";
  const draftLabel = language === "th" ? "แก้ไขแบบร่างต่อ" : "Continue draft";
  const draftDocuments = step.documents.filter((document) => String(document.status).toLowerCase() === "draft");
  const canCreateRemaining = step.status !== "complete" && draftDocuments.length === 0;

  return (
    <div className="relative grid grid-cols-[28px_1fr] gap-2 pb-3 last:pb-0">
      {!last ? <span className="absolute left-[13px] top-7 h-[calc(100%-1.2rem)] w-px bg-border" /> : null}
      <button
        type="button"
        className={cn(
          "relative z-10 flex h-7 w-7 items-center justify-center rounded-full border bg-background",
          statusRingClass(step.status)
        )}
        onClick={step.documents.length ? () => onOpenDocument(step.documents[0]) : onCreate}
        title={getWorkflowStepLabel(step.id, language)}
      >
        <Icon className="h-3.5 w-3.5" />
      </button>
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold">{getWorkflowStepLabel(step.id, language)}</p>
          <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", statusPillClass(step.status))}>
            {statusText(step.status, language)}
          </span>
        </div>
        {step.documents.length ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {step.documents.map((document) => {
              const isCombined = (document.documentTypes?.length ?? 0) > 1;
              const isDraft = String(document.status).toLowerCase() === "draft";
              return (
                <button
                  type="button"
                  key={`${step.id}-${document.id}`}
                  onClick={() => onOpenDocument(document)}
                  className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary hover:bg-primary/10"
                  title={isCombined ? combinedLabel : undefined}
                >
                  {document.id}
                  {isDraft ? <span className="ml-1 font-sans text-[10px] text-amber-700">({draftLabel})</span> : null}
                  {isCombined ? <span className="ml-1 font-sans text-[10px] text-muted-foreground">({combinedLabel})</span> : null}
                </button>
              );
            })}
            {canCreateRemaining ? (
              <button
                type="button"
                onClick={onCreate}
                className="rounded-md border border-dashed border-primary/40 px-1.5 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/10"
              >
                {emptyLabel}
              </button>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            onClick={onCreate}
            className="mt-1 text-[11px] font-semibold text-primary hover:underline"
          >
            {emptyLabel}
          </button>
        )}
      </div>
    </div>
  );
};

const statusText = (status: SalesWorkflowStatus, language: "en" | "th") => {
  if (status === "complete") return language === "th" ? "เสร็จแล้ว" : "Complete";
  if (status === "partial") return language === "th" ? "บางส่วน" : "Partial";
  return language === "th" ? "ยังไม่เริ่ม" : "Not started";
};

const statusDotClass = (status: SalesWorkflowStatus) => {
  if (status === "complete") return "bg-emerald-500";
  if (status === "partial") return "bg-gradient-to-r from-emerald-500 from-50% to-slate-300 to-50%";
  return "bg-slate-300";
};

const statusRingClass = (status: SalesWorkflowStatus) => {
  if (status === "complete") return "border-emerald-500 text-emerald-700";
  if (status === "partial") return "border-emerald-400 text-emerald-700 ring-2 ring-slate-200";
  return "border-slate-300 text-slate-500";
};

const statusPillClass = (status: SalesWorkflowStatus) => {
  if (status === "complete") return "bg-emerald-50 text-emerald-700";
  if (status === "partial") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-600";
};

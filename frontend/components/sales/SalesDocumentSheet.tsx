import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { EvidenceAttachmentModal } from "@/components/modals/DomainModals";
import { downloadAttachment, downloadDocumentPdf, fetchAttachments } from "@/lib/api";
import { fmtTHB } from "@/lib/demo-data";
import {
  buildDefaultTimeline,
  collectLinkedSummaries,
  isSalesDocumentEditable,
  salesDeleteRequiresReset,
} from "@/lib/sales";
import type { AppData, Attachment, DocumentKind, SalesDocumentRecord } from "@/lib/types";
import {
  Activity,
  Download,
  FileText,
  Paperclip,
  PencilLine,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  kind: DocumentKind;
  document: SalesDocumentRecord | null;
  data: AppData;
  onEdit?: (document: SalesDocumentRecord) => void;
  actions?: React.ReactNode;
}

export const SalesDocumentSheet = ({
  open,
  onOpenChange,
  kind,
  document,
  data,
  onEdit,
  actions,
}: Props) => {
  const { t } = useTranslation();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const formatKindLabel = (value: string) =>
    t(`salesDocumentSheet.kind.${value}`, {
      defaultValue: value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
    });
  const formatVariant = (variant: string) =>
    t(`documentVariant.${variant.replace(/-/g, "_")}`, {
      defaultValue: variant.replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
    });

  useEffect(() => {
    if (!document?.id || !open) {
      return;
    }

    void fetchAttachments(kind, document.id)
      .then(setAttachments)
      .catch(() => setAttachments([]));
  }, [document?.id, kind, open]);

  const linkedSummaries = useMemo(
    () => (document ? collectLinkedSummaries(data, document.id) : []),
    [data, document]
  );

  const timeline = useMemo(
    () =>
      document
        ? buildDefaultTimeline({
            document,
            linkedIds: linkedSummaries.map((summary) => summary.id),
            attachmentCount: attachments.length,
          })
        : [],
    [attachments.length, document, linkedSummaries]
  );

  if (!document) {
    return null;
  }

  const editable = isSalesDocumentEditable({
    status: document.status,
    lockAfterPayment: data.policySummary.lockDocumentsAfterPayment,
  });

  const resetRequired = salesDeleteRequiresReset({
    status: document.status,
    linkedCount: linkedSummaries.length,
    attachmentCount: attachments.length,
  });

  const handleDownloadPdf = async () => {
    try {
      await downloadDocumentPdf(kind, document.id);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("salesDocumentSheet.downloadError", { defaultValue: "Unable to download PDF." })
      );
    }
  };

  const reloadAttachments = async () => {
    const next = await fetchAttachments(kind, document.id);
    setAttachments(next);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>{document.id}</SheetTitle>
            <SheetDescription>
              {t("salesDocumentSheet.forCustomer", {
                defaultValue: "{{kind}} for {{customer}}",
                kind: formatKindLabel(kind),
                customer: document.customer,
              })}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={document.status} />
              {document.documentVariant ? (
                <span className="rounded-md bg-secondary px-2 py-1 text-xs font-semibold">
                  {formatVariant(document.documentVariant)}
                </span>
              ) : null}
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void handleDownloadPdf()}>
                <Download className="h-4 w-4" /> PDF
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEvidenceOpen(true)}>
                <Paperclip className="h-4 w-4" /> {t("modal.evidence.title")}
              </Button>
              {onEdit ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => onEdit(document)}
                  disabled={!editable}
                >
                  <PencilLine className="h-4 w-4" /> {t("salesDocumentSheet.edit", { defaultValue: "Edit" })}
                </Button>
              ) : null}
              {actions}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
              <Card className="card-premium p-5">
                <h3 className="font-display font-semibold">{t("salesDocumentSheet.documentDetails", { defaultValue: "Document details" })}</h3>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted-foreground">{t("salesDocumentSheet.customer", { defaultValue: "Customer" })}</dt>
                    <dd className="mt-1 font-semibold">{document.customer}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted-foreground">{t("salesDocumentSheet.date", { defaultValue: "Date" })}</dt>
                    <dd className="mt-1">{document.date}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted-foreground">{t("salesDocumentSheet.reference", { defaultValue: "Reference" })}</dt>
                    <dd className="mt-1">{document.reference || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted-foreground">{t("salesDocumentSheet.paymentTerms", { defaultValue: "Payment terms" })}</dt>
                    <dd className="mt-1">{document.paymentTerms || "-"}</dd>
                  </div>
                </dl>

                {document.referenceDocuments?.length ? (
                  <div className="mt-5 rounded-2xl border border-border/60">
                    <div className="border-b border-border/60 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("salesDocumentSheet.referenceDocuments", { defaultValue: "Reference documents" })}
                    </div>
                    <div className="divide-y divide-border/40">
                      {document.referenceDocuments.map((reference) => (
                        <div key={reference.id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1fr_auto]">
                          <div>
                            <p className="font-semibold">
                              {reference.type || reference.kind || reference.documentTypes?.[0] || "-"} · {reference.number || reference.id}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {[reference.party, reference.date, reference.status].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          <div className="text-right font-semibold tabular-nums">
                            {fmtTHB(reference.total ?? reference.amount ?? 0)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {document.lines?.length ? (
                  <div className="mt-5 overflow-x-auto rounded-2xl border border-border/60">
                    <table className="w-full text-sm">
                      <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="px-3 py-3 text-left font-semibold">{t("salesDocumentSheet.description", { defaultValue: "Description" })}</th>
                          <th className="px-3 py-3 text-right font-semibold">{t("salesDocumentSheet.qty", { defaultValue: "Qty" })}</th>
                          <th className="px-3 py-3 text-right font-semibold">{t("salesDocumentSheet.unit", { defaultValue: "Unit" })}</th>
                          <th className="px-3 py-3 text-right font-semibold">{t("salesDocumentSheet.tax", { defaultValue: "Tax" })}</th>
                          {document.documentSettingsSnapshot?.perLineWithholdingTax ? (
                            <th className="px-3 py-3 text-right font-semibold">{t("salesDocumentSheet.wht", { defaultValue: "WHT" })}</th>
                          ) : null}
                          <th className="px-3 py-3 text-right font-semibold">{t("salesDocumentSheet.amount", { defaultValue: "Amount" })}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {document.lines.map((line) => (
                          <tr key={line.id} className="border-t border-border/50">
                            <td className="px-3 py-3">{line.desc}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{line.qty}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{fmtTHB(line.price)}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{line.vatRate ?? line.tax ?? 0}%</td>
                            {document.documentSettingsSnapshot?.perLineWithholdingTax ? (
                              <td className="px-3 py-3 text-right tabular-nums">{line.withholdingRate ?? 0}%</td>
                            ) : null}
                            <td className="px-3 py-3 text-right tabular-nums">
                              {fmtTHB(line.amount || line.qty * line.price)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {document.installmentPlan?.length ? (
                  <div className="mt-5 rounded-2xl border border-border/60">
                    <div className="border-b border-border/60 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("salesDocumentSheet.installmentPlan", { defaultValue: "Installment plan" })}
                    </div>
                    <div className="divide-y divide-border/40">
                      {document.installmentPlan.map((item) => (
                        <div key={item.id} className="flex items-center justify-between px-4 py-3 text-sm">
                          <div>
                            <p className="font-semibold">{item.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.relatedDocumentId ||
                                t("salesDocumentSheet.pendingDocument", {
                                  defaultValue: "Pending document",
                                })}
                              {item.qty
                                ? ` • ${t("salesDocumentSheet.qtyAllocated", {
                                    defaultValue: "{{qty}} qty",
                                    qty: item.qty,
                                  })}`
                                : ""}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold tabular-nums">{fmtTHB(item.amount)}</p>
                            <p className="text-xs text-muted-foreground">{item.status || "draft"}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </Card>

              <div className="space-y-4">
                <Card className="card-premium p-5">
                  <h3 className="font-display font-semibold">{t("salesDocumentSheet.summary", { defaultValue: "Summary" })}</h3>
                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">{t("salesDocumentSheet.subtotal", { defaultValue: "Subtotal" })}</dt>
                      <dd className="tabular-nums">{fmtTHB(document.subtotal ?? document.amount)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">{t("salesDocumentSheet.tax", { defaultValue: "Tax" })}</dt>
                      <dd className="tabular-nums">{fmtTHB(document.taxAmount ?? 0)}</dd>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2 font-semibold">
                      <dt>{t("salesDocumentSheet.total", { defaultValue: "Total" })}</dt>
                      <dd className="tabular-nums">{fmtTHB(document.amount)}</dd>
                    </div>
                    {typeof document.netReceivable === "number" ? (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">{t("salesDocumentSheet.netReceivable", { defaultValue: "Net receivable" })}</dt>
                        <dd className="tabular-nums">{fmtTHB(document.netReceivable)}</dd>
                      </div>
                    ) : null}
                    {document.paymentSummary ? (
                      <>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">{t("salesDocumentSheet.received", { defaultValue: "Received" })}</dt>
                          <dd className="tabular-nums">{fmtTHB(document.paymentSummary.received)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">{t("salesDocumentSheet.remaining", { defaultValue: "Remaining" })}</dt>
                          <dd className="tabular-nums">{fmtTHB(document.paymentSummary.remaining)}</dd>
                        </div>
                      </>
                    ) : null}
                  </dl>
                </Card>

                {document.receiptAdjustments?.length || document.splitReceives?.length ? (
                  <Card className="card-premium p-5">
                    <h3 className="font-display font-semibold">Collections</h3>

                    {document.receiptAdjustments?.length ? (
                      <div className="mt-4 space-y-2 text-sm">
                        {document.receiptAdjustments.map((adjustment) => (
                          <div key={adjustment.id} className="flex items-center justify-between">
                            <dt className="text-muted-foreground">
                              {adjustment.type.replace(/_/g, " ")}
                            </dt>
                            <dd className="tabular-nums">{fmtTHB(adjustment.amount)}</dd>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {document.splitReceives?.length ? (
                      <div className="mt-4 space-y-2 text-sm">
                        {document.splitReceives.map((split) => (
                          <div key={split.id} className="rounded-xl border border-border/50 px-3 py-2">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">{split.paymentMethod || "Collection"}</span>
                              <span className="font-semibold tabular-nums">{fmtTHB(split.amount)}</span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{split.receivedAt}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </Card>
                ) : null}

                <Card className="card-premium p-5">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="mt-0.5 h-4 w-4 text-warning" />
                    <div className="text-sm">
                      <p className="font-semibold">{t("salesDocumentSheet.salesRules", { defaultValue: "Sales rules" })}</p>
                      <p className="mt-1 text-muted-foreground">
                        {editable
                          ? t("salesDocumentSheet.editableMessage", {
                              defaultValue:
                                "This document is still editable under the current payment/tax lock policy.",
                            })
                          : t("salesDocumentSheet.lockedMessage", {
                              defaultValue:
                                "Editing is restricted because of payment or approval state.",
                            })}
                      </p>
                      <p className="mt-2 text-muted-foreground">
                        {resetRequired
                          ? t("salesDocumentSheet.resetRequiredMessage", {
                              defaultValue:
                                "Reset is required before delete because the document is linked, attached, or beyond draft.",
                            })
                          : t("salesDocumentSheet.deleteAllowedMessage", {
                              defaultValue:
                                "This document can be deleted without a reset under current rules.",
                            })}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            <Card className="card-premium p-5">
              <Tabs defaultValue="timeline">
                <TabsList className="bg-secondary">
                  <TabsTrigger value="timeline" className="gap-1.5">
                    <Activity className="h-4 w-4" /> {t("salesDocumentSheet.timeline", { defaultValue: "Timeline" })}
                  </TabsTrigger>
                  <TabsTrigger value="related" className="gap-1.5">
                    <FileText className="h-4 w-4" /> {t("salesDocumentSheet.related", { defaultValue: "Related" })}
                  </TabsTrigger>
                  <TabsTrigger value="files" className="gap-1.5">
                    <Paperclip className="h-4 w-4" /> {t("salesDocumentSheet.files", { defaultValue: "Files" })} ({attachments.length})
                  </TabsTrigger>
                  <TabsTrigger value="notes">{t("salesDocumentSheet.notes", { defaultValue: "Notes" })}</TabsTrigger>
                </TabsList>

                <TabsContent value="timeline" className="mt-4 space-y-3">
                  {timeline.map((item, index) => (
                    <div key={`${item.what}-${index}`} className="rounded-xl border border-border/60 p-3">
                      <p className="text-sm">
                        <span className="font-semibold">{item.who}</span>{" "}
                        <span className="text-muted-foreground">{item.what}</span>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.time}</p>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="related" className="mt-4 space-y-3">
                  {linkedSummaries.length > 0 ? (
                    linkedSummaries.map((summary) => (
                      <div key={summary.id} className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                        <div>
                          <p className="font-mono text-xs font-semibold text-primary">{summary.id}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatKindLabel(summary.kind)} • {summary.party}
                          </p>
                        </div>
                        <StatusBadge status={summary.status} />
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t("salesDocumentSheet.noRelatedDocuments", {
                        defaultValue: "No related documents yet.",
                      })}
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="files" className="mt-4 space-y-3">
                  {attachments.length > 0 ? (
                    attachments.map((attachment) => (
                      <div key={attachment.id} className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{attachment.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {attachment.category} • {attachment.uploadedAt}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => void downloadAttachment(attachment)}>
                          {t("common.download")}
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("salesDocumentSheet.noFiles", { defaultValue: "No files attached yet." })}</p>
                  )}
                </TabsContent>

                <TabsContent value="notes" className="mt-4">
                  <p className="text-sm text-muted-foreground">
                    {document.notes || t("salesDocumentSheet.noNotes", { defaultValue: "No notes yet." })}
                  </p>
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        </SheetContent>
      </Sheet>

      <EvidenceAttachmentModal
        open={evidenceOpen}
        onOpenChange={setEvidenceOpen}
        entityType={kind}
        entityId={document.id}
        receive={{
          number: document.id,
          date: document.date,
          from: document.customer,
          amount: fmtTHB(document.amount),
        }}
        onSaved={() => void reloadAttachments()}
      />
    </>
  );
};

import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { EvidenceAttachmentModal } from "@/components/modals/DomainModals";
import { downloadAttachment, downloadDocumentPdf, fetchAttachments } from "@/lib/api";
import { formatMoney } from "@/lib/currency";
import {
  buildPurchaseTimeline,
  collectPurchaseLinkedSummaries,
  getPaymentsForDocument,
  isPurchaseDocumentEditable,
  purchaseDeleteRequiresReset,
  PURCHASE_KIND_LABELS,
} from "@/lib/purchases";
import type {
  AppData,
  Attachment,
  DocumentKind,
  Expense,
  PurchaseDocumentRecord,
} from "@/lib/types";
import {
  Activity,
  CreditCard,
  Download,
  FileText,
  Paperclip,
  PencilLine,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  kind: "purchase_order" | "receive" | "expense";
  document: PurchaseDocumentRecord | Expense | null;
  data: AppData;
  onEdit?: (document: PurchaseDocumentRecord | Expense) => void;
  actions?: React.ReactNode;
}

export const PurchaseDocumentSheet = ({
  open,
  onOpenChange,
  kind,
  document,
  data,
  onEdit,
  actions,
}: Props) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  useEffect(() => {
    if (!document?.id || !open) {
      return;
    }

    void fetchAttachments(kind, document.id)
      .then(setAttachments)
      .catch(() => setAttachments([]));
  }, [document?.id, kind, open]);

  const linkedSummaries = useMemo(
    () => (document ? collectPurchaseLinkedSummaries(data, document.id) : []),
    [data, document]
  );

  const linkedPayments = useMemo(
    () => (document ? getPaymentsForDocument(data.vendorPayments, document.id) : []),
    [data.vendorPayments, document]
  );

  const timeline = useMemo(
    () =>
      document
        ? buildPurchaseTimeline({
            document,
            linkedIds: linkedSummaries.map((summary) => summary.id),
            attachmentCount: attachments.length,
            payments: linkedPayments,
          })
        : [],
    [attachments.length, document, linkedPayments, linkedSummaries]
  );

  if (!document) {
    return null;
  }

  const editable = isPurchaseDocumentEditable({
    status: document.status,
    lockAfterPayment: data.policySummary.lockDocumentsAfterPayment,
  });

  const resetRequired = purchaseDeleteRequiresReset({
    status: document.status,
    linkedCount: linkedSummaries.length + linkedPayments.length,
    attachmentCount: attachments.length,
  });

  const paymentSummary = document.paymentSummary;
  const documentCurrency = document.currency || "THB";

  const handleDownloadPdf = async () => {
    try {
      await downloadDocumentPdf(kind as DocumentKind, document.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to download PDF.");
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
              {PURCHASE_KIND_LABELS[kind]} for {document.vendor}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={document.status} />
              {document.receiveType ? (
                <span className="rounded-md bg-secondary px-2 py-1 text-xs font-semibold">
                  {document.receiveType === "inventory" ? "Inventory Receipt" : "Operating Expense Flow"}
                </span>
              ) : null}
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void handleDownloadPdf()}>
                <Download className="h-4 w-4" /> PDF
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEvidenceOpen(true)}>
                <Paperclip className="h-4 w-4" /> Attach Evidence
              </Button>
              {onEdit ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => onEdit(document)}
                  disabled={!editable}
                >
                  <PencilLine className="h-4 w-4" /> Edit
                </Button>
              ) : null}
              {actions}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
              <Card className="card-premium p-5">
                <h3 className="font-display font-semibold">Document details</h3>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted-foreground">Vendor</dt>
                    <dd className="mt-1 font-semibold">{document.vendor}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted-foreground">Date</dt>
                    <dd className="mt-1">{document.date}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted-foreground">Reference</dt>
                    <dd className="mt-1">{document.reference || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted-foreground">Due</dt>
                    <dd className="mt-1">{document.due || "-"}</dd>
                  </div>
                  {document.requestedBy ? (
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-muted-foreground">Requested By</dt>
                      <dd className="mt-1">{document.requestedBy}</dd>
                    </div>
                  ) : null}
                  {document.department ? (
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-muted-foreground">Department</dt>
                      <dd className="mt-1">{document.department}</dd>
                    </div>
                  ) : null}
                  {"category" in document && document.category ? (
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-muted-foreground">Category</dt>
                      <dd className="mt-1">{document.category}</dd>
                    </div>
                  ) : null}
                  {document.accountantCategory ? (
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-muted-foreground">Accountant Category</dt>
                      <dd className="mt-1">{document.accountantCategory}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted-foreground">Currency</dt>
                    <dd className="mt-1">{documentCurrency}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted-foreground">Project</dt>
                    <dd className="mt-1">{document.projectName || document.projectId || "-"}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs uppercase tracking-wider text-muted-foreground">FX Snapshot</dt>
                    <dd className="mt-1">
                      {document.baseCurrency && document.exchangeRate
                        ? `${document.baseCurrency} @ ${document.exchangeRate} (${document.snapshotDate || document.date})`
                        : "Base currency"}
                    </dd>
                  </div>
                </dl>

                {document.lines?.length ? (
                  <div className="mt-5 overflow-x-auto rounded-2xl border border-border/60">
                    <table className="w-full text-sm">
                      <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="px-3 py-3 text-left font-semibold">Description</th>
                          <th className="px-3 py-3 text-right font-semibold">Qty</th>
                          <th className="px-3 py-3 text-right font-semibold">Unit Cost</th>
                          <th className="px-3 py-3 text-right font-semibold">Tax</th>
                          <th className="px-3 py-3 text-right font-semibold">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {document.lines.map((line) => (
                          <tr key={line.id} className="border-t border-border/50">
                            <td className="px-3 py-3">{line.desc}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{line.qty}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{formatMoney(line.price, documentCurrency)}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{line.tax}%</td>
                            <td className="px-3 py-3 text-right tabular-nums">
                              {formatMoney(line.amount || line.qty * line.price, documentCurrency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </Card>

              <div className="space-y-4">
                <Card className="card-premium p-5">
                  <h3 className="font-display font-semibold">Summary</h3>
                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Subtotal</dt>
                      <dd className="tabular-nums">{formatMoney(document.subtotal ?? document.amount, documentCurrency)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Tax</dt>
                      <dd className="tabular-nums">{formatMoney(document.taxAmount ?? 0, documentCurrency)}</dd>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2 font-semibold">
                      <dt>Total</dt>
                      <dd className="tabular-nums">{formatMoney(document.amount, documentCurrency)}</dd>
                    </div>
                    {paymentSummary ? (
                      <>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Paid</dt>
                          <dd className="tabular-nums">{formatMoney(paymentSummary.paid, documentCurrency)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Remaining</dt>
                          <dd className="tabular-nums">{formatMoney(paymentSummary.remaining, documentCurrency)}</dd>
                        </div>
                        {paymentSummary.lastPaymentMethod ? (
                          <div className="flex justify-between">
                            <dt className="text-muted-foreground">Last Method</dt>
                            <dd>{paymentSummary.lastPaymentMethod}</dd>
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </dl>
                </Card>

                <Card className="card-premium p-5">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="mt-0.5 h-4 w-4 text-warning" />
                    <div className="text-sm">
                      <p className="font-semibold">Purchase rules</p>
                      <p className="mt-1 text-muted-foreground">
                        {editable
                          ? "This document is editable under the current payment lock policy."
                          : "Editing is restricted because payment or approval state has locked this document."}
                      </p>
                      <p className="mt-2 text-muted-foreground">
                        {resetRequired
                          ? "Reset is required before delete because the document is linked, attached, or no longer draft."
                          : "This document can be deleted without a reset under current rules."}
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
                    <Activity className="h-4 w-4" /> Timeline
                  </TabsTrigger>
                  <TabsTrigger value="related" className="gap-1.5">
                    <FileText className="h-4 w-4" /> Related
                  </TabsTrigger>
                  <TabsTrigger value="payments" className="gap-1.5">
                    <CreditCard className="h-4 w-4" /> Payments ({linkedPayments.length})
                  </TabsTrigger>
                  <TabsTrigger value="files" className="gap-1.5">
                    <Paperclip className="h-4 w-4" /> Files ({attachments.length})
                  </TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
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
                            {summary.kind.replace(/_/g, " ")} - {summary.party}
                          </p>
                        </div>
                        <StatusBadge status={summary.status} />
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No related documents yet.</p>
                  )}
                </TabsContent>

                <TabsContent value="payments" className="mt-4 space-y-3">
                  {linkedPayments.length > 0 ? (
                    linkedPayments.map((payment) => (
                      <div key={payment.id} className="rounded-xl border border-border/60 p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <p className="font-mono text-xs font-semibold text-primary">{payment.id}</p>
                          <StatusBadge status={payment.paymentStatus === "paid" ? "paid" : "partial"} />
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-muted-foreground">
                          <p>Date: {payment.paymentDate}</p>
                          <p>Method: {payment.paymentMethod}</p>
                          <p>Amount: {formatMoney(payment.amount, payment.currency || "THB")}</p>
                          <p>Account: {payment.accountName || "-"}</p>
                          {payment.chequeDate ? <p>Cheque Date: {payment.chequeDate}</p> : null}
                          {payment.chequeClearedDate ? <p>Cleared: {payment.chequeClearedDate}</p> : null}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No payment metadata recorded yet.</p>
                  )}
                </TabsContent>

                <TabsContent value="files" className="mt-4 space-y-3">
                  {attachments.length > 0 ? (
                    attachments.map((attachment) => (
                      <div key={attachment.id} className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{attachment.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {attachment.category} - {attachment.uploadedAt}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => void downloadAttachment(attachment)}>
                          Download
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No files attached yet.</p>
                  )}
                </TabsContent>

                <TabsContent value="notes" className="mt-4">
                  <p className="text-sm text-muted-foreground">{document.notes || "No notes yet."}</p>
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
          from: document.vendor,
          amount: formatMoney(document.amount, documentCurrency),
        }}
        onSaved={() => void reloadAttachments()}
      />
    </>
  );
};

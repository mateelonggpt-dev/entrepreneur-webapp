import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/layout/AppShell";
import { BrandMark } from "@/components/brand/BrandMark";
import { DocumentNextActions } from "@/components/documents/DocumentNextActions";
import { ConfigurableActionModal, EvidenceAttachmentModal, MasterDataModal } from "@/components/modals/DomainModals";
import { SalesDocumentActionsMenu } from "@/components/sales/SalesDocumentActionsMenu";
import { CombinedReceiptModal } from "@/components/modals/CombinedReceiptModal";
import { CreditNoteModal } from "@/components/modals/CreditNoteModal";
import { DebitNoteModal } from "@/components/modals/DebitNoteModal";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { useAppData } from "@/lib/app-data";
import {
  deleteAttachment,
  downloadAttachment,
  downloadDocumentPdf,
  fetchAttachments,
  fetchDocument,
  fetchInvoiceDetail,
  removeDocument,
  sendInvoiceToCustomer,
} from "@/lib/api";
import { fmtTHB } from "@/lib/demo-data";
import { formatMoney } from "@/lib/currency";
import {
  buildDefaultTimeline,
  collectLinkedSummaries,
  isSalesDocumentEditable,
  salesDeleteRequiresReset,
} from "@/lib/sales";
import type { Attachment, DocumentLine, DocumentWorkflowAction, Invoice, SalesDocumentRecord } from "@/lib/types";
import {
  Activity,
  ArrowLeft,
  Building2,
  Download,
  FileText,
  HandCoins,
  Mail,
  MapPin,
  MessageSquare,
  Paperclip,
  PencilLine,
  Phone,
  Printer,
  RefreshCcw,
  Send,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { invoiceToSalesSummary } from "@/lib/document-sections";
import { getSalesDocumentActionType, type SalesDocumentActionId } from "@/lib/sales-document-actions";
import { useAuth } from "@/lib/auth";
import { collectSalesWorkflowDocuments } from "@/lib/sales-workflow";

const fallbackLines = [
  { id: "1", desc: "Accounting Consulting (April 2026)", qty: 24, price: 2500, tax: 7, amount: 60000 },
  { id: "2", desc: "Software License - Pro (Annual)", qty: 1, price: 18000, tax: 7, amount: 18000 },
  { id: "3", desc: "Custom Report Setup", qty: 8, price: 2500, tax: 7, amount: 20000 },
  { id: "4", desc: "Premium Support Add-on", qty: 3, price: 4800, tax: 7, amount: 14400 },
];

const isCustomerPoAttachment = (attachment: Attachment) =>
  attachment.category === "customer_po" ||
  attachment.category === "customer-po" ||
  (attachment.tags ?? []).some((tag) => ["customer_po", "customer-po"].includes(tag));

const InvoiceDetail = ({ id: propId }: { id?: string } = {}) => {
  const { id: routeId } = useParams();
  const id = propId ?? routeId;
  const nav = useNavigate();
  const { data, refresh } = useAppData();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [invoiceDetail, setInvoiceDetail] = useState<Invoice | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [creditNoteOpen, setCreditNoteOpen] = useState(false);
  const [debitNoteOpen, setDebitNoteOpen] = useState(false);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [removalAction, setRemovalAction] = useState<"delete" | "void" | null>(null);

  const fallbackInvoice = data.invoices.find((item) => item.id === id) || null;
  const invoice = invoiceDetail ?? fallbackInvoice;
  const genericSummary = useMemo(
    () => (!invoice && id ? collectSalesWorkflowDocuments(data).find((item) => item.id === id) ?? null : null),
    [data, id, invoice]
  );

  useEffect(() => {
    if (!id) {
      return;
    }

    void fetchInvoiceDetail(id)
      .then(setInvoiceDetail)
      .catch(() => setInvoiceDetail(null));
  }, [id]);

  useEffect(() => {
    if (!invoice?.id) {
      return;
    }

    void fetchAttachments("invoice", invoice.id)
      .then(setAttachments)
      .catch(() => setAttachments([]));
  }, [invoice?.id]);

  const lines: DocumentLine[] = useMemo(() => {
    if (invoice?.lines && invoice.lines.length > 0) {
      return invoice.lines;
    }
    return fallbackLines;
  }, [invoice?.lines]);

  const subtotal =
    invoice?.subtotal ??
    lines.reduce((sum, line) => sum + (line.amount || line.qty * line.price), 0);
  const vat =
    invoice?.taxAmount ??
    lines.reduce((sum, line) => sum + (line.amount || line.qty * line.price) * (line.tax / 100), 0);
  const total = invoice?.amount ?? subtotal + vat;
  const displayCurrency = invoice?.currency || "THB";
  const isTaxInvoice = Boolean(invoice?.isTaxInvoice || invoice?.invoiceTaxType === "tax" || invoice?.documentTypes?.includes("tax_invoice"));
  const documentTitle = invoice?.documentTitle || (isTaxInvoice ? "Tax Invoice" : "Invoice");
  const documentSubtitle =
    invoice?.documentVariant && invoice.documentVariant !== documentTitle
      ? invoice.documentVariant
      : "Sales document";
  const customer = data.customers.find((item) => item.name === invoice?.customer) ?? null;
  const relatedDocuments = useMemo(
    () => (invoice ? collectLinkedSummaries(data, invoice.id) : []),
    [data, invoice]
  );
  const customerPoAttachments = useMemo(() => attachments.filter(isCustomerPoAttachment), [attachments]);
  const genericAttachments = useMemo(() => attachments.filter((attachment) => !isCustomerPoAttachment(attachment)), [attachments]);
  const timeline = useMemo(
    () =>
      invoice
        ? buildDefaultTimeline({
            document: invoice,
            linkedIds: relatedDocuments.map((summary) => summary.id),
            attachmentCount: attachments.length,
          })
        : [],
    [attachments.length, invoice, relatedDocuments]
  );

  if (!invoice) {
    return genericSummary ? <GenericIncomeDocumentDetail summary={genericSummary} /> : null;
  }

  const editable = isSalesDocumentEditable({
    status: invoice.status,
    lockAfterPayment: data.policySummary.lockDocumentsAfterPayment,
  });

  const resetRequired = salesDeleteRequiresReset({
    status: invoice.status,
    linkedCount: relatedDocuments.length,
    attachmentCount: attachments.length,
  });
  const invoiceSummary = invoiceToSalesSummary(invoice);
  const canRemoveDocuments = user?.role === "owner";

  const handleSend = async () => {
    try {
      const updated = await sendInvoiceToCustomer(invoice.id);
      setInvoiceDetail(updated);
      await refresh();
      toast.success(`Invoice ${invoice.id} sent`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send invoice.");
    }
  };

  const handleDownloadPdf = async () => {
    try {
      await downloadDocumentPdf("invoice", invoice.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to download PDF.");
    }
  };

  const createFromDocumentPath = (documentType: string, extra?: Record<string, string>) => {
    const params = new URLSearchParams({
      documentTypes: documentType,
      sourceDocumentId: invoice.id,
      sourceDocumentType: "invoice",
      sourceDocumentNumber: invoice.id,
      ...extra,
    });
    return `/income/create?${params.toString()}`;
  };

  const handleNextAction = (action: DocumentWorkflowAction) => {
    const targetKind = action.targetKind === "combined_receipt" ? "receipt" : action.targetKind;
    nav(createFromDocumentPath(targetKind));
  };

  const handleMoreAction = async (action: SalesDocumentActionId) => {
    if (action === "create_from_reference") {
      nav(createFromDocumentPath(getSalesDocumentActionType(invoiceSummary)));
      return;
    }
    if (action === "duplicate") {
      nav(createFromDocumentPath(getSalesDocumentActionType(invoiceSummary), {
        duplicateDocumentId: invoice.id,
        duplicateDocumentType: "invoice",
      }));
      toast.success("Document duplicated. Review before saving.");
      return;
    }
    if (action === "attach_evidence" || action === "view_evidence") {
      setEvidenceOpen(true);
      return;
    }
    if (action === "delete" || action === "cancel_void") {
      setRemovalAction(action === "delete" ? "delete" : "void");
    }
  };

  const executeRemoval = async () => {
    if (!removalAction) return;
    try {
      await removeDocument("invoice", invoice.id, { mode: removalAction, preserveAuditTrail: true });
      await refresh();
      toast.success(removalAction === "delete" ? "Document deleted" : "Document voided", { description: invoice.id });
      setRemovalAction(null);
      nav("/income/documents");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update document.");
    }
  };

  const handleDownloadAttachment = async (attachment: Attachment) => {
    try {
      await downloadAttachment(attachment);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to download attachment.");
    }
  };

  const handleDeleteAttachment = async (attachment: Attachment) => {
    try {
      await deleteAttachment(attachment);
      await reloadAttachments();
      toast.success("Attachment removed", { description: attachment.name });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to remove attachment.");
    }
  };

  const reloadAttachments = async () => {
    const next = await fetchAttachments("invoice", invoice.id);
    setAttachments(next);
    await refresh();
  };

  const refreshCustomer = async () => {
    await refresh();
    toast.success("Customer profile refreshed");
  };

  return (
    <AppShell>
      <Button variant="ghost" size="sm" className="mb-4 -ml-2 gap-1" onClick={() => nav(-1)}>
        <ArrowLeft className="h-4 w-4" /> {t("common.back")}
      </Button>

      <PageHeader
        title={invoice.id}
        breadcrumbs={[{ label: t("common.income") }, { label: t("searchDialog.routes.invoices") }, { label: invoice.id }]}
        actions={
          <>
            <StatusBadge status={invoice.status} className="px-3 py-1.5 text-sm" />
            {attachments.length ? (
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setEvidenceOpen(true)}>
                <Paperclip className="h-4 w-4" /> {attachments.length}
              </Button>
            ) : null}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> {t("common.print")}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void handleDownloadPdf()}>
              <Download className="h-4 w-4" /> PDF
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setReceiptModalOpen(true)}>
              <HandCoins className="h-4 w-4" /> {t("documentActions.createReceipt")}
            </Button>
            <SalesDocumentActionsMenu
              document={invoiceSummary}
              variant="shared"
              canRemove={canRemoveDocuments}
              onAction={(action) => void handleMoreAction(action)}
            />
            <Button
              size="sm"
              className="gap-1.5 border-0 bg-gradient-brand text-primary-foreground shadow-brand"
              onClick={() => void handleSend()}
            >
              <Send className="h-4 w-4" /> {t("common.send")}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="card-premium bg-gradient-card p-8">
            <div className="mb-8 flex items-start justify-between border-b border-border pb-6">
              <BrandMark size="md" />
              <div className="text-right">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">{documentSubtitle}</p>
                <h2 className="mt-1 font-display text-2xl font-bold">{documentTitle}</h2>
                <p className="mt-1 font-mono text-lg font-bold">{invoice.id}</p>
              </div>
            </div>

            <div className="mb-8 grid grid-cols-2 gap-8 text-sm">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">From</p>
                <p className="font-semibold">Siam Tech Co., Ltd.</p>
                <p className="text-muted-foreground">123 Sukhumvit Rd., Klongtoey</p>
                <p className="text-muted-foreground">Bangkok 10110, Thailand</p>
                <p className="mt-1 text-muted-foreground">VAT: 0105561234567</p>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Bill to</p>
                <p className="font-semibold">{invoice.customer}</p>
                <p className="text-muted-foreground">{customer?.address || "Customer address on file"}</p>
                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border/50 pt-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">Issue date</span>
                    <br />
                    <span className="font-semibold">{invoice.date}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Due date</span>
                    <br />
                    <span className="font-semibold">{invoice.due}</span>
                  </div>
                </div>
              </div>
            </div>

            <table className="mb-6 w-full text-sm">
              <thead>
                <tr className="border-y border-border bg-secondary/30">
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</th>
                  <th className="w-20 px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Qty</th>
                  <th className="w-28 px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Unit</th>
                  <th className="w-20 px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tax</th>
                  <th className="w-32 px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const lineBase = line.amount || line.qty * line.price;
                  return (
                    <tr key={line.id} className="border-b border-border/40">
                      <td className="px-3 py-3">{line.desc}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{line.qty}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatMoney(line.price, displayCurrency)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{line.tax}%</td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">
                        {formatMoney(lineBase * (1 + line.tax / 100), displayCurrency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="flex justify-end">
              <div className="w-72 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">{formatMoney(subtotal, displayCurrency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">VAT 7%</span>
                  <span className="tabular-nums">{formatMoney(vat, displayCurrency)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-3 font-display text-lg font-bold">
                  <span>Total ({displayCurrency})</span>
                  <span className="gradient-brand-text tabular-nums">{formatMoney(total, displayCurrency)}</span>
                </div>
              </div>
            </div>

            <div className="mt-8 border-t border-border pt-6 text-xs text-muted-foreground">
              <p className="mb-1 font-semibold text-foreground">Payment terms</p>
              <p>{invoice.notes || "Net 14 days. Bank transfer to Bangkok Bank 123-4-56789-0."}</p>
            </div>
          </Card>

          <Card className="card-premium p-6">
            <Tabs defaultValue="activity">
              <TabsList className="bg-secondary">
                <TabsTrigger value="activity" className="gap-1.5">
                  <Activity className="h-4 w-4" /> {t("dashboard.recentActivity", { defaultValue: "Activity" })}
                </TabsTrigger>
                <TabsTrigger value="related" className="gap-1.5">
                  <FileText className="h-4 w-4" /> {t("workflow.nextActions", { defaultValue: "Related" })}
                </TabsTrigger>
                <TabsTrigger value="files" className="gap-1.5">
                  <Paperclip className="h-4 w-4" /> Files ({attachments.length})
                </TabsTrigger>
                <TabsTrigger value="notes" className="gap-1.5">
                  <MessageSquare className="h-4 w-4" /> {t("modal.quotation.notes", { defaultValue: "Notes" })}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="activity" className="mt-4 space-y-3">
                {timeline.map((activity, index) => (
                  <div key={`${activity.what}-${index}`} className="flex gap-3 border-b border-border/40 py-2 last:border-0">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-secondary text-xs">{activity.who[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-sm">
                      <p>
                        <span className="font-semibold">{activity.who}</span>{" "}
                        <span className="text-muted-foreground">{activity.what}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="related" className="mt-4">
                <div className="space-y-2">
                  {relatedDocuments.length > 0 ? (
                    relatedDocuments.map((related) => (
                      <div key={related.id} className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-primary" />
                          <div>
                            <span className="font-mono text-sm">{related.id}</span>
                            <p className="text-xs text-muted-foreground">
                              {related.kind.replace(/_/g, " ")} • {related.party}
                            </p>
                          </div>
                        </div>
                        <StatusBadge status={related.status} />
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("workflow.noRelatedDocuments", { defaultValue: "No related documents yet." })}</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="files" className="mt-4 space-y-3">
                <div className="rounded-xl border-2 border-dashed border-border p-6 text-center">
                  <Paperclip className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                  <p className="text-sm font-semibold">Upload evidence or supporting files</p>
                  <p className="mt-1 text-xs text-muted-foreground">PDF, JPG, PNG up to 10MB</p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => setEvidenceOpen(true)}>
                    {t("common.attachEvidence")}
                  </Button>
                </div>
                <AttachmentGroup
                  title="Customer PO / เอกสาร PO ลูกค้า"
                  attachments={customerPoAttachments}
                  onDownload={handleDownloadAttachment}
                  onDelete={handleDeleteAttachment}
                  downloadLabel={t("common.download")}
                />
                <AttachmentGroup
                  title="Generic evidence / หลักฐานอื่น"
                  attachments={genericAttachments}
                  onDownload={handleDownloadAttachment}
                  onDelete={handleDeleteAttachment}
                  downloadLabel={t("common.download")}
                />
              </TabsContent>

              <TabsContent value="notes" className="mt-4">
                <p className="text-sm text-muted-foreground">
                  {invoice.notes || "No notes yet."}
                </p>
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        <div className="space-y-4">
          <DocumentNextActions kind={isTaxInvoice ? "tax_invoice" : "invoice"} documentId={invoice.id} onAction={handleNextAction} />

          <Card className="card-premium p-5">
            <h3 className="mb-3 text-sm font-display font-semibold">{t("modal.quotation.summary", { defaultValue: "Summary" })}</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Status</dt>
                <dd><StatusBadge status={invoice.status} /></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Issued</dt>
                <dd className="font-medium">{invoice.date}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Due</dt>
                <dd className="font-medium">{invoice.due}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Currency</dt>
                <dd className="font-medium">{displayCurrency}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">FX snapshot</dt>
                <dd className="font-medium">
                  {invoice.baseCurrency && invoice.exchangeRate
                    ? `${invoice.baseCurrency} @ ${invoice.exchangeRate} (${invoice.snapshotDate || invoice.date})`
                    : "Base currency"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Project</dt>
                <dd className="font-medium">{invoice.projectName || invoice.projectId || "-"}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <dt className="text-muted-foreground">Total</dt>
                <dd className="font-bold tabular-nums">{formatMoney(total, displayCurrency)}</dd>
              </div>
            </dl>
          </Card>

          <Card className="card-premium p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-display font-semibold">
              <ShieldAlert className="h-4 w-4 text-warning" /> Sales rules
            </h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                {editable
                  ? "This invoice is still editable under the current payment and tax lock policy."
                  : "Editing is restricted because payment, approval, or document lock rules now apply."}
              </p>
              <p>
                {resetRequired
                  ? "Reset is required before delete because this invoice has downstream links, files, or a non-draft status."
                  : "This invoice can be removed without a reset under the current policy."}
              </p>
            </div>
          </Card>

          <Card className="card-premium p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-display font-semibold">
              <Building2 className="h-4 w-4 text-primary" /> {t("searchDialog.customers")}
            </h3>
            <p className="font-semibold">{invoice.customer}</p>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5" /> {customer?.email ?? "No email on file"}
              </p>
              <p className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5" /> {customer?.phone ?? "-"}
              </p>
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-3.5 w-3.5" /> {customer?.address ?? "No address on file"}
              </p>
            </div>
            <div className="mt-4 grid gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void refreshCustomer()}>
                <RefreshCcw className="h-4 w-4" /> {t("common.refresh", { defaultValue: "Refresh" })}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setCustomerModalOpen(true)}
                disabled={!editable || !customer}
              >
                <PencilLine className="h-4 w-4" /> {t("common.edit")} {t("searchDialog.customers")}
              </Button>
              <Button variant="outline" size="sm" className="w-full" onClick={() => nav("/contacts/customers")}>
                {t("common.view")} {t("searchDialog.customers")}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <EvidenceAttachmentModal
        open={evidenceOpen}
        onOpenChange={setEvidenceOpen}
        entityType="invoice"
        entityId={invoice.id}
        receive={{
          number: invoice.id,
          date: invoice.date,
          from: invoice.customer,
          amount: fmtTHB(total),
        }}
        onSaved={() => void reloadAttachments()}
      />

      <CombinedReceiptModal
        open={receiptModalOpen}
        onOpenChange={setReceiptModalOpen}
        sourceInvoiceIds={[invoice.id]}
      />

      <CreditNoteModal
        open={creditNoteOpen}
        onOpenChange={setCreditNoteOpen}
        sourceInvoiceId={invoice.id}
      />

      <DebitNoteModal
        open={debitNoteOpen}
        onOpenChange={setDebitNoteOpen}
        sourceInvoiceId={invoice.id}
      />

      <MasterDataModal
        kind="customer"
        open={customerModalOpen}
        onOpenChange={setCustomerModalOpen}
        customer={customer}
      />
      <ConfigurableActionModal
        open={Boolean(removalAction)}
        onOpenChange={(open) => !open && setRemovalAction(null)}
        title={removalAction === "delete" ? "Delete this document?" : "Void this document?"}
        description={
          removalAction === "delete"
            ? "This will remove the document from active lists while keeping an audit trail."
            : "The issued document will be kept for audit history and removed from active lists."
        }
        confirmLabel={removalAction === "delete" ? "Delete document" : "Void document"}
        onConfirm={executeRemoval}
      >
        <p className="text-sm font-medium">{invoice.id}</p>
      </ConfigurableActionModal>
    </AppShell>
  );
};

export default InvoiceDetail;

const AttachmentGroup = ({
  title,
  attachments,
  onDownload,
  onDelete,
  downloadLabel,
}: {
  title: string;
  attachments: Attachment[];
  onDownload: (attachment: Attachment) => void | Promise<void>;
  onDelete: (attachment: Attachment) => void | Promise<void>;
  downloadLabel: string;
}) => {
  if (!attachments.length) return null;

  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      {attachments.map((attachment) => (
        <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{attachment.name}</p>
            <p className="text-xs text-muted-foreground">
              {attachment.category} · {attachment.uploadedAt}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => void onDownload(attachment)}>
              {downloadLabel}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => void onDelete(attachment)}
              aria-label={`Remove ${attachment.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </section>
  );
};

const GenericIncomeDocumentDetail = ({ summary }: { summary: ReturnType<typeof collectSalesWorkflowDocuments>[number] }) => {
  const nav = useNavigate();
  const { t } = useTranslation();
  const { data, refresh } = useAppData();
  const { user } = useAuth();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [detail, setDetail] = useState<SalesDocumentRecord | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [removalAction, setRemovalAction] = useState<"delete" | "void" | null>(null);
  const canRemoveDocuments = user?.role === "owner";
  const customerPoAttachments = useMemo(() => attachments.filter(isCustomerPoAttachment), [attachments]);
  const genericAttachments = useMemo(() => attachments.filter((attachment) => !isCustomerPoAttachment(attachment)), [attachments]);

  useEffect(() => {
    void fetchAttachments(summary.kind === "billing" ? "billing" : summary.kind, summary.id)
      .then(setAttachments)
      .catch(() => setAttachments([]));
  }, [summary.id, summary.kind]);

  useEffect(() => {
    void fetchDocument<SalesDocumentRecord>(summary.kind, summary.id)
      .then(setDetail)
      .catch(() => setDetail(null));
  }, [summary.id, summary.kind]);

  const createFromDocumentPath = (documentType: string, extra?: Record<string, string>) => {
    const params = new URLSearchParams({
      documentTypes: documentType,
      sourceDocumentId: summary.id,
      sourceDocumentType: summary.kind,
      sourceDocumentNumber: summary.id,
      ...extra,
    });
    return `/income/create?${params.toString()}`;
  };

  const handleNextAction = (action: DocumentWorkflowAction) => {
    const targetKind = action.targetKind === "combined_receipt" ? "receipt" : action.targetKind;
    nav(createFromDocumentPath(targetKind));
  };

  const handleMoreAction = async (action: SalesDocumentActionId) => {
    if (action === "create_from_reference") {
      nav(createFromDocumentPath(getSalesDocumentActionType(summary)));
      return;
    }
    if (action === "duplicate") {
      nav(createFromDocumentPath(getSalesDocumentActionType(summary), {
        duplicateDocumentId: summary.id,
        duplicateDocumentType: summary.kind,
      }));
      toast.success("Document duplicated. Review before saving.");
      return;
    }
    if (action === "attach_evidence" || action === "view_evidence") {
      setEvidenceOpen(true);
      return;
    }
    if (action === "delete" || action === "cancel_void") {
      setRemovalAction(action === "delete" ? "delete" : "void");
    }
  };

  const executeRemoval = async () => {
    if (!removalAction) return;
    try {
      await removeDocument(summary.kind, summary.id, { mode: removalAction, preserveAuditTrail: true });
      await refresh();
      toast.success(removalAction === "delete" ? "Document deleted" : "Document voided", { description: summary.id });
      setRemovalAction(null);
      nav("/income/documents");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update document.");
    }
  };

  return (
    <AppShell>
      <Button variant="ghost" size="sm" className="mb-4 -ml-2 gap-1" onClick={() => nav(-1)}>
        <ArrowLeft className="h-4 w-4" /> {t("common.back")}
      </Button>
      <PageHeader
        title={summary.id}
        breadcrumbs={[{ label: t("common.income") }, { label: t("common.documents") }, { label: summary.id }]}
        actions={
          <>
            <StatusBadge status={summary.status} className="px-3 py-1.5 text-sm" />
            {attachments.length ? (
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setEvidenceOpen(true)}>
                <Paperclip className="h-4 w-4" /> {attachments.length}
              </Button>
            ) : null}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> {t("common.print")}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void downloadDocumentPdf(summary.kind, summary.id)}>
              <Download className="h-4 w-4" /> PDF
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEvidenceOpen(true)}>
              <Paperclip className="h-4 w-4" /> Attach evidence
            </Button>
            <SalesDocumentActionsMenu
              document={summary}
              variant="shared"
              canRemove={canRemoveDocuments}
              onAction={(action) => void handleMoreAction(action)}
            />
          </>
        }
      />
      <div className="mb-4">
        <DocumentNextActions kind={summary.kind} documentId={summary.id} onAction={handleNextAction} />
      </div>
      <Card className="card-premium p-6">
        <div className="mb-8 flex items-start justify-between border-b border-border pb-6">
          <BrandMark size="md" />
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{summary.documentTitle || summary.documentVariant || summary.kind.replace(/_/g, " ")}</p>
            <h2 className="mt-1 font-display text-2xl font-bold">{summary.documentTitle || summary.kind.replace(/_/g, " ")}</h2>
            <p className="mt-1 font-mono text-lg font-bold">{summary.id}</p>
          </div>
        </div>
        <div className="mb-8 grid grid-cols-2 gap-8 text-sm">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">From</p>
            <p className="font-semibold">Siam Tech Co., Ltd.</p>
            <p className="text-muted-foreground">123 Sukhumvit Rd., Klongtoey</p>
            <p className="text-muted-foreground">Bangkok 10110, Thailand</p>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Bill to</p>
            <p className="font-semibold">{detail?.customer ?? summary.party}</p>
            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border/50 pt-3 text-xs">
              <div>
                <span className="text-muted-foreground">Issue date</span>
                <br />
                <span className="font-semibold">{detail?.date ?? summary.date}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Status</span>
                <br />
                <StatusBadge status={detail?.status ?? summary.status} />
              </div>
            </div>
          </div>
        </div>
        <table className="mb-6 w-full text-sm">
          <thead>
            <tr className="border-y border-border bg-secondary/30">
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</th>
              <th className="w-20 px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Qty</th>
              <th className="w-28 px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Unit</th>
              <th className="w-32 px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody>
            {(detail?.lines?.length ? detail.lines : [{ id: "summary", desc: summary.documentTitle || summary.kind.replace(/_/g, " "), qty: 1, price: summary.amount, tax: 0, amount: summary.amount }]).map((line) => (
              <tr key={line.id} className="border-b border-border/40">
                <td className="px-3 py-3">{line.desc}</td>
                <td className="px-3 py-3 text-right tabular-nums">{line.qty}</td>
                <td className="px-3 py-3 text-right tabular-nums">{fmtTHB(line.price)}</td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums">{fmtTHB(line.amount || line.qty * line.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-end border-t border-border pt-4">
          <div className="w-72 text-sm">
            <div className="flex justify-between font-display text-lg font-bold">
              <span>Total</span>
              <span className="tabular-nums">{fmtTHB(detail?.amount ?? summary.amount)}</span>
            </div>
          </div>
        </div>
      </Card>
      {attachments.length ? (
        <Card className="card-premium mt-4 p-5">
          <div className="space-y-4">
            <AttachmentGroup
              title="Customer PO / เอกสาร PO ลูกค้า"
              attachments={customerPoAttachments}
              onDownload={downloadAttachment}
              onDelete={async (attachment) => {
                await deleteAttachment(attachment);
                const next = await fetchAttachments(summary.kind === "billing" ? "billing" : summary.kind, summary.id);
                setAttachments(next);
                await refresh();
              }}
              downloadLabel={t("common.download")}
            />
            <AttachmentGroup
              title="Generic evidence / หลักฐานอื่น"
              attachments={genericAttachments}
              onDownload={downloadAttachment}
              onDelete={async (attachment) => {
                await deleteAttachment(attachment);
                const next = await fetchAttachments(summary.kind === "billing" ? "billing" : summary.kind, summary.id);
                setAttachments(next);
                await refresh();
              }}
              downloadLabel={t("common.download")}
            />
          </div>
        </Card>
      ) : null}
      <EvidenceAttachmentModal
        open={evidenceOpen}
        onOpenChange={setEvidenceOpen}
        entityType={summary.kind === "billing" ? "billing" : summary.kind}
        entityId={summary.id}
        onSaved={async () => {
          const next = await fetchAttachments(summary.kind === "billing" ? "billing" : summary.kind, summary.id);
          setAttachments(next);
          await refresh();
        }}
      />
      <ConfigurableActionModal
        open={Boolean(removalAction)}
        onOpenChange={(open) => !open && setRemovalAction(null)}
        title={removalAction === "delete" ? "Delete this document?" : "Void this document?"}
        description={
          removalAction === "delete"
            ? "This will remove the document from active lists while keeping an audit trail."
            : "The issued document will be kept for audit history and removed from active lists."
        }
        confirmLabel={removalAction === "delete" ? "Delete document" : "Void document"}
        onConfirm={executeRemoval}
      >
        <p className="text-sm font-medium">{summary.id}</p>
      </ConfigurableActionModal>
    </AppShell>
  );
};

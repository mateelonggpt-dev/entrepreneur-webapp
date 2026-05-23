import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatMoney } from "@/lib/currency";
import { useAppData } from "@/lib/app-data";
import {
  approveExpenseRecord,
  downloadAttachment,
  downloadExpenseReceipt,
  fetchAttachments,
  fetchExpenseDetail,
} from "@/lib/api";
import { ArrowLeft, Download, Paperclip, Activity, FileText, CheckCircle2, PencilLine } from "lucide-react";
import { EvidenceAttachmentModal } from "@/components/modals/DomainModals";
import { ExpenseModal } from "@/components/modals/ExpenseModal";
import { collectPurchaseLinkedSummaries, getPaymentsForDocument } from "@/lib/purchases";
import type { Attachment, Expense } from "@/lib/types";
import { toast } from "sonner";

const ExpenseDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const { data, refresh } = useAppData();
  const [expenseDetail, setExpenseDetail] = useState<Expense | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const fallbackExpense = data.expenses.find((item) => item.id === id) || data.expenses[0] || null;
  const expense = expenseDetail ?? fallbackExpense;
  const linkedSummaries = useMemo(
    () => (expense ? collectPurchaseLinkedSummaries(data, expense.id) : []),
    [data, expense]
  );
  const linkedPayments = useMemo(
    () => (expense ? getPaymentsForDocument(data.vendorPayments, expense.id) : []),
    [data.vendorPayments, expense]
  );

  useEffect(() => {
    if (!id) {
      return;
    }

    void fetchExpenseDetail(id)
      .then(setExpenseDetail)
      .catch(() => setExpenseDetail(null));
  }, [id]);

  useEffect(() => {
    if (!expense?.id) {
      return;
    }

    void fetchAttachments("expense", expense.id)
      .then(setAttachments)
      .catch(() => setAttachments([]));
  }, [expense?.id]);

  if (!expense) {
    return null;
  }

  const subtotal = expense.amount / 1.07;
  const vat = expense.amount - subtotal;

  const handleReceipt = async () => {
    try {
      await downloadExpenseReceipt(expense.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to download receipt.");
    }
  };

  const handleApprove = async () => {
    try {
      const updated = await approveExpenseRecord(expense.id);
      setExpenseDetail(updated);
      await refresh();
      toast.success(`Expense ${expense.id} approved`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to approve expense.");
    }
  };

  const reloadAttachments = async () => {
    const next = await fetchAttachments("expense", expense.id);
    setAttachments(next);
    await refresh();
  };

  return (
    <AppShell>
      <Button variant="ghost" size="sm" className="mb-4 -ml-2 gap-1" onClick={() => nav(-1)}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <PageHeader
        title={expense.id}
        breadcrumbs={[{ label: "Expenses" }, { label: expense.id }]}
        actions={
          <>
            <StatusBadge status={expense.status} className="px-3 py-1.5 text-sm" />
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}>
              <PencilLine className="h-4 w-4" /> Edit
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void handleReceipt()}>
              <Download className="h-4 w-4" /> Receipt
            </Button>
            <Button
              size="sm"
              className="gap-1.5 border-0 bg-gradient-brand text-primary-foreground shadow-brand"
              onClick={() => void handleApprove()}
            >
              <CheckCircle2 className="h-4 w-4" /> Approve
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="card-premium p-6">
            <h3 className="mb-4 font-display font-semibold">Expense details</h3>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Vendor</dt>
                <dd className="mt-1 font-semibold">{expense.vendor}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Category</dt>
                <dd className="mt-1 font-semibold">{expense.category}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Date</dt>
                <dd className="mt-1 font-semibold">{expense.date}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Payment method</dt>
                <dd className="mt-1 font-semibold">{expense.paymentMethod ?? "Bank transfer"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Tax invoice</dt>
                <dd className="mt-1 font-mono text-xs">TIV-2026-A0089</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Account code</dt>
                <dd className="mt-1 font-mono text-xs">5100-Office</dd>
              </div>
            </dl>
          </Card>

          <Card className="card-premium p-6">
            <h3 className="mb-4 font-display font-semibold">Breakdown</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-2.5 text-left">Item</th>
                  <th className="w-32 py-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/40">
                  <td className="py-3">Subtotal</td>
                  <td className="text-right tabular-nums">{formatMoney(subtotal, expense.currency || "THB")}</td>
                </tr>
                <tr className="border-b border-border/40">
                  <td className="py-3">VAT 7%</td>
                  <td className="text-right tabular-nums">{formatMoney(vat, expense.currency || "THB")}</td>
                </tr>
                <tr>
                  <td className="py-3 font-bold">Total</td>
                  <td className="text-right font-bold tabular-nums">{formatMoney(expense.amount, expense.currency || "THB")}</td>
                </tr>
              </tbody>
            </table>
          </Card>

          <Card className="card-premium p-6">
            <Tabs defaultValue="activity">
              <TabsList className="bg-secondary">
                <TabsTrigger value="activity" className="gap-1.5">
                  <Activity className="h-4 w-4" /> Activity
                </TabsTrigger>
                <TabsTrigger value="related" className="gap-1.5">
                  <FileText className="h-4 w-4" /> Related
                </TabsTrigger>
                <TabsTrigger value="files" className="gap-1.5">
                  <Paperclip className="h-4 w-4" /> Files ({attachments.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="activity" className="mt-4 space-y-3 text-sm">
                <p className="text-muted-foreground">Created by Somchai B. - 5 days ago</p>
                {attachments.length > 0 ? (
                  <p className="text-muted-foreground">Receipt attached - 5 days ago</p>
                ) : null}
                {linkedPayments.map((payment) => (
                  <p key={payment.id} className="text-muted-foreground">
                    Payment {payment.id} recorded via {payment.paymentMethod} on {payment.paymentDate}
                  </p>
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
                  <p className="text-sm text-muted-foreground">No related documents.</p>
                )}
              </TabsContent>
              <TabsContent value="files" className="mt-4 space-y-3">
                <div className="rounded-xl border-2 border-dashed border-border p-6 text-center">
                  <Paperclip className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                  <p className="text-sm font-semibold">Attach receipts and supporting evidence</p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => setEvidenceOpen(true)}>
                    Attach Evidence
                  </Button>
                </div>
                {attachments.map((attachment) => (
                  <div key={attachment.id} className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                    <div className="flex items-center gap-3">
                      <Paperclip className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-sm">{attachment.name}</p>
                        <p className="text-xs text-muted-foreground">{attachment.uploadedAt}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => void downloadAttachment(attachment)}>
                      View
                    </Button>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="card-premium p-5">
            <h3 className="mb-3 text-sm font-display font-semibold">Summary</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Status</dt>
                <dd><StatusBadge status={expense.status} /></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Date</dt>
                <dd className="font-medium">{expense.date}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Method</dt>
                <dd className="font-medium">{expense.paymentMethod ?? "Bank transfer"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Currency</dt>
                <dd className="font-medium">{expense.currency || "THB"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">FX snapshot</dt>
                <dd className="font-medium">
                  {expense.baseCurrency && expense.exchangeRate
                    ? `${expense.baseCurrency} @ ${expense.exchangeRate} (${expense.snapshotDate || expense.date})`
                    : "Base currency"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Project</dt>
                <dd className="font-medium">{expense.projectName || expense.projectId || "-"}</dd>
              </div>
              {expense.paymentSummary ? (
                <>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Paid</dt>
                    <dd className="font-medium">{formatMoney(expense.paymentSummary.paid, expense.currency || "THB")}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Remaining</dt>
                    <dd className="font-medium">{formatMoney(expense.paymentSummary.remaining, expense.currency || "THB")}</dd>
                  </div>
                  {expense.paymentSummary.lastPaymentMethod ? (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Last payment</dt>
                      <dd className="font-medium">
                        {expense.paymentSummary.lastPaymentMethod} {expense.paymentSummary.lastPaymentDate || ""}
                      </dd>
                    </div>
                  ) : null}
                </>
              ) : null}
              <div className="flex justify-between border-t border-border pt-2">
                <dt className="text-muted-foreground">Total</dt>
                <dd className="font-bold tabular-nums">{formatMoney(expense.amount, expense.currency || "THB")}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>

      <EvidenceAttachmentModal
        open={evidenceOpen}
        onOpenChange={setEvidenceOpen}
        entityType="expense"
        entityId={expense.id}
        receive={{
          number: expense.id,
          date: expense.date,
          from: expense.vendor,
          amount: formatMoney(expense.amount, expense.currency || "THB"),
        }}
        onSaved={() => void reloadAttachments()}
      />

      <ExpenseModal
        open={editOpen}
        onOpenChange={setEditOpen}
        expense={expense}
        onSaved={(savedExpense) => setExpenseDetail(savedExpense)}
      />
    </AppShell>
  );
};

export default ExpenseDetail;

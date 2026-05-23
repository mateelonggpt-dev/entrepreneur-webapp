import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProcessingDialog } from "./ProcessingDialog";
import { createDocument } from "@/lib/api";
import { useAppData } from "@/lib/app-data";
import {
  addDaysToDateInputValue,
  buildInstallmentLines,
  buildInstallmentPlan,
  getLocalDateInputValue,
} from "@/lib/sales";
import { fmtTHB } from "@/lib/demo-data";
import type { SalesDocumentRecord } from "@/lib/types";
import { CalendarRange, Loader2, SplitSquareVertical } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  quotation: SalesDocumentRecord | null;
  onCreated?: (quotation: SalesDocumentRecord) => void;
}

export const InstallmentModal = ({ open, onOpenChange, quotation, onCreated }: Props) => {
  const { t } = useTranslation();
  const { refresh } = useAppData();
  const [splitMode, setSplitMode] = useState<"amount" | "quantity">("amount");
  const [installmentCount, setInstallmentCount] = useState(2);
  const [continueHistory, setContinueHistory] = useState(true);
  const [firstDate, setFirstDate] = useState(getLocalDateInputValue());
  const [spacingDays, setSpacingDays] = useState(30);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !quotation) {
      return;
    }

    setSplitMode(quotation.installmentSplitMode ?? "amount");
    setInstallmentCount(2);
    setContinueHistory(Boolean(quotation.installmentPlan?.length || quotation.installmentHistory?.length));
    setFirstDate(getLocalDateInputValue());
    setSpacingDays(30);
    setSubmitting(false);
  }, [open, quotation]);

  const lines = useMemo(() => quotation?.lines ?? [], [quotation?.lines]);
  const existingPlan = quotation?.installmentPlan ?? [];
  const existingHistory = quotation?.installmentHistory ?? [];
  const todayText = getLocalDateInputValue();

  const planPreview = useMemo(() => {
    if (!quotation?.id || !lines.length) {
      return [];
    }

    return buildInstallmentPlan({
      documentId: quotation.id,
      lines,
      splitMode,
      installmentCount,
    });
  }, [installmentCount, lines, quotation?.id, splitMode]);

  const handleSubmit = async () => {
    if (!quotation || !quotation.lines?.length) {
      toast.error(
        t("installmentModal.noLineItems", {
          defaultValue: "This quotation does not have any line items to split.",
        })
      );
      return;
    }

    const safeInstallmentCount = Math.max(1, installmentCount);
    setSubmitting(true);

    try {
      const createdInvoices: SalesDocumentRecord[] = [];

      for (let index = 0; index < safeInstallmentCount; index += 1) {
        const issueDate = addDaysToDateInputValue(firstDate, spacingDays * index);
        const created = await createDocument("invoice", {
          customer: quotation.customer,
          date: issueDate,
          due: addDaysToDateInputValue(issueDate, 30),
          reference: quotation.id,
          paymentTerms: quotation.paymentTerms ?? "Net 30",
          notes: t("installmentModal.lineNotes", {
            defaultValue: "Installment {{index}} created from quotation {{quotationId}}.",
            index: existingPlan.length + index + 1,
            quotationId: quotation.id,
          }),
          status: "pending",
          currency: quotation.currency ?? "THB",
          documentTypes: ["invoice"],
          primaryDocumentType: "invoice",
          documentTitle: t("installmentModal.invoiceTitle", { defaultValue: "Invoice" }),
          documentVariant: t("installmentModal.invoiceWorkflow", { defaultValue: "Installment / Split Payment" }),
          parentQuotationId: quotation.id,
          installmentSourceId: quotation.id,
          installmentIndex: existingPlan.length + index + 1,
          installmentCount:
            (continueHistory ? existingPlan.length : 0) + safeInstallmentCount,
          installmentSplitMode: splitMode,
          sourceDocumentId: quotation.id,
          sourceDocumentType: "quotation",
          relatedDocumentIds: [quotation.id],
          linkedDocumentIds: [quotation.id],
          referenceDocuments: [
            {
              id: quotation.id,
              number: quotation.id,
              type: "quotation",
              kind: "quotation",
              documentTypes: quotation.documentTypes ?? ["quotation"],
              party: quotation.customer,
              date: quotation.date,
              total: quotation.amount,
              amount: quotation.amount,
              status: quotation.status,
            },
          ],
          lines: buildInstallmentLines({
            lines: quotation.lines,
            splitMode,
            installmentCount: safeInstallmentCount,
            installmentIndex: index,
          }).map((line) => ({
            ...line,
            sourceDocumentId: quotation.id,
            sourceDocumentType: "quotation",
            sourceLineId: line.id,
          })),
          timeline: [
            {
              who: "Sales",
              what: t("installmentModal.timelineCreated", {
                defaultValue: "created installment {{index}} from {{quotationId}}",
                index: existingPlan.length + index + 1,
                quotationId: quotation.id,
              }),
              time: issueDate,
              type: "invoice",
            },
          ],
        });

        createdInvoices.push(created as SalesDocumentRecord);
      }

      const appendedPlan = planPreview.map((item, index) => ({
        ...item,
        label: `${t("installmentModal.installment", { defaultValue: "Installment" })} ${existingPlan.length + index + 1}`,
        relatedDocumentId: createdInvoices[index]?.id,
        status: createdInvoices[index]?.status ?? item.status,
      }));

      const appendedHistory = createdInvoices.map((invoice, index) => ({
        id: `${quotation.id}-history-${Date.now()}-${index}`,
        action: t("installmentModal.historyAction", {
          defaultValue: "Created installment {{index}}",
          index: existingPlan.length + index + 1,
        }),
        createdAt: invoice.date,
        createdDocumentId: invoice.id,
        amount: invoice.amount,
      }));

      const updatedQuotation = (await createDocument("quotation", {
        id: quotation.id,
        number: quotation.id,
        customer: quotation.customer,
        date: quotation.date,
        expiryDate: quotation.expiryDate ?? quotation.due ?? todayText,
        reference: quotation.reference,
        paymentTerms: quotation.paymentTerms,
        notes: quotation.notes,
        status: quotation.status,
        currency: quotation.currency ?? "THB",
        lines: quotation.lines,
        linkedDocumentIds: Array.from(
          new Set([
            ...(quotation.linkedDocumentIds ?? []),
            ...createdInvoices.map((invoice) => invoice.id),
          ])
        ),
        installmentSplitMode: splitMode,
        installmentCount:
          (continueHistory ? existingPlan.length : 0) + safeInstallmentCount,
        installmentPlan: continueHistory
          ? [...existingPlan, ...appendedPlan]
          : appendedPlan,
        installmentHistory: continueHistory
          ? [...existingHistory, ...appendedHistory]
          : appendedHistory,
        timeline: [
          ...(quotation.timeline ?? []),
          {
            who: "Sales",
            what: t("installmentModal.quotationTimeline", {
              defaultValue: "generated {{count}} installment invoice(s)",
              count: createdInvoices.length,
            }),
            time: todayText,
            type: "quotation",
          },
        ],
      })) as SalesDocumentRecord;

      await refresh();
      onCreated?.(updatedQuotation);
      onOpenChange(false);
      toast.success(t("installmentModal.success", {
        defaultValue: "{{count}} installment invoice(s) created",
        count: createdInvoices.length,
      }), {
        description: t("installmentModal.successDescription", {
          defaultValue: "Quotation {{quotationId}} now includes installment history.",
          quotationId: quotation.id,
        }),
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("installmentModal.createError", { defaultValue: "Unable to create installments." })
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl gap-0 overflow-hidden p-0">
          <div className="flex items-start gap-3 border-b border-border bg-card px-6 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-brand text-primary-foreground shadow-brand">
              <SplitSquareVertical className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold leading-tight">
                {t("installmentModal.title", { defaultValue: "Create Installment Documents" })}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("installmentModal.description", {
                  defaultValue:
                    "Split quotation {{id}} into staged invoices and continue the quotation history.",
                  id: quotation?.id ?? "-",
                })}
              </p>
            </div>
          </div>

          <div className="grid gap-6 bg-background px-6 py-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("installmentModal.splitMode", { defaultValue: "Split mode" })}</Label>
                  <Select value={splitMode} onValueChange={(value) => setSplitMode(value as "amount" | "quantity")}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="amount">{t("installmentModal.splitByAmount", { defaultValue: "Split by amount" })}</SelectItem>
                      <SelectItem value="quantity">{t("installmentModal.splitByQuantity", { defaultValue: "Split by quantity" })}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="installment-count">{t("installmentModal.installments", { defaultValue: "Installments" })}</Label>
                  <Input
                    id="installment-count"
                    type="number"
                    min={1}
                    max={12}
                    value={installmentCount}
                    onChange={(event) => setInstallmentCount(Number(event.target.value || 1))}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="installment-date">{t("installmentModal.firstIssueDate", { defaultValue: "First issue date" })}</Label>
                  <Input
                    id="installment-date"
                    type="date"
                    value={firstDate}
                    onChange={(event) => setFirstDate(event.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="installment-spacing">{t("installmentModal.spacingDays", { defaultValue: "Spacing days" })}</Label>
                  <Input
                    id="installment-spacing"
                    type="number"
                    min={1}
                    value={spacingDays}
                    onChange={(event) => setSpacingDays(Number(event.target.value || 30))}
                    className="mt-1.5"
                  />
                </div>
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-border/60 p-4 text-sm">
                <Checkbox
                  checked={continueHistory}
                  onCheckedChange={(value) => setContinueHistory(Boolean(value))}
                />
                <div>
                  <p className="font-semibold">{t("installmentModal.continueHistory", { defaultValue: "Continue existing installment history" })}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("installmentModal.continueHistoryHelp", {
                      defaultValue:
                        "Existing quotation history and generated installment references will be preserved and extended.",
                    })}
                  </p>
                </div>
              </label>

              <div className="rounded-2xl border border-border/60">
                <div className="grid grid-cols-[1fr_0.6fr_0.6fr] gap-3 border-b border-border/60 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>{t("installmentModal.installment", { defaultValue: "Installment" })}</span>
                  <span>{t("installmentModal.issueDate", { defaultValue: "Issue date" })}</span>
                  <span className="text-right">{t("installmentModal.amount", { defaultValue: "Amount" })}</span>
                </div>
                <div className="max-h-[280px] overflow-y-auto">
                  {planPreview.map((item, index) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-[1fr_0.6fr_0.6fr] gap-3 border-b border-border/40 px-4 py-3 text-sm last:border-0"
                    >
                      <div>
                        <p className="font-semibold">{existingPlan.length + index + 1}. {item.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {splitMode === "quantity" && "qty" in item && item.qty
                            ? t("installmentModal.qtyAllocated", {
                                defaultValue: "{{qty}} qty allocated",
                                qty: item.qty,
                              })
                            : t("installmentModal.amountBalanced", {
                                defaultValue: "Amount-balanced split",
                              })}
                        </p>
                      </div>
                      <span className="text-muted-foreground">
                        {addDaysToDateInputValue(firstDate, spacingDays * index)}
                      </span>
                      <span className="text-right font-semibold tabular-nums">{fmtTHB(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-secondary/30 p-4">
                <h3 className="font-display font-semibold">{t("installmentModal.summary", { defaultValue: "Quotation summary" })}</h3>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t("installmentModal.customer", { defaultValue: "Customer" })}</dt>
                    <dd>{quotation?.customer ?? "-"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t("installmentModal.currentInstallments", { defaultValue: "Current installments" })}</dt>
                    <dd>{existingPlan.length}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t("installmentModal.newDocuments", { defaultValue: "New documents" })}</dt>
                    <dd>{planPreview.length}</dd>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2 font-semibold">
                    <dt>{t("installmentModal.newInstallmentTotal", { defaultValue: "New installment total" })}</dt>
                    <dd className="tabular-nums">
                      {fmtTHB(planPreview.reduce((sum, item) => sum + item.amount, 0))}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-2xl border border-border/60 p-4 text-sm">
                <div className="flex items-start gap-3">
                  <CalendarRange className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <p className="font-semibold">{t("installmentModal.schedulingNote", { defaultValue: "Scheduling note" })}</p>
                    <p className="mt-1 text-muted-foreground">
                      {t("installmentModal.schedulingHelp", {
                        defaultValue:
                          "Each installment invoice is created immediately and linked back to the parent quotation.",
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border bg-card px-6 py-3.5">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              className="border-0 bg-gradient-brand text-primary-foreground shadow-brand"
              onClick={() => void handleSubmit()}
              disabled={submitting || !quotation}
            >
              {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {t("installmentModal.createButton", { defaultValue: "Create Installments" })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ProcessingDialog
        open={submitting}
        title={t("installmentModal.creatingTitle", { defaultValue: "Creating installment documents..." })}
        message={t("installmentModal.creatingMessage", {
          defaultValue: "Generating linked invoice records and updating the quotation history.",
        })}
      />
    </>
  );
};

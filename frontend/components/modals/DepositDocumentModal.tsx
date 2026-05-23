import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProcessingDialog } from "./ProcessingDialog";
import { createDocument } from "@/lib/api";
import { useAppData } from "@/lib/app-data";
import { getDocumentAmount, getLocalDateInputValue } from "@/lib/sales";
import { fmtTHB } from "@/lib/demo-data";
import type { SalesDocumentRecord } from "@/lib/types";
import { BadgePercent, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  quotation: SalesDocumentRecord | null;
  onCreated?: (quotation: SalesDocumentRecord) => void;
}

export const DepositDocumentModal = ({
  open,
  onOpenChange,
  quotation,
  onCreated,
}: Props) => {
  const { t } = useTranslation();
  const { refresh } = useAppData();
  const [mode, setMode] = useState<"percentage" | "manual">("percentage");
  const [percentage, setPercentage] = useState(30);
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(getLocalDateInputValue());
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const quotationTotal = quotation ? getDocumentAmount(quotation) : 0;

  useEffect(() => {
    if (!open || !quotation) {
      return;
    }

    setMode("percentage");
    setPercentage(30);
    setAmount(Number((quotationTotal * 0.3).toFixed(2)));
    setDate(getLocalDateInputValue());
    setNotes(
      t("depositModal.defaultNotes", {
        defaultValue: "Deposit requested for quotation {{quotationId}}.",
        quotationId: quotation.id,
      })
    );
    setSubmitting(false);
  }, [open, quotation, quotationTotal, t]);

  useEffect(() => {
    if (mode !== "percentage") {
      return;
    }

    setAmount(Number(((quotationTotal * percentage) / 100).toFixed(2)));
  }, [mode, percentage, quotationTotal]);

  const depositRatio = useMemo(
    () => (quotationTotal > 0 ? (amount / quotationTotal) * 100 : 0),
    [amount, quotationTotal]
  );

  const handleSubmit = async () => {
    if (!quotation) {
      return;
    }

    if (amount <= 0) {
      toast.error(
        t("depositModal.invalidAmount", {
          defaultValue: "Deposit amount must be greater than zero.",
        })
      );
      return;
    }

    setSubmitting(true);

    try {
      const created = await createDocument("deposit", {
        customer: quotation.customer,
        date,
        due: date,
        amount,
        currency: quotation.currency ?? "THB",
        status: "draft",
        documentVariant: mode === "percentage" ? "quotation-deposit" : "manual-deposit",
        parentQuotationId: quotation.id,
        sourceDocumentId: quotation.id,
        sourceDocumentType: "quotation",
        linkedDocumentIds: [quotation.id],
        notes,
        lines: [
          {
            id: "1",
            desc: t("depositModal.lineDescription", {
              defaultValue: "Deposit for quotation {{quotationId}}",
              quotationId: quotation.id,
            }),
            qty: 1,
            price: amount,
            tax: 0,
          },
        ],
        timeline: [
          {
            who: "Sales",
            what: t("depositModal.timelineCreated", {
              defaultValue: "created deposit document from {{quotationId}}",
              quotationId: quotation.id,
            }),
            time: date,
            type: "deposit",
            amount,
          },
        ],
      });

      const updatedQuotation = (await createDocument("quotation", {
        id: quotation.id,
        number: quotation.id,
        customer: quotation.customer,
        date: quotation.date,
        expiryDate: quotation.expiryDate ?? quotation.due ?? quotation.date,
        reference: quotation.reference,
        paymentTerms: quotation.paymentTerms,
        notes: quotation.notes,
        status: quotation.status,
        currency: quotation.currency ?? "THB",
        lines: quotation.lines ?? [],
        linkedDocumentIds: Array.from(
          new Set([...(quotation.linkedDocumentIds ?? []), created.id])
        ),
        timeline: [
          ...(quotation.timeline ?? []),
          {
            who: "Sales",
            what: t("depositModal.quotationTimeline", {
              defaultValue: "created deposit request {{depositId}}",
              depositId: created.id,
            }),
            time: date,
            type: "deposit",
            amount,
          },
        ],
      })) as SalesDocumentRecord;

      await refresh();
      onCreated?.(updatedQuotation);
      onOpenChange(false);
      toast.success(t("depositModal.success", {
        defaultValue: "Deposit {{id}} created",
        id: created.id,
      }), {
        description: t("depositModal.successDescription", {
          defaultValue: "Linked to quotation {{quotationId}}.",
          quotationId: quotation.id,
        }),
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("depositModal.createError", { defaultValue: "Unable to create deposit document." })
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0">
          <div className="flex items-start gap-3 border-b border-border bg-card px-6 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-brand text-primary-foreground shadow-brand">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold leading-tight">
                {t("depositModal.title", { defaultValue: "Create Deposit Document" })}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("depositModal.description", {
                  defaultValue:
                    "Request a deposit from quotation {{id}} and keep the downstream link.",
                  id: quotation?.id ?? "-",
                })}
              </p>
            </div>
          </div>

          <div className="grid gap-6 bg-background px-6 py-5 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("depositModal.mode", { defaultValue: "Mode" })}</Label>
                  <Select value={mode} onValueChange={(value) => setMode(value as "percentage" | "manual")}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">{t("depositModal.percentageMode", { defaultValue: "Percentage of quotation" })}</SelectItem>
                      <SelectItem value="manual">{t("depositModal.manualMode", { defaultValue: "Manual amount" })}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="deposit-date">{t("depositModal.documentDate", { defaultValue: "Document date" })}</Label>
                  <Input
                    id="deposit-date"
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>

              {mode === "percentage" ? (
                <div>
                  <Label htmlFor="deposit-percentage">{t("depositModal.percentage", { defaultValue: "Deposit percentage" })}</Label>
                  <Input
                    id="deposit-percentage"
                    type="number"
                    min={1}
                    max={100}
                    value={percentage}
                    onChange={(event) => setPercentage(Number(event.target.value || 0))}
                    className="mt-1.5"
                  />
                </div>
              ) : null}

              <div>
                <Label htmlFor="deposit-amount">{t("depositModal.amount", { defaultValue: "Deposit amount" })}</Label>
                <Input
                  id="deposit-amount"
                  type="number"
                  min={0}
                  value={amount}
                  onChange={(event) => {
                    setMode("manual");
                    setAmount(Number(event.target.value || 0));
                  }}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="deposit-notes">{t("depositModal.notes", { defaultValue: "Notes" })}</Label>
                <Textarea
                  id="deposit-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="mt-1.5 min-h-[120px]"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-secondary/30 p-4">
                <h3 className="font-display font-semibold">{t("depositModal.summary", { defaultValue: "Deposit summary" })}</h3>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t("depositModal.quotationTotal", { defaultValue: "Quotation total" })}</dt>
                    <dd className="tabular-nums">{fmtTHB(quotationTotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t("depositModal.amount", { defaultValue: "Deposit amount" })}</dt>
                    <dd className="tabular-nums">{fmtTHB(amount)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2 font-semibold">
                    <dt>{t("depositModal.depositRatio", { defaultValue: "Deposit ratio" })}</dt>
                    <dd>{depositRatio.toFixed(2)}%</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-2xl border border-border/60 p-4 text-sm">
                <div className="flex items-start gap-3">
                  <BadgePercent className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <p className="font-semibold">{t("depositModal.linkageTitle", { defaultValue: "Downstream linkage" })}</p>
                    <p className="mt-1 text-muted-foreground">
                      {t("depositModal.linkageHelp", {
                        defaultValue:
                          "The deposit document is stored separately and linked back to the source quotation for follow-up.",
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
              {t("depositModal.createButton", { defaultValue: "Create Deposit" })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ProcessingDialog
        open={submitting}
        title={t("depositModal.creatingTitle", { defaultValue: "Creating deposit..." })}
        message={t("depositModal.creatingMessage", {
          defaultValue: "Saving the deposit document and linking it to the quotation.",
        })}
      />
    </>
  );
};

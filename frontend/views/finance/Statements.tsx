import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/lib/app-data";
import { fmtTHB } from "@/lib/demo-data";
import { formatMoney } from "@/lib/currency";
import { downloadReport } from "@/lib/api";
import { FileBarChart, Percent, ReceiptText, Wallet } from "lucide-react";
import { toast } from "sonner";

const Statements = () => {
  const { data } = useAppData();

  const pettyCashMovements = data.accountMovements.filter((movement) => movement.accountType === "petty_cash");
  const chequeRows = data.vendorPayments.filter((payment) => payment.paymentMethod === "Cheque");

  const handleDownload = async (reportKey: string, label: string) => {
    try {
      await downloadReport(reportKey);
      toast.success(`${label} downloaded`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Unable to download ${label}.`);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Statements"
        description="Movement center for balance, aging, receipt/payment, petty cash, cheque, and financial account reports."
        breadcrumbs={[{ label: "Finance & Reports" }, { label: "Statements" }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void handleDownload("balance-sheet", "Balance Sheet")}>
              <FileBarChart className="mr-1.5 h-4 w-4" /> Balance Sheet
            </Button>
            <Button variant="outline" size="sm" onClick={() => void handleDownload("vat-summary", "VAT summary")}>
              <Percent className="mr-1.5 h-4 w-4" /> VAT Summary
            </Button>
            <Button variant="outline" size="sm" onClick={() => void handleDownload("financial-account-movement", "Financial account movement")}>
              <Wallet className="mr-1.5 h-4 w-4" /> Account Movement
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="card-premium p-6">
          <h2 className="font-display font-semibold">Balance sheet</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Cash</span><span className="font-semibold">{fmtTHB(data.balanceSheet.cash)}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Accounts receivable</span><span className="font-semibold">{fmtTHB(data.balanceSheet.accountsReceivable)}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Input VAT</span><span className="font-semibold">{fmtTHB(data.balanceSheet.inputVatRecoverable)}</span></div>
            <div className="border-t border-border/50 pt-3" />
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Accounts payable</span><span className="font-semibold">{fmtTHB(data.balanceSheet.accountsPayable)}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Output VAT</span><span className="font-semibold">{fmtTHB(data.balanceSheet.outputVatPayable)}</span></div>
            <div className="border-t border-border/50 pt-3" />
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Assets</span><span className="font-semibold">{fmtTHB(data.balanceSheet.assets)}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Liabilities</span><span className="font-semibold">{fmtTHB(data.balanceSheet.liabilities)}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Equity</span><span className="font-semibold">{fmtTHB(data.balanceSheet.equity)}</span></div>
          </div>
        </Card>

        <Card className="card-premium p-6">
          <div className="flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-primary" />
            <h2 className="font-display font-semibold">Receivable aging</h2>
          </div>
          <div className="mt-4 space-y-3">
            {data.receivablesAging.map((bucket) => (
              <div key={bucket.bucket} className="rounded-xl border border-border/50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{bucket.bucket}</p>
                  <p className="text-sm font-semibold">{fmtTHB(bucket.amount)}</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{bucket.count} document(s)</p>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="mt-4" onClick={() => void handleDownload("aging-receivables", "Receivable aging")}>
            Download aging
          </Button>
        </Card>

        <Card className="card-premium p-6">
          <div className="flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-warning" />
            <h2 className="font-display font-semibold">Payable aging</h2>
          </div>
          <div className="mt-4 space-y-3">
            {data.payablesAging.map((bucket) => (
              <div key={bucket.bucket} className="rounded-xl border border-border/50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{bucket.bucket}</p>
                  <p className="text-sm font-semibold">{fmtTHB(bucket.amount)}</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{bucket.count} document(s)</p>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="mt-4" onClick={() => void handleDownload("aging-payables", "Payable aging")}>
            Download aging
          </Button>
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-4">
        {[
          ["receipt-payment-register", "Receipt / Payment Register", "Customer receipts and outgoing vendor payments."],
          ["financial-account-movement", "Cash Movement", "Cross-account movement report for all channels."],
          ["petty-cash-movement", "Petty Cash Movement", "Top ups, spend, and hand-cash tracking."],
          ["cheque-summary", "Cheque Summary", "Cheque issue, deposit, and cleared-date visibility."],
        ].map(([key, title, description]) => (
          <Card key={key} className="card-premium p-5">
            <p className="text-sm font-semibold">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => void handleDownload(key, title)}>
              Download
            </Button>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="card-premium p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display font-semibold">Recent petty cash movement</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Use this view to reconcile office cash top ups and spend.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => void handleDownload("petty-cash-movement", "Petty cash movement")}>
              Export
            </Button>
          </div>
          <div className="space-y-3">
            {pettyCashMovements.slice(0, 6).map((movement) => (
              <div key={movement.id} className="flex items-center justify-between rounded-xl border border-border/50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">{movement.memo}</p>
                  <p className="text-xs text-muted-foreground">
                    {movement.date} - {movement.sourceId} - {movement.counterparty || movement.counterAccountName || "-"}
                  </p>
                </div>
                <p className={`text-sm font-semibold ${movement.direction === "in" ? "text-success" : "text-warning"}`}>
                  {movement.direction === "in" ? "+" : "-"}{formatMoney(movement.amount, movement.currency || "THB")}
                </p>
              </div>
            ))}
            {pettyCashMovements.length === 0 ? <p className="text-sm text-muted-foreground">No petty cash movement recorded yet.</p> : null}
          </div>
        </Card>

        <Card className="card-premium p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display font-semibold">Cheque receive / pay summaries</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Centralized cheque lifecycle visibility, even before bank import exists.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => void handleDownload("cheque-summary", "Cheque summary")}>
              Export
            </Button>
          </div>
          <div className="space-y-3">
            {chequeRows.slice(0, 6).map((payment) => (
              <div key={payment.id} className="rounded-xl border border-border/50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{payment.vendor}</p>
                    <p className="text-xs text-muted-foreground">{payment.id} - {payment.accountName || payment.accountNumber || payment.paymentMethod}</p>
                  </div>
                  <p className="text-sm font-semibold">{formatMoney(payment.amount, payment.currency || "THB")}</p>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <p>Cheque date: {payment.chequeDate || "-"}</p>
                  <p>Cut date: {payment.chequeCutDate || "-"}</p>
                  <p>Deposit date: {payment.chequeDepositDate || "-"}</p>
                  <p>Cleared date: {payment.chequeClearedDate || "-"}</p>
                </div>
              </div>
            ))}
            {chequeRows.length === 0 ? <p className="text-sm text-muted-foreground">No cheque activity recorded yet.</p> : null}
          </div>
        </Card>
      </div>
    </AppShell>
  );
};

export default Statements;

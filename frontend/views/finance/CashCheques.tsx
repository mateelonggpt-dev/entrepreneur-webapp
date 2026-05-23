import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { MasterDataModal, PaymentActionModal } from "@/components/modals/DomainModals";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/ui-kit/KpiCard";
import { Button } from "@/components/ui/button";
import { ListToolbar } from "@/components/ui-kit/ListToolbar";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { exportResource } from "@/lib/api";
import { useAppData } from "@/lib/app-data";
import { fmtTHB } from "@/lib/demo-data";
import { formatMoney } from "@/lib/currency";
import type { FinanceAccount } from "@/lib/types";
import { ArrowDownRight, ArrowUpRight, Coins, ReceiptText } from "lucide-react";
import { toast } from "sonner";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  bank: "Bank",
  petty_cash: "Petty Cash",
  cheque_payable: "Cheque Payable",
  credit_card_payable: "Credit Card Payable",
  payment_gateway: "EDC / POS / Gateway",
};

const CashCheques = () => {
  const nav = useNavigate();
  const location = useLocation();
  const { data } = useAppData();
  const { accountMovements, financeAccounts } = data;
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<
    "all" | "petty_cash" | "cheque_payable" | "credit_card_payable" | "payment_gateway" | "bank"
  >("all");
  const [selectedAccount, setSelectedAccount] = useState<FinanceAccount | null>(null);
  const [pettyCashModalOpen, setPettyCashModalOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [movementMode, setMovementMode] = useState<"top_up" | "transfer">("top_up");
  const [movementSourceAccountNumber, setMovementSourceAccountNumber] = useState<string | undefined>(undefined);
  const [movementDestinationAccountNumber, setMovementDestinationAccountNumber] = useState<string | undefined>(undefined);

  const filteredAccounts = useMemo(() => {
    const searchLower = search.trim().toLowerCase();
    return financeAccounts.filter((account) => {
      const matchesSearch =
        !searchLower ||
        account.name.toLowerCase().includes(searchLower) ||
        account.number.toLowerCase().includes(searchLower) ||
        (account.institution ?? "").toLowerCase().includes(searchLower);
      const matchesType = typeFilter === "all" || (account.accountType ?? "bank") === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [financeAccounts, search, typeFilter]);

  const pettyCashAccounts = useMemo(
    () => financeAccounts.filter((account) => account.accountType === "petty_cash"),
    [financeAccounts]
  );

  const pettyCashMovements = useMemo(
    () => accountMovements.filter((movement) => movement.accountType === "petty_cash"),
    [accountMovements]
  );

  const selectedAccountMovements = useMemo(
    () =>
      selectedAccount
        ? accountMovements.filter((movement) => movement.accountNumber === selectedAccount.number).slice(0, 10)
        : [],
    [accountMovements, selectedAccount]
  );

  const totalInflows = useMemo(
    () => accountMovements.filter((movement) => movement.direction === "in").reduce((sum, movement) => sum + movement.amount, 0),
    [accountMovements]
  );

  const totalOutflows = useMemo(
    () => accountMovements.filter((movement) => movement.direction === "out").reduce((sum, movement) => sum + movement.amount, 0),
    [accountMovements]
  );

  const pettyCashBalance = useMemo(
    () => pettyCashAccounts.reduce((sum, account) => sum + account.balance, 0),
    [pettyCashAccounts]
  );

  const openMovement = ({
    mode,
    sourceAccountNumber,
    destinationAccountNumber,
  }: {
    mode: "top_up" | "transfer";
    sourceAccountNumber?: string;
    destinationAccountNumber?: string;
  }) => {
    setMovementMode(mode);
    setMovementSourceAccountNumber(sourceAccountNumber);
    setMovementDestinationAccountNumber(destinationAccountNumber);
    setMovementOpen(true);
  };

  const handleExport = async () => {
    try {
      await exportResource("account-movements");
      toast.success("Movement report downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to export the movement report.");
    }
  };

  return (
    <AppShell>
      <PageHeader
        title={location.pathname.includes("petty-cash") ? "Payment / Petty Cash" : "Payment / Cheques"}
        description="Monitor petty cash, cheque flows, and account-level movement logs across your financial channels."
        breadcrumbs={[{ label: "Payment" }, { label: location.pathname.includes("petty-cash") ? "Petty Cash" : "Cheques" }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setPettyCashModalOpen(true)}>
              Create petty cash
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                openMovement({
                  mode: "top_up",
                  destinationAccountNumber: pettyCashAccounts[0]?.number,
                })
              }
              disabled={pettyCashAccounts.length === 0}
            >
              Top up petty cash
            </Button>
            <Button variant="outline" size="sm" onClick={() => openMovement({ mode: "transfer" })}>
              Transfer out
            </Button>
            <Button variant="outline" size="sm" onClick={() => void handleExport()}>
              <ReceiptText className="mr-1.5 h-4 w-4" /> Export movement report
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total cash" value={fmtTHB(data.financeSummary.totalCash)} icon={<Coins className="h-4 w-4" />} accent="primary" />
        <KpiCard label="Petty cash balance" value={fmtTHB(pettyCashBalance)} icon={<Coins className="h-4 w-4" />} accent="warning" />
        <KpiCard label="Cash in" value={fmtTHB(totalInflows)} icon={<ArrowUpRight className="h-4 w-4" />} accent="success" />
        <KpiCard label="Cash out" value={fmtTHB(totalOutflows)} icon={<ArrowDownRight className="h-4 w-4" />} accent="info" />
      </div>

      <ListToolbar
        searchPlaceholder="Search channel, account, institution..."
        searchValue={search}
        onSearchChange={setSearch}
        onExportClick={() => void handleExport()}
        extra={
          <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as typeof typeFilter)}>
            <SelectTrigger className="w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All channels</SelectItem>
              <SelectItem value="petty_cash">Petty Cash</SelectItem>
              <SelectItem value="cheque_payable">Cheque Payable</SelectItem>
              <SelectItem value="credit_card_payable">Credit Card</SelectItem>
              <SelectItem value="payment_gateway">Gateway / POS</SelectItem>
              <SelectItem value="bank">Bank</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="card-premium p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display font-semibold">Movement log</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Filterable account activity sourced from receipts, payments, direct spend, and internal transfers.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => nav("/reports")}>
              Open reports
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold">Date</th>
                  <th className="px-3 py-3 text-left font-semibold">Account</th>
                  <th className="px-3 py-3 text-left font-semibold">Activity</th>
                  <th className="px-3 py-3 text-left font-semibold">Source</th>
                  <th className="px-3 py-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {accountMovements.map((movement) => (
                  <tr key={movement.id} className="border-t border-border/50">
                    <td className="px-3 py-3">{movement.date}</td>
                    <td className="px-3 py-3">
                      <p className="font-medium">{movement.accountName}</p>
                      <p className="text-xs text-muted-foreground">{ACCOUNT_TYPE_LABELS[movement.accountType ?? "bank"]}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium">{movement.memo}</p>
                      <p className="text-xs text-muted-foreground">{movement.counterparty || movement.counterAccountName || "-"}</p>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs font-semibold text-primary">{movement.sourceId}</td>
                    <td className={`px-3 py-3 text-right font-semibold ${movement.direction === "in" ? "text-success" : "text-warning"}`}>
                      {movement.direction === "in" ? "+" : "-"}{formatMoney(movement.amount, movement.currency || "THB")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="card-premium p-6">
          <div className="mb-4">
            <h2 className="font-display font-semibold">Account balances</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Open a detail panel for recent linked activity and channel status.</p>
          </div>
          <div className="space-y-3">
            {filteredAccounts.length > 0 ? (
              filteredAccounts.map((account) => (
                <button
                  key={account.number}
                  className="w-full rounded-xl border border-border/50 px-4 py-3 text-left transition hover:bg-secondary/40"
                  onClick={() => setSelectedAccount(account)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{account.name}</p>
                      <p className="text-xs text-muted-foreground">{ACCOUNT_TYPE_LABELS[account.accountType ?? "bank"]}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatMoney(account.balance, account.currency ?? "THB")}</p>
                      <div className="mt-1">
                        <StatusBadge status={account.status ?? "active"} />
                      </div>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <EmptyState title="No channels match this filter" description="Try a different search or channel type." />
            )}
          </div>
        </Card>
      </div>

      <Card className="card-premium mt-6 p-6">
        <div className="mb-4">
          <h2 className="font-display font-semibold">Petty cash focus</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Use these rows for day-to-day top ups, operating spend checks, and hand-cash reviews.</p>
        </div>
        <div className="space-y-3">
          {pettyCashMovements.length > 0 ? (
            pettyCashMovements.slice(0, 6).map((movement) => (
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
            ))
          ) : (
            <EmptyState
              title="No petty cash activity yet"
              description="Create a petty cash account, top it up, or spend through a linked payment flow."
            />
          )}
        </div>
      </Card>

      <MasterDataModal
        kind="financial_account"
        open={pettyCashModalOpen}
        onOpenChange={setPettyCashModalOpen}
        defaultAccountType="petty_cash"
      />

      <PaymentActionModal
        kind="finance_movement"
        open={movementOpen}
        onOpenChange={setMovementOpen}
        defaultMode={movementMode}
        presetSourceAccountNumber={movementSourceAccountNumber}
        presetDestinationAccountNumber={movementDestinationAccountNumber}
      />

      <Sheet open={Boolean(selectedAccount)} onOpenChange={(nextOpen) => !nextOpen && setSelectedAccount(null)}>
        <SheetContent className="sm:max-w-lg">
          {selectedAccount ? (
            <>
              <SheetHeader>
                <SheetTitle>{selectedAccount.name}</SheetTitle>
                <SheetDescription>{selectedAccount.number}</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-border/60 p-4">
                  <p className="text-xs text-muted-foreground">Channel type</p>
                  <p className="mt-1 font-semibold">{ACCOUNT_TYPE_LABELS[selectedAccount.accountType ?? "bank"]}</p>
                </div>
                <div className="rounded-xl border border-border/60 p-4">
                  <p className="text-xs text-muted-foreground">Institution / channel</p>
                  <p className="mt-1 font-semibold">{selectedAccount.institution || "-"}</p>
                </div>
                <div className="rounded-xl border border-border/60 p-4">
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p className="mt-1 font-semibold">{formatMoney(selectedAccount.balance, selectedAccount.currency ?? "THB")}</p>
                </div>
                <div className="rounded-xl border border-border/60 p-4">
                  <p className="text-xs text-muted-foreground">Recent linked activity</p>
                  <div className="mt-3 space-y-2">
                    {selectedAccountMovements.length > 0 ? (
                      selectedAccountMovements.map((movement) => (
                        <div key={movement.id} className="flex items-start justify-between rounded-lg border border-border/50 px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{movement.memo}</p>
                            <p className="text-xs text-muted-foreground">
                              {movement.date} - {movement.sourceId}
                            </p>
                          </div>
                          <p className={`text-sm font-semibold ${movement.direction === "in" ? "text-success" : "text-warning"}`}>
                            {movement.direction === "in" ? "+" : "-"}{formatMoney(movement.amount, movement.currency || "THB")}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No recent movements for this channel.</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() =>
                      openMovement(
                        selectedAccount.accountType === "petty_cash"
                          ? {
                              mode: "top_up",
                              destinationAccountNumber: selectedAccount.number,
                            }
                          : {
                              mode: "transfer",
                              sourceAccountNumber: selectedAccount.number,
                            }
                      )
                    }
                  >
                    {selectedAccount.accountType === "petty_cash" ? "Top Up" : "Transfer"}
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => nav("/reports")}>
                    Open reports
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
};

export default CashCheques;

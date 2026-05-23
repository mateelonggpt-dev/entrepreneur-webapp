import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { MasterDataModal, PaymentActionModal } from "@/components/modals/DomainModals";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/ui-kit/KpiCard";
import { Button } from "@/components/ui/button";
import { ListToolbar } from "@/components/ui-kit/ListToolbar";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ArrowUpRight,
  BadgePercent,
  ChevronRight,
  Coins,
  Landmark,
  Plus,
  ReceiptText,
  Scale,
} from "lucide-react";
import { fmtTHB } from "@/lib/demo-data";
import { formatMoney } from "@/lib/currency";
import { useAppData } from "@/lib/app-data";
import type { FinanceAccount } from "@/lib/types";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  bank: "Bank",
  petty_cash: "Petty Cash",
  cheque_payable: "Cheque Payable",
  credit_card_payable: "Credit Card Payable",
  payment_gateway: "EDC / POS / Gateway",
};

const Finance = () => {
  const nav = useNavigate();
  const location = useLocation();
  const { data } = useAppData();
  const { financeAccounts: accounts, financeSummary, accountMovements, vatSummary, balanceSheet } = data;
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinanceAccount | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<FinanceAccount | null>(null);
  const [movementOpen, setMovementOpen] = useState(false);
  const [movementMode, setMovementMode] = useState<"top_up" | "transfer">("transfer");
  const [movementSourceAccountNumber, setMovementSourceAccountNumber] = useState<string | undefined>(undefined);
  const [movementDestinationAccountNumber, setMovementDestinationAccountNumber] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<
    "all" | "bank" | "petty_cash" | "cheque_payable" | "credit_card_payable" | "payment_gateway"
  >("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const filteredAccounts = useMemo(() => {
    const searchLower = search.trim().toLowerCase();
    return accounts.filter((account) => {
      const type = account.accountType ?? "bank";
      const status = account.status ?? "active";
      const matchesSearch =
        !searchLower ||
        account.name.toLowerCase().includes(searchLower) ||
        account.number.toLowerCase().includes(searchLower) ||
        (account.institution ?? "").toLowerCase().includes(searchLower);
      const matchesType = typeFilter === "all" || type === typeFilter;
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [accounts, search, statusFilter, typeFilter]);

  const accountCashIn = useMemo(
    () => accountMovements.filter((movement) => movement.direction === "in").reduce((sum, movement) => sum + movement.amount, 0),
    [accountMovements]
  );

  const accountCashOut = useMemo(
    () => accountMovements.filter((movement) => movement.direction === "out").reduce((sum, movement) => sum + movement.amount, 0),
    [accountMovements]
  );

  const selectedAccountMovements = useMemo(
    () =>
      selectedAccount
        ? accountMovements.filter((movement) => movement.accountNumber === selectedAccount.number).slice(0, 6)
        : [],
    [accountMovements, selectedAccount]
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

  return (
    <AppShell>
      <PageHeader
        title={location.pathname.includes("/accounts") ? "Payment / Bank / Cash Accounts" : "Payment / Overview"}
        description="Bank accounts, cash channels, internal transfers, cheque and petty cash readiness in one payment section."
        breadcrumbs={[{ label: "Payment" }, { label: location.pathname.includes("/accounts") ? "Bank / Cash Accounts" : "Overview" }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => openMovement({ mode: "transfer" })}>
              Transfer funds
            </Button>
            <Button
              size="sm"
              className="gap-1.5 border-0 bg-gradient-brand text-primary-foreground shadow-brand"
              onClick={() => {
                setEditingAccount(null);
                setAccountModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add account
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total cash" value={fmtTHB(financeSummary.totalCash)} icon={<Coins className="h-4 w-4" />} hint="Live from account balances" accent="primary" />
        <KpiCard label="Account inflows" value={fmtTHB(accountCashIn)} icon={<ArrowUpRight className="h-4 w-4" />} hint="Actual receipt and internal movement feed" accent="success" />
        <KpiCard label="Bank accounts" value={String(financeSummary.bankAccounts)} icon={<Landmark className="h-4 w-4" />} hint="Connected internal channels" accent="info" />
        <KpiCard label="Posting coverage" value={`${financeSummary.postingCoverage}%`} icon={<Scale className="h-4 w-4" />} hint="Documents converted to ledger entries" accent="warning" />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="card-premium p-6">
          <div className="mb-4 flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-success" />
            <h3 className="font-display font-semibold">Cash movement</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Inflows</span>
              <span className="font-semibold text-success">{fmtTHB(accountCashIn)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Outflows</span>
              <span className="font-semibold text-warning">{fmtTHB(accountCashOut)}</span>
            </div>
            <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => nav("/finance/cash")}>
              Open Cash & Cheques <ChevronRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </Card>

        <Card className="card-premium p-6">
          <div className="mb-4 flex items-center gap-2">
            <BadgePercent className="h-4 w-4 text-primary" />
            <h3 className="font-display font-semibold">Tax position</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Output VAT</span>
              <span className="font-semibold">{fmtTHB(vatSummary.outputTax)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Input VAT</span>
              <span className="font-semibold">{fmtTHB(vatSummary.inputTax)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Net VAT</span>
              <span className="font-semibold">{fmtTHB(vatSummary.netVatPayable)}</span>
            </div>
            <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => nav("/reports")}>
              Open Reports <ChevronRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </Card>

        <Card className="card-premium p-6">
          <div className="mb-4 flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-primary" />
            <h3 className="font-display font-semibold">Balance snapshot</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Assets</span>
              <span className="font-semibold">{fmtTHB(balanceSheet.assets)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Liabilities</span>
              <span className="font-semibold">{fmtTHB(balanceSheet.liabilities)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Equity</span>
              <span className="font-semibold">{fmtTHB(balanceSheet.equity)}</span>
            </div>
            <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => nav("/finance/journal")}>
              Open Journal <ChevronRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </Card>
      </div>

      <ListToolbar
        searchPlaceholder="Search account, number, institution..."
        searchValue={search}
        onSearchChange={setSearch}
        primaryAction={{
          label: "Add Account",
          onClick: () => {
            setEditingAccount(null);
            setAccountModalOpen(true);
          },
        }}
        extra={
          <>
            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as typeof typeFilter)}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All account types</SelectItem>
                <SelectItem value="bank">Bank</SelectItem>
                <SelectItem value="petty_cash">Petty Cash</SelectItem>
                <SelectItem value="cheque_payable">Cheque Payable</SelectItem>
                <SelectItem value="credit_card_payable">Credit Card</SelectItem>
                <SelectItem value="payment_gateway">Gateway / POS</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filteredAccounts.length > 0 ? (
          filteredAccounts.map((account) => (
            <Card
              key={account.number}
              className="card-premium group relative cursor-pointer overflow-hidden p-6 transition hover:shadow-premium"
              onClick={() => setSelectedAccount(account)}
            >
              {account.primary ? (
                <span className="absolute right-4 top-4 rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                  Primary
                </span>
              ) : null}
              <div className="mb-4 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-brand shadow-brand">
                  <Landmark className="h-6 w-6 text-primary-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display font-semibold">{account.name}</h3>
                  <p className="font-mono text-xs text-muted-foreground">{account.number}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{ACCOUNT_TYPE_LABELS[account.accountType ?? "bank"]}</p>
                </div>
                <StatusBadge status={account.status ?? "active"} />
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Available balance</p>
                  <p className="text-2xl font-display font-bold tabular-nums">
                    {formatMoney(account.balance, account.currency ?? "THB")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 opacity-60 group-hover:opacity-100"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedAccount(account);
                  }}
                >
                  View <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </Card>
          ))
        ) : (
          <Card className="card-premium lg:col-span-2">
            <EmptyState
              title="No finance accounts match this view"
              description="Adjust the search or filters, or add a new account to track bank, cash, and settlement channels."
              action={{
                label: "Add Account",
                onClick: () => {
                  setEditingAccount(null);
                  setAccountModalOpen(true);
                },
              }}
            />
          </Card>
        )}
      </div>

      <Card className="card-premium mt-6 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-display font-semibold">Latest account movements</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Derived from receipts, vendor payments, direct expense spend, and manual finance transfers.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => nav("/finance/cash")}>
            View all <ChevronRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
        <div className="space-y-2">
          {accountMovements.slice(0, 5).map((movement) => (
            <div key={movement.id} className="flex items-center justify-between rounded-xl border border-border/50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{movement.counterparty || movement.accountName}</p>
                <p className="text-xs text-muted-foreground">
                  {movement.sourceId} - {movement.accountName}
                </p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${movement.direction === "in" ? "text-success" : "text-warning"}`}>
                  {movement.direction === "in" ? "+" : "-"}{formatMoney(movement.amount, movement.currency || "THB")}
                </p>
                <p className="text-xs text-muted-foreground">{movement.date}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <MasterDataModal kind="financial_account" open={accountModalOpen} onOpenChange={setAccountModalOpen} account={editingAccount} />
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
                  <p className="text-xs text-muted-foreground">Account type</p>
                  <p className="mt-1 font-semibold">{ACCOUNT_TYPE_LABELS[selectedAccount.accountType ?? "bank"]}</p>
                </div>

                <div className="rounded-xl border border-border/60 p-4">
                  <p className="text-xs text-muted-foreground">Institution / channel</p>
                  <p className="mt-1 font-semibold">{selectedAccount.institution || "-"}</p>
                </div>

                <div className="rounded-xl border border-border/60 p-4">
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p className="mt-1 font-semibold">{formatMoney(selectedAccount.balance, selectedAccount.currency ?? "THB")}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Currency: {selectedAccount.currency ?? "THB"}</p>
                </div>

                <div className="rounded-xl border border-border/60 p-4">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <div className="mt-2">
                    <StatusBadge status={selectedAccount.status ?? "active"} />
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 p-4">
                  <p className="text-xs text-muted-foreground">Recent activity</p>
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
                      <p className="text-sm text-muted-foreground">No recorded activity for this account yet.</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setEditingAccount(selectedAccount);
                      setAccountModalOpen(true);
                    }}
                  >
                    Edit Account
                  </Button>
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
                  <Button variant="outline" className="sm:col-span-2" onClick={() => nav("/finance/statements")}>
                    Open Statements
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

export default Finance;

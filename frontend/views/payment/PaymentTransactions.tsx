import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import {
  ConfigurableActionDrawer,
  ConfigurableActionModal,
  EvidenceAttachmentModal,
  IncomeDocumentModal,
  PaymentActionModal,
} from "@/components/modals/DomainModals";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { ListToolbar } from "@/components/ui-kit/ListToolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAppData } from "@/lib/app-data";
import { formatMoney } from "@/lib/currency";
import { buildPayables } from "@/lib/purchases";
import type { AccountMovement, Invoice, PaymentStatus, VendorPayment } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Download, Eye, FileText, Mail, MoreHorizontal, Paperclip, Printer, RefreshCcw, XCircle } from "lucide-react";
import { toast } from "sonner";

type PaymentRow = {
  id: string;
  paymentDate: string;
  paymentType: "incoming" | "outgoing" | "customer_payment" | "supplier_payment" | "cheque_payment" | "petty_cash_payment" | "bank_transfer" | "cash_payment";
  sourceDocument: string;
  sourceRoute?: string;
  party: string;
  paymentMethod: string;
  account: string;
  chequeStatus: string;
  amount: number;
  currency: string;
  status: PaymentStatus | string;
  createdBy: string;
  raw: VendorPayment | AccountMovement | Invoice;
};

type QuickAction = "reset" | "cancel" | "print" | "download_pdf" | "send_email";

const PAYMENT_FILTERS = [
  { value: "all", label: "All transactions" },
  { value: "incoming", label: "Incoming payment" },
  { value: "outgoing", label: "Outgoing payment" },
  { value: "customer_payment", label: "Customer payment" },
  { value: "supplier_payment", label: "Supplier payment" },
  { value: "cheque_payment", label: "Cheque payment" },
  { value: "petty_cash_payment", label: "Petty cash payment" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cash_payment", label: "Cash payment" },
];

const normalizeMethod = (method: string) => method.trim().toLowerCase().replaceAll(" ", "_");

const paymentTypeLabel = (value: PaymentRow["paymentType"]) =>
  PAYMENT_FILTERS.find((filter) => filter.value === value)?.label ?? value.replaceAll("_", " ");

const chequeStatusFor = (payment: VendorPayment | AccountMovement | Invoice, method: string) => {
  if (!method.toLowerCase().includes("cheque")) return "-";
  if ("chequeClearedDate" in payment && payment.chequeClearedDate) return "Cleared";
  if ("chequeDepositDate" in payment && payment.chequeDepositDate) return "Deposited";
  if ("chequeCutDate" in payment && payment.chequeCutDate) return "Deducted";
  if ("chequeDate" in payment && payment.chequeDate) return "Pending";
  return "Missing cheque details";
};

const buildCustomerPaymentRows = (invoices: Invoice[]): PaymentRow[] =>
  invoices
    .filter((invoice) => {
      const looseInvoice = invoice as Invoice & Record<string, any>;
      return (invoice.paymentSummary?.received ?? looseInvoice.amountPaid ?? 0) > 0;
    })
    .map((invoice) => {
      const looseInvoice = invoice as Invoice & Record<string, any>;
      const paymentSummary = invoice.paymentSummary as (Invoice["paymentSummary"] & Record<string, any>) | undefined;
      const paidAmount = invoice.paymentSummary?.received ?? looseInvoice.amountPaid ?? 0;
      const paymentMethod = String(paymentSummary?.lastPaymentMethod ?? looseInvoice.paymentMethod ?? "Bank Transfer");
      return {
        id: paymentSummary?.lastPaymentId ?? `${invoice.id}-payment`,
        paymentDate: paymentSummary?.lastPaymentDate ?? invoice.date,
        paymentType: "customer_payment",
        sourceDocument: invoice.id,
        sourceRoute: `/income/documents/${invoice.id}`,
        party: invoice.customer,
        paymentMethod,
        account: looseInvoice.selectedBankAccount?.accountName ?? looseInvoice.selectedBankAccount?.bankName ?? "Company account",
        chequeStatus: chequeStatusFor(looseInvoice, paymentMethod),
        amount: paidAmount,
        currency: invoice.currency ?? "THB",
        status: invoice.paymentSummary?.remaining && invoice.paymentSummary.remaining > 0 ? "partial" : "paid",
        createdBy: looseInvoice.salesperson ?? "System",
        raw: invoice,
      };
    });

const buildSupplierPaymentRows = (payments: VendorPayment[]): PaymentRow[] =>
  payments.map((payment) => {
    const method = String(payment.paymentMethod ?? "");
    const normalized = normalizeMethod(method);
    const paymentType = method.toLowerCase().includes("cheque")
      ? "cheque_payment"
      : normalized.includes("petty")
        ? "petty_cash_payment"
        : normalized.includes("bank")
          ? "bank_transfer"
          : normalized.includes("cash")
            ? "cash_payment"
            : "supplier_payment";
    return {
      id: payment.id,
      paymentDate: payment.paymentDate,
      paymentType,
      sourceDocument: payment.sourceDocumentIds?.[0] ?? payment.sourceDocumentId ?? payment.allocations?.[0]?.documentId ?? "-",
      sourceRoute: payment.sourceDocumentId ? `/expense/documents?document=${encodeURIComponent(payment.sourceDocumentId)}` : undefined,
      party: payment.vendor,
      paymentMethod: method,
      account: payment.accountName || payment.accountNumber || "-",
      chequeStatus: chequeStatusFor(payment, method),
      amount: payment.amount,
      currency: payment.currency ?? "THB",
      status: payment.paymentStatus,
      createdBy: "System",
      raw: payment,
    };
  });

const buildMovementRows = (movements: AccountMovement[]): PaymentRow[] =>
  movements.map((movement) => ({
    id: movement.id,
    paymentDate: movement.date,
    paymentType: movement.direction === "in" ? "incoming" : "outgoing",
    sourceDocument: movement.sourceId,
    sourceRoute: movement.sourceRoute,
    party: movement.counterparty || movement.counterAccountName || "-",
    paymentMethod: movement.movementType || movement.sourceType,
    account: movement.accountName,
    chequeStatus: movement.accountType === "cheque_payable" ? movement.status ?? "Pending" : "-",
    amount: movement.amount,
    currency: movement.currency ?? "THB",
    status: movement.status ?? "posted",
    createdBy: "System",
    raw: movement,
  }));

const PaymentTransactions = () => {
  const nav = useNavigate();
  const { data, refresh } = useAppData();
  const payables = useMemo(() => buildPayables(data), [data]);
  const [search, setSearch] = useState(() => new URLSearchParams(location.search).get("vendor") ?? "");
  const [typeFilter, setTypeFilter] = useState(() => new URLSearchParams(location.search).get("type") ?? "all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeRow, setActiveRow] = useState<PaymentRow | null>(null);
  const [detailMode, setDetailMode] = useState<"payment" | "cheque" | "petty_cash" | null>(null);
  const [quickAction, setQuickAction] = useState<QuickAction | null>(null);
  const [supplierPaymentOpen, setSupplierPaymentOpen] = useState(false);
  const [customerPaymentOpen, setCustomerPaymentOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  const rows = useMemo(
    () =>
      [
        ...buildCustomerPaymentRows(data.invoices),
        ...buildSupplierPaymentRows(data.vendorPayments),
        ...buildMovementRows(data.accountMovements),
      ].sort((left, right) => right.paymentDate.localeCompare(left.paymentDate)),
    [data.accountMovements, data.invoices, data.vendorPayments]
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const method = normalizeMethod(row.paymentMethod);
      const matchesQuery =
        !query ||
        row.id.toLowerCase().includes(query) ||
        row.sourceDocument.toLowerCase().includes(query) ||
        row.party.toLowerCase().includes(query) ||
        row.account.toLowerCase().includes(query);
      const matchesType =
        typeFilter === "all" ||
        row.paymentType === typeFilter ||
        (typeFilter === "incoming" && row.paymentType === "customer_payment") ||
        (typeFilter === "outgoing" && ["supplier_payment", "petty_cash_payment", "cheque_payment"].includes(row.paymentType));
      const matchesMethod =
        methodFilter === "all" ||
        method.includes(methodFilter) ||
        (methodFilter === "cheque" && row.chequeStatus !== "-");
      return matchesQuery && matchesType && matchesMethod;
    });
  }, [methodFilter, rows, search, typeFilter]);

  const allVisibleSelected = filteredRows.length > 0 && filteredRows.every((row) => selectedIds.includes(row.id));

  const openDetail = (row: PaymentRow, mode: "payment" | "cheque" | "petty_cash" = "payment") => {
    setActiveRow(row);
    setDetailMode(mode);
  };

  const startQuickAction = (row: PaymentRow, action: QuickAction) => {
    setActiveRow(row);
    setQuickAction(action);
  };

  const confirmQuickAction = () => {
    if (!activeRow || !quickAction) return;
    const label = quickAction.replaceAll("_", " ");
    toast.success(`${label} action prepared for ${activeRow.id}.`, {
      description: "Payment state changes remain linked to the source document and audit workflow.",
    });
    setQuickAction(null);
  };

  return (
    <AppShell>
      <PageHeader
        title="Payment / Transactions"
        description="Receive customer payments, pay suppliers, manage cheques, petty cash, and payment corrections from one transaction workspace."
        breadcrumbs={[{ label: "Payment" }, { label: "Transactions" }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setCustomerPaymentOpen(true)}>
              Receive customer payment
            </Button>
            <Button size="sm" onClick={() => setSupplierPaymentOpen(true)}>
              Pay supplier
            </Button>
          </>
        }
      />

      <ListToolbar
        searchPlaceholder="Search payment, source document, account, customer or supplier..."
        searchValue={search}
        onSearchChange={setSearch}
        primaryAction={{ label: "Record payment", onClick: () => setSupplierPaymentOpen(true) }}
        extra={
          <div className="flex flex-wrap gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[210px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_FILTERS.map((filter) => (
                  <SelectItem key={filter.value} value={filter.value}>{filter.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All methods</SelectItem>
                <SelectItem value="bank">Bank transfer</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="petty">Petty cash</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10">
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={(checked) => setSelectedIds(checked ? filteredRows.map((row) => row.id) : [])}
                />
              </TableHead>
              <TableHead>Payment date</TableHead>
              <TableHead>Payment type</TableHead>
              <TableHead>Source document</TableHead>
              <TableHead>Customer / Supplier</TableHead>
              <TableHead>Payment method</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Cheque status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created by</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map((row) => (
              <TableRow key={`${row.paymentType}-${row.id}`} className="cursor-pointer" onClick={() => openDetail(row)}>
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.includes(row.id)}
                    onCheckedChange={(checked) =>
                      setSelectedIds((current) => checked ? [...current, row.id] : current.filter((id) => id !== row.id))
                    }
                  />
                </TableCell>
                <TableCell>{row.paymentDate}</TableCell>
                <TableCell>{paymentTypeLabel(row.paymentType)}</TableCell>
                <TableCell className="font-mono text-xs font-semibold text-primary">{row.sourceDocument}</TableCell>
                <TableCell className="font-medium">{row.party}</TableCell>
                <TableCell>{row.paymentMethod}</TableCell>
                <TableCell>{row.account}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn(row.chequeStatus === "-" && "text-muted-foreground")}>{row.chequeStatus}</Badge>
                </TableCell>
                <TableCell className="text-right font-semibold">{formatMoney(row.amount, row.currency)}</TableCell>
                <TableCell><Badge variant="secondary" className="capitalize">{row.status}</Badge></TableCell>
                <TableCell>{row.createdBy}</TableCell>
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={() => openDetail(row)}><Eye className="mr-2 h-4 w-4" /> View</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        setActiveRow(row);
                        if (row.paymentType === "customer_payment") setCustomerPaymentOpen(true);
                        else setSupplierPaymentOpen(true);
                      }}>
                        Edit payment
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        setActiveRow(row);
                        setEvidenceOpen(true);
                      }}><Paperclip className="mr-2 h-4 w-4" /> Attach evidence</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => row.sourceRoute ? nav(row.sourceRoute) : toast.info("No source route available.")}>View source document</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => startQuickAction(row, "print")}><Printer className="mr-2 h-4 w-4" /> Print receipt/payment proof</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => startQuickAction(row, "download_pdf")}><Download className="mr-2 h-4 w-4" /> Download PDF</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => startQuickAction(row, "send_email")}><Mail className="mr-2 h-4 w-4" /> Send email</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => startQuickAction(row, "reset")}><RefreshCcw className="mr-2 h-4 w-4" /> Reset payment</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => startQuickAction(row, "cancel")} className="text-destructive"><XCircle className="mr-2 h-4 w-4" /> Cancel payment</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filteredRows.length === 0 ? (
          <div className="p-10 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
            <h3 className="mt-3 font-display text-base font-semibold">No payment transactions found</h3>
            <p className="mt-1 text-sm text-muted-foreground">Try another filter or record a new payment.</p>
          </div>
        ) : null}
      </Card>

      <PaymentActionModal
        kind="vendor_payment"
        open={supplierPaymentOpen}
        onOpenChange={setSupplierPaymentOpen}
        payables={payables}
        payment={activeRow && "vendor" in activeRow.raw ? activeRow.raw as VendorPayment : null}
        onSaved={() => void refresh()}
      />
      <IncomeDocumentModal
        kind="receipt"
        open={customerPaymentOpen}
        onOpenChange={setCustomerPaymentOpen}
      />
      <EvidenceAttachmentModal
        open={evidenceOpen}
        onOpenChange={setEvidenceOpen}
        entityType="payment"
        entityId={activeRow?.id}
        onSaved={() => void refresh()}
      />
      <ConfigurableActionModal
        open={Boolean(quickAction)}
        onOpenChange={(open) => !open && setQuickAction(null)}
        title={quickAction ? quickAction.replaceAll("_", " ") : "Payment action"}
        description={activeRow ? `This action will stay linked to payment ${activeRow.id} and source ${activeRow.sourceDocument}.` : undefined}
        confirmLabel="Continue"
        onConfirm={confirmQuickAction}
      />
      <ConfigurableActionDrawer
        open={Boolean(detailMode && activeRow)}
        onOpenChange={(open) => !open && setDetailMode(null)}
        title={detailMode === "cheque" ? "Cheque detail" : detailMode === "petty_cash" ? "Petty cash movement detail" : "Payment detail"}
        description={activeRow ? `${activeRow.id} linked to ${activeRow.sourceDocument}` : undefined}
        confirmLabel="Close"
        onConfirm={() => setDetailMode(null)}
      >
        <PaymentDetail row={activeRow} />
      </ConfigurableActionDrawer>

    </AppShell>
  );
};

const PaymentDetail = ({ row }: { row: PaymentRow | null }) => {
  if (!row) return null;
  return (
    <div className="space-y-3 rounded-lg border p-4 text-sm">
      <div className="flex justify-between gap-3"><span className="text-muted-foreground">Payment date</span><span>{row.paymentDate}</span></div>
      <div className="flex justify-between gap-3"><span className="text-muted-foreground">Type</span><span>{paymentTypeLabel(row.paymentType)}</span></div>
      <div className="flex justify-between gap-3"><span className="text-muted-foreground">Source</span><span className="font-mono">{row.sourceDocument}</span></div>
      <div className="flex justify-between gap-3"><span className="text-muted-foreground">Party</span><span>{row.party}</span></div>
      <div className="flex justify-between gap-3"><span className="text-muted-foreground">Method</span><span>{row.paymentMethod}</span></div>
      <div className="flex justify-between gap-3"><span className="text-muted-foreground">Account</span><span>{row.account}</span></div>
      <div className="flex justify-between gap-3"><span className="text-muted-foreground">Cheque status</span><span>{row.chequeStatus}</span></div>
      <div className="flex justify-between gap-3 border-t pt-3 font-semibold"><span>Amount</span><span>{formatMoney(row.amount, row.currency)}</span></div>
    </div>
  );
};

export default PaymentTransactions;

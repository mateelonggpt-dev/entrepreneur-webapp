import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { CombinedBillingModal } from "@/components/modals/CombinedBillingModal";
import { CombinedReceiptModal } from "@/components/modals/CombinedReceiptModal";
import { CreditNoteModal } from "@/components/modals/CreditNoteModal";
import { DebitNoteModal } from "@/components/modals/DebitNoteModal";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { ListToolbar } from "@/components/ui-kit/ListToolbar";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { KpiCard } from "@/components/ui-kit/KpiCard";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fmtTHB } from "@/lib/demo-data";
import { useAppData } from "@/lib/app-data";
import { downloadDocumentPdf, exportResource, sendInvoiceToCustomer } from "@/lib/api";
import { Clock, CheckCircle2, AlertCircle, MoreHorizontal, Receipt, Send, Layers3, HandCoins } from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 8;

const SalesInvoices = () => {
  const nav = useNavigate();
  const { data, refresh } = useAppData();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "pending" | "sent" | "overdue" | "partial" | "paid">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [billingModalOpen, setBillingModalOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [creditNoteOpen, setCreditNoteOpen] = useState(false);
  const [debitNoteOpen, setDebitNoteOpen] = useState(false);
  const [sourceInvoiceId, setSourceInvoiceId] = useState<string | undefined>(undefined);

  const filteredInvoices = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.invoices.filter((invoice) => {
      const matchesQuery =
        !query ||
        invoice.id.toLowerCase().includes(query) ||
        invoice.customer.toLowerCase().includes(query) ||
        (invoice.reference ?? "").toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [data.invoices, search, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const pagedInvoices = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredInvoices.slice(start, start + PAGE_SIZE);
  }, [filteredInvoices, page]);

  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / PAGE_SIZE));
  const allVisibleSelected =
    pagedInvoices.length > 0 && pagedInvoices.every((invoice) => selectedIds.includes(invoice.id));

  const kpis = useMemo(() => {
    const outstandingStatuses = new Set(["pending", "sent", "overdue", "partial"]);
    const outstandingInvoices = data.invoices.filter((invoice) =>
      outstandingStatuses.has(invoice.status)
    );
    const paidInvoices = data.invoices.filter((invoice) => invoice.status === "paid");
    const overdueInvoices = data.invoices.filter((invoice) => invoice.status === "overdue");
    const draftInvoices = data.invoices.filter((invoice) => invoice.status === "draft");

    return {
      outstandingAmount: outstandingInvoices.reduce((sum, invoice) => sum + invoice.amount, 0),
      outstandingCount: outstandingInvoices.length,
      paidAmount: paidInvoices.reduce((sum, invoice) => sum + invoice.amount, 0),
      overdueAmount: overdueInvoices.reduce((sum, invoice) => sum + invoice.amount, 0),
      overdueCount: overdueInvoices.length,
      draftAmount: draftInvoices.reduce((sum, invoice) => sum + invoice.amount, 0),
      draftCount: draftInvoices.length,
    };
  }, [data.invoices]);

  const toggleVisibleSelection = (checked: boolean) => {
    if (checked) {
      setSelectedIds((current) =>
        Array.from(new Set([...current, ...pagedInvoices.map((invoice) => invoice.id)]))
      );
      return;
    }

    setSelectedIds((current) =>
      current.filter((id) => !pagedInvoices.some((invoice) => invoice.id === id))
    );
  };

  const toggleInvoiceSelection = (invoiceId: string) => {
    setSelectedIds((current) =>
      current.includes(invoiceId)
        ? current.filter((id) => id !== invoiceId)
        : [...current, invoiceId]
    );
  };

  const handleExport = async () => {
    try {
      await exportResource("invoices");
      toast.success("Invoices exported");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to export invoices.");
    }
  };

  const handleSend = async (invoiceId: string) => {
    try {
      await sendInvoiceToCustomer(invoiceId);
      await refresh();
      toast.success(`Invoice ${invoiceId} sent`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send invoice.");
    }
  };

  const handleSendSelected = async () => {
    if (selectedIds.length === 0) {
      return;
    }

    try {
      for (const invoiceId of selectedIds) {
        await sendInvoiceToCustomer(invoiceId);
      }
      await refresh();
      toast.success(`${selectedIds.length} invoice(s) sent`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send selected invoices.");
    }
  };

  const handleDownloadPdf = async (invoiceId: string) => {
    try {
      await downloadDocumentPdf("invoice", invoiceId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to download PDF.");
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Invoices / Tax Invoices"
        description="Track, send, bill, receive, and adjust customer invoices from one place."
        breadcrumbs={[{ label: "Sales" }, { label: "Invoices" }]}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Outstanding"
          value={fmtTHB(kpis.outstandingAmount)}
          icon={<Clock className="h-4 w-4" />}
          hint={`${kpis.outstandingCount} invoices`}
          accent="warning"
        />
        <KpiCard
          label="Paid"
          value={fmtTHB(kpis.paidAmount)}
          icon={<CheckCircle2 className="h-4 w-4" />}
          hint="Collected invoices"
          accent="success"
        />
        <KpiCard
          label="Overdue"
          value={fmtTHB(kpis.overdueAmount)}
          icon={<AlertCircle className="h-4 w-4" />}
          hint={`${kpis.overdueCount} invoices`}
          accent="destructive"
        />
        <KpiCard
          label="Drafts"
          value={fmtTHB(kpis.draftAmount)}
          icon={<Receipt className="h-4 w-4" />}
          hint={`${kpis.draftCount} draft(s)`}
          accent="info"
        />
      </div>

      <ListToolbar
        searchPlaceholder="Search by invoice number, customer, reference..."
        searchValue={search}
        onSearchChange={setSearch}
        primaryAction={{ label: "New Invoice", onClick: () => nav("/sales/invoices/new") }}
        onExportClick={() => void handleExport()}
        extra={
          <>
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(
                  value as "all" | "draft" | "pending" | "sent" | "overdue" | "partial" | "paid"
                )
              }
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>

            {selectedIds.length > 0 ? (
              <>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setBillingModalOpen(true)}>
                  <Layers3 className="h-4 w-4" /> Billing
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setReceiptModalOpen(true)}>
                  <HandCoins className="h-4 w-4" /> Receipt
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void handleSendSelected()}>
                  <Send className="h-4 w-4" /> Send
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <Card className="card-premium overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                <th className="w-10 px-4 py-3">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={(value) => toggleVisibleSelection(Boolean(value))}
                  />
                </th>
                <th className="px-3 py-3 text-left font-semibold">Invoice #</th>
                <th className="px-3 py-3 text-left font-semibold">Customer</th>
                <th className="px-3 py-3 text-left font-semibold">Issue date</th>
                <th className="px-3 py-3 text-left font-semibold">Due date</th>
                <th className="px-3 py-3 text-left font-semibold">Variant</th>
                <th className="px-3 py-3 text-right font-semibold">Amount</th>
                <th className="px-3 py-3 text-left font-semibold">Status</th>
                <th className="w-10 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {pagedInvoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  onClick={() => nav(`/sales/invoices/${invoice.id}`)}
                  className="cursor-pointer border-t border-border/50 transition hover:bg-secondary/40"
                >
                  <td className="px-4 py-3.5" onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.includes(invoice.id)}
                      onCheckedChange={() => toggleInvoiceSelection(invoice.id)}
                    />
                  </td>
                  <td className="px-3 py-3.5 font-mono text-xs font-semibold text-primary">{invoice.id}</td>
                  <td className="px-3 py-3.5 font-medium">{invoice.customer}</td>
                  <td className="px-3 py-3.5 text-muted-foreground">{invoice.date}</td>
                  <td className="px-3 py-3.5 text-muted-foreground">{invoice.due}</td>
                  <td className="px-3 py-3.5">
                    {invoice.documentTitle || invoice.documentVariant ? (
                      <span className="rounded-md bg-secondary px-2 py-0.5 text-xs">
                        {invoice.documentTitle || invoice.documentVariant}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-3 py-3.5 text-right font-semibold tabular-nums">{fmtTHB(invoice.amount)}</td>
                  <td className="px-3 py-3.5">
                    <StatusBadge status={invoice.status} />
                  </td>
                  <td className="px-3 py-3.5" onClick={(event) => event.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => nav(`/sales/invoices/${invoice.id}`)}>
                          View invoice
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void handleDownloadPdf(invoice.id)}>
                          Download PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void handleSend(invoice.id)}>
                          Send to customer
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedIds([invoice.id]);
                            setBillingModalOpen(true);
                          }}
                        >
                          Create billing
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedIds([invoice.id]);
                            setReceiptModalOpen(true);
                          }}
                        >
                          Create receipt
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSourceInvoiceId(invoice.id);
                            setCreditNoteOpen(true);
                          }}
                        >
                          Create credit note
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSourceInvoiceId(invoice.id);
                            setDebitNoteOpen(true);
                          }}
                        >
                          Create debit note
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border/50 px-4 py-3 text-xs text-muted-foreground">
          <span>
            Showing {pagedInvoices.length} of {filteredInvoices.length} invoice(s)
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      <CombinedBillingModal
        open={billingModalOpen}
        onOpenChange={setBillingModalOpen}
        preselectedInvoiceIds={selectedIds}
      />

      <CombinedReceiptModal
        open={receiptModalOpen}
        onOpenChange={setReceiptModalOpen}
        sourceInvoiceIds={selectedIds}
      />

      <CreditNoteModal
        open={creditNoteOpen}
        onOpenChange={setCreditNoteOpen}
        sourceInvoiceId={sourceInvoiceId}
      />

      <DebitNoteModal
        open={debitNoteOpen}
        onOpenChange={setDebitNoteOpen}
        sourceInvoiceId={sourceInvoiceId}
      />
    </AppShell>
  );
};

export default SalesInvoices;

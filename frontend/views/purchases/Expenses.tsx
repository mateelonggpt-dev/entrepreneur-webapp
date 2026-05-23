import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ExpenseModal } from "@/components/modals/ExpenseModal";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { ListToolbar } from "@/components/ui-kit/ListToolbar";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { KpiCard } from "@/components/ui-kit/KpiCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtTHB } from "@/lib/demo-data";
import { useAppData } from "@/lib/app-data";
import type { Expense } from "@/lib/types";
import { Wallet, TrendingDown, FileCheck2, MoreHorizontal } from "lucide-react";
import { approveExpenseRecord, downloadExpenseReceipt, exportResource } from "@/lib/api";
import { toast } from "sonner";

const Expenses = () => {
  const nav = useNavigate();
  const location = useLocation();
  const { data, refresh } = useAppData();
  const { expenses } = data;
  const [open, setOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [search, setSearch] = useState(() => new URLSearchParams(location.search).get("vendor") ?? "");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return expenses.filter((expense) => {
      const matchesQuery =
        !query ||
        expense.id.toLowerCase().includes(query) ||
        expense.vendor.toLowerCase().includes(query) ||
        expense.category.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || expense.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [expenses, search, statusFilter]);

  const handleExport = async () => {
    try {
      await exportResource("expenses");
      toast.success("Expenses exported");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to export expenses.");
    }
  };

  const handleApprove = async (expenseId: string) => {
    try {
      await approveExpenseRecord(expenseId);
      await refresh();
      toast.success(`Expense ${expenseId} approved`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to approve expense.");
    }
  };

  const handleReceipt = async (expenseId: string) => {
    try {
      await downloadExpenseReceipt(expenseId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to download receipt.");
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Expenses"
        description="Track operating costs, vendor bills, and approvals."
        breadcrumbs={[{ label: "Purchases & Expenses" }, { label: "Expenses" }]}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="This month" value="THB 952,300" icon={<Wallet className="h-4 w-4" />} delta={{ value: "+4.6%", positive: false }} accent="warning" />
        <KpiCard label="Pending approval" value="THB 24,800" icon={<FileCheck2 className="h-4 w-4" />} hint="3 items" accent="info" />
        <KpiCard label="Avg per day" value="THB 31,743" icon={<TrendingDown className="h-4 w-4" />} accent="primary" />
      </div>

      <ListToolbar
        searchPlaceholder="Search expenses, vendor..."
        searchValue={search}
        onSearchChange={setSearch}
        primaryAction={{
          label: "New Expense",
          onClick: () => {
            setEditingExpense(null);
            setOpen(true);
          },
        }}
        onExportClick={() => void handleExport()}
        extra={
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <Card className="card-premium overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                <th className="w-10 px-4 py-3"><Checkbox /></th>
                <th className="px-3 py-3 text-left font-semibold">Reference</th>
                <th className="px-3 py-3 text-left font-semibold">Vendor</th>
                <th className="px-3 py-3 text-left font-semibold">Category</th>
                <th className="px-3 py-3 text-left font-semibold">Date</th>
                <th className="px-3 py-3 text-right font-semibold">Amount</th>
                <th className="px-3 py-3 text-left font-semibold">Status</th>
                <th className="w-10 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((expense) => (
                <tr
                  key={expense.id}
                  onClick={() => nav(`/purchases/expenses/${expense.id}`)}
                  className="cursor-pointer border-t border-border/50 hover:bg-secondary/40"
                >
                  <td className="px-4 py-3.5" onClick={(event) => event.stopPropagation()}>
                    <Checkbox />
                  </td>
                  <td className="px-3 py-3.5 font-mono text-xs font-semibold text-primary">{expense.id}</td>
                  <td className="px-3 py-3.5 font-medium">{expense.vendor}</td>
                  <td className="px-3 py-3.5">
                    <span className="rounded-md bg-secondary px-2 py-0.5 text-xs">{expense.category}</span>
                  </td>
                  <td className="px-3 py-3.5 text-muted-foreground">{expense.date}</td>
                  <td className="px-3 py-3.5 text-right font-semibold tabular-nums">{fmtTHB(expense.amount)}</td>
                  <td className="px-3 py-3.5">
                    <StatusBadge status={expense.status} />
                  </td>
                  <td className="px-3 py-3.5" onClick={(event) => event.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => nav(`/purchases/expenses/${expense.id}`)}>
                          View expense
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingExpense(expense);
                            setOpen(true);
                          }}
                        >
                          Edit expense
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void handleReceipt(expense.id)}>
                          Download receipt
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void handleApprove(expense.id)}>
                          Approve expense
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <ExpenseModal open={open} onOpenChange={setOpen} expense={editingExpense} />
    </AppShell>
  );
};

export default Expenses;

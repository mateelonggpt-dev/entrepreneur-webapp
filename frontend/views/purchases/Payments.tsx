import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { PaymentActionModal } from "@/components/modals/DomainModals";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { ListToolbar } from "@/components/ui-kit/ListToolbar";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportResource } from "@/lib/api";
import { useAppData } from "@/lib/app-data";
import { formatMoney, getEnabledCurrencies } from "@/lib/currency";
import { buildPayables, filterPayables } from "@/lib/purchases";
import type { VendorPayment } from "@/lib/types";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

const Payments = () => {
  const location = useLocation();
  const { data, refresh } = useAppData();
  const payables = useMemo(() => buildPayables(data), [data]);
  const currencyOptions = useMemo(() => getEnabledCurrencies(data.currencySettings), [data.currencySettings]);
  const [search, setSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState(
    () => new URLSearchParams(location.search).get("vendor") ?? "all"
  );
  const [statusFilter, setStatusFilter] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [dueBefore, setDueBefore] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<VendorPayment | null>(null);

  const filteredPayables = useMemo(
    () =>
      filterPayables(payables, {
        query: search,
        vendor: vendorFilter,
        status: statusFilter,
        currency: currencyFilter,
      }).filter((row) => (!dueBefore ? true : (row.due || row.date) <= dueBefore)),
    [currencyFilter, dueBefore, payables, search, statusFilter, vendorFilter]
  );

  const selectedPayables = filteredPayables.filter((row) => selectedIds.includes(row.id));
  const selectedVendor = selectedPayables[0]?.vendor;
  const selectedVendorMismatch = selectedPayables.some((row) => row.vendor !== selectedVendor);

  const handleGroupedPayment = () => {
    if (selectedPayables.length === 0) {
      toast.error("Select at least one payable document.");
      return;
    }
    if (selectedVendorMismatch) {
      toast.error("Grouped payments can only include one vendor at a time.");
      return;
    }
    setEditingPayment(null);
    setCreateOpen(true);
  };

  const handleExport = async () => {
    try {
      await exportResource("payments");
      toast.success("Payments exported");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to export payments.");
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Vendor Payments"
        description="Prepare single or grouped payments against open payables and keep payment metadata editable where allowed."
        breadcrumbs={[{ label: "Purchases & Expenses" }, { label: "Vendor Payments" }]}
      />

      <ListToolbar
        searchPlaceholder="Search payable docs or vendors..."
        searchValue={search}
        onSearchChange={setSearch}
        primaryAction={{ label: "Record Payment", onClick: handleGroupedPayment }}
        onExportClick={() => void handleExport()}
        extra={
          <>
            <Select value={vendorFilter} onValueChange={setVendorFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Vendor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All vendors</SelectItem>
                {data.vendors.map((vendor) => (
                  <SelectItem key={vendor.id} value={vendor.name}>
                    {vendor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
              </SelectContent>
            </Select>
            <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Currency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All currencies</SelectItem>
                {currencyOptions.map((currencyCode) => (
                  <SelectItem key={currencyCode} value={currencyCode}>
                    {currencyCode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="w-[170px]"
              type="date"
              value={dueBefore}
              onChange={(event) => setDueBefore(event.target.value)}
            />
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
                    checked={filteredPayables.length > 0 && selectedIds.length === filteredPayables.length}
                    onCheckedChange={(checked) =>
                      setSelectedIds(checked ? filteredPayables.map((row) => row.id) : [])
                    }
                  />
                </th>
                <th className="px-3 py-3 text-left font-semibold">Document</th>
                <th className="px-3 py-3 text-left font-semibold">Vendor</th>
                <th className="px-3 py-3 text-left font-semibold">Due</th>
                <th className="px-3 py-3 text-right font-semibold">Open Amount</th>
                <th className="px-3 py-3 text-left font-semibold">Payment Status</th>
                <th className="w-10 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {filteredPayables.map((row) => (
                <tr key={row.id} className="border-t border-border/50 hover:bg-secondary/30">
                  <td className="px-4 py-3.5">
                    <Checkbox
                      checked={selectedIds.includes(row.id)}
                      onCheckedChange={(checked) =>
                        setSelectedIds((current) =>
                          checked
                            ? Array.from(new Set([...current, row.id]))
                            : current.filter((id) => id !== row.id)
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-3.5 font-mono text-xs font-semibold text-primary">{row.id}</td>
                  <td className="px-3 py-3.5 font-medium">{row.vendor}</td>
                  <td className="px-3 py-3.5 text-muted-foreground">{row.due || row.date}</td>
                  <td className="px-3 py-3.5 text-right font-semibold tabular-nums">{formatMoney(row.remaining, row.currency || "THB")}</td>
                  <td className="px-3 py-3.5">
                    <StatusBadge
                      status={
                        row.paymentStatus === "unpaid"
                          ? "pending"
                          : row.paymentStatus === "refunded"
                            ? "paid"
                            : row.paymentStatus
                      }
                    />
                  </td>
                  <td className="px-3 py-3.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedIds([row.id]);
                            setEditingPayment(null);
                            setCreateOpen(true);
                          }}
                        >
                          Pay this document
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

      <Card className="card-premium mt-6 overflow-hidden">
        <div className="border-b border-border/60 px-5 py-4">
          <h2 className="font-display text-lg font-semibold">Recent Payments</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 text-left font-semibold">Payment</th>
                <th className="px-3 py-3 text-left font-semibold">Vendor</th>
                <th className="px-3 py-3 text-left font-semibold">Date</th>
                <th className="px-3 py-3 text-left font-semibold">Method</th>
                <th className="px-3 py-3 text-right font-semibold">Amount</th>
                <th className="w-10 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.vendorPayments.map((payment) => (
                <tr key={payment.id} className="border-t border-border/50 hover:bg-secondary/30">
                  <td className="px-4 py-3.5 font-mono text-xs font-semibold text-primary">{payment.id}</td>
                  <td className="px-3 py-3.5 font-medium">{payment.vendor}</td>
                  <td className="px-3 py-3.5 text-muted-foreground">{payment.paymentDate}</td>
                  <td className="px-3 py-3.5 text-muted-foreground">{payment.paymentMethod}</td>
                  <td className="px-3 py-3.5 text-right font-semibold tabular-nums">{formatMoney(payment.amount, payment.currency || "THB")}</td>
                  <td className="px-3 py-3.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingPayment(payment);
                            setCreateOpen(true);
                          }}
                        >
                          Edit payment metadata
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.vendorPayments.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            No vendor payments recorded yet.
          </div>
        ) : null}
      </Card>

      <PaymentActionModal
        kind="vendor_payment"
        open={createOpen}
        onOpenChange={setCreateOpen}
        payables={payables}
        initialSelection={selectedIds}
        payment={editingPayment}
        onSaved={async () => {
          await refresh();
          setSelectedIds([]);
          setEditingPayment(null);
        }}
      />
    </AppShell>
  );
};

export default Payments;

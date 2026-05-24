import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { MasterDataModal } from "@/components/modals/DomainModals";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { ListToolbar } from "@/components/ui-kit/ListToolbar";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { exportResource } from "@/lib/api";
import type { Customer, Vendor } from "@/lib/types";
import { Mail, Phone, MoreHorizontal, UserPlus } from "lucide-react";
import { toast } from "sonner";

const Customers = () => {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { data } = useAppData();
  const { customers, vendors } = data;
  const [open, setOpen] = useState(false);
  const [vendorOpen, setVendorOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [search, setSearch] = useState("");
  const [contactTypeFilter, setContactTypeFilter] = useState<"all" | "customer" | "vendor">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [balanceFilter, setBalanceFilter] = useState<"all" | "with-balance" | "clear">("all");

  const filteredContacts = useMemo(() => {
    const searchLower = search.trim().toLowerCase();
    const customerRows = customers.map((customer) => ({ type: "customer" as const, record: customer }));
    const vendorRows = vendors.map((vendor) => ({ type: "vendor" as const, record: vendor }));
    return [...customerRows, ...vendorRows].filter(({ type, record }) => {
      if (contactTypeFilter !== "all" && contactTypeFilter !== type) return false;
      const matchesSearch =
        !searchLower ||
        record.name.toLowerCase().includes(searchLower) ||
        (record.contact ?? "").toLowerCase().includes(searchLower) ||
        (record.email ?? "").toLowerCase().includes(searchLower) ||
        (record.phone ?? "").toLowerCase().includes(searchLower) ||
        (record.taxId ?? "").toLowerCase().includes(searchLower);

      const matchesStatus = statusFilter === "all" || record.status === statusFilter;
      const matchesBalance =
        balanceFilter === "all" ||
        (balanceFilter === "with-balance" ? record.balance > 0 : record.balance <= 0);

      return matchesSearch && matchesStatus && matchesBalance;
    });
  }, [balanceFilter, contactTypeFilter, customers, search, statusFilter, vendors]);

  const handleExport = async () => {
    try {
      await exportResource("customers");
      toast.success(t("contacts.toast.exported"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("contacts.toast.unableToExportCustomers"));
    }
  };

  return (
    <AppShell>
      <PageHeader
        title={t("contacts.title")}
        description={t("contacts.description")}
        breadcrumbs={[{ label: t("contacts.title") }]}
      />

      <ListToolbar
        searchPlaceholder={t("contacts.filters.searchCustomers")}
        searchValue={search}
        onSearchChange={setSearch}
        primaryAction={{
          label: t("contacts.newCustomer"),
          onClick: () => {
            setEditingCustomer(null);
            setOpen(true);
          },
        }}
        onExportClick={() => void handleExport()}
        extra={
          <>
            <Select value={contactTypeFilter} onValueChange={(value) => setContactTypeFilter(value as typeof contactTypeFilter)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("contacts.filters.all")}</SelectItem>
                <SelectItem value="customer">{t("contacts.customer")}</SelectItem>
                <SelectItem value="vendor">{t("contacts.vendor")}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("contacts.filters.allStatuses")}</SelectItem>
                <SelectItem value="active">{t("status.active")}</SelectItem>
                <SelectItem value="inactive">{t("status.inactive")}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={balanceFilter} onValueChange={(value) => setBalanceFilter(value as typeof balanceFilter)}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("contacts.filters.allBalances")}</SelectItem>
                <SelectItem value="with-balance">{t("contacts.filters.withReceivable")}</SelectItem>
                <SelectItem value="clear">{t("contacts.filters.fullySettled")}</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      {filteredContacts.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredContacts.map(({ type, record }) => (
            <Card key={`${type}-${record.id}`} className="card-premium group p-5 transition hover:shadow-premium">
              <div className="mb-4 flex items-start gap-3">
                <Avatar className="h-12 w-12 ring-2 ring-primary/10">
                  <AvatarFallback className="bg-gradient-brand font-bold text-primary-foreground">
                    {record.name
                      .split(" ")
                      .map((segment) => segment[0])
                      .slice(0, 2)
                      .join("")}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-display font-semibold">{record.name}</h3>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                      {type === "customer" ? t("contacts.customer") : t("contacts.vendor")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{record.contact || t("contacts.empty.noPrimaryContact")}</p>
                  {record.taxId ? <p className="mt-1 text-[11px] text-muted-foreground">{t("contacts.fields.taxIdWithValue", { taxId: record.taxId })}</p> : null}
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        if (type === "customer") {
                          setEditingCustomer(record as Customer);
                          setOpen(true);
                        } else {
                          setEditingVendor(record as Vendor);
                          setVendorOpen(true);
                        }
                      }}
                    >
                      {type === "customer" ? t("contacts.editCustomer") : t("contacts.editVendor")}
                    </DropdownMenuItem>
                    {type === "customer" ? (
                      <>
                        <DropdownMenuItem onClick={() => nav("/sales/invoices/new")}>{t("contacts.actions.createInvoice")}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => nav("/sales/quotations")}>{t("contacts.actions.createQuotation")}</DropdownMenuItem>
                      </>
                    ) : (
                      <>
                        <DropdownMenuItem onClick={() => nav(`/expense/create?vendor=${encodeURIComponent(record.name)}`)}>
                          {t("contacts.actions.createExpense")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => nav(`/expense/documents?vendor=${encodeURIComponent(record.name)}`)}>
                          {t("contacts.actions.viewExpenseDocuments")}
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuItem asChild>
                      <a href={`mailto:${record.email}`}>{t("contacts.actions.sendEmail")}</a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href={`tel:${record.phone}`}>{type === "customer" ? t("contacts.actions.callCustomer") : t("contacts.actions.callVendor")}</a>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void handleExport()}>{t("contacts.actions.exportContacts")}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mb-4 space-y-1.5 text-sm text-muted-foreground">
                <p className="flex items-center gap-2 truncate">
                  <Mail className="h-3.5 w-3.5" /> {record.email || t("contacts.empty.noEmail")}
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5" /> {record.phone || "-"}
                </p>
                {record.address ? <p className="line-clamp-2 text-xs">{record.address}</p> : null}
              </div>

              <div className="flex items-end justify-between border-t border-border/60 pt-3">
                <div>
                  <p className="text-xs text-muted-foreground">{t("contacts.fields.outstanding")}</p>
                  <p className={`text-lg font-display font-bold tabular-nums ${record.balance > 0 ? "text-warning" : "text-success"}`}>
                    {fmtTHB(record.balance)}
                  </p>
                </div>
                <StatusBadge status={record.status} />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="card-premium">
          <EmptyState
            title={t("contacts.empty.noContactsTitle")}
            description={t("contacts.empty.noContactsDescription")}
            action={{
              label: t("contacts.newCustomer"),
              onClick: () => {
                setEditingCustomer(null);
                setOpen(true);
              },
            }}
            icon={<UserPlus className="h-10 w-10 text-primary" />}
          />
        </Card>
      )}

      <MasterDataModal kind="customer" open={open} onOpenChange={setOpen} customer={editingCustomer} />
      <MasterDataModal kind="vendor" open={vendorOpen} onOpenChange={setVendorOpen} vendor={editingVendor} />
    </AppShell>
  );
};

export default Customers;

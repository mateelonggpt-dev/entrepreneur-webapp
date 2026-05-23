import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { MasterDataModal } from "@/components/modals/DomainModals";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { ListToolbar } from "@/components/ui-kit/ListToolbar";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { Card } from "@/components/ui/card";
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
import type { Vendor } from "@/lib/types";
import { Building2, Mail, MoreHorizontal, Phone } from "lucide-react";
import { toast } from "sonner";

const Vendors = () => {
  const nav = useNavigate();
  const { data } = useAppData();
  const { vendors } = data;
  const [open, setOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const filteredVendors = useMemo(() => {
    const searchLower = search.trim().toLowerCase();
    return vendors.filter((vendor) => {
      const matchesSearch =
        !searchLower ||
        vendor.name.toLowerCase().includes(searchLower) ||
        (vendor.contact ?? "").toLowerCase().includes(searchLower) ||
        (vendor.email ?? "").toLowerCase().includes(searchLower) ||
        (vendor.phone ?? "").toLowerCase().includes(searchLower) ||
        (vendor.taxId ?? "").toLowerCase().includes(searchLower);

      const matchesStatus = statusFilter === "all" || vendor.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter, vendors]);

  const handleExport = async () => {
    try {
      await exportResource("vendors");
      toast.success("Vendors exported");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to export vendors.");
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Vendors"
        description="Manage supplier records and connect them to purchasing workflows."
        breadcrumbs={[{ label: "Contacts" }, { label: "Vendors" }]}
      />

      <ListToolbar
        searchPlaceholder="Search vendors, contact, tax ID..."
        searchValue={search}
        onSearchChange={setSearch}
        primaryAction={{
          label: "New Vendor",
          onClick: () => {
            setEditingVendor(null);
            setOpen(true);
          },
        }}
        onExportClick={() => void handleExport()}
        extra={
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
        }
      />

      {filteredVendors.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredVendors.map((vendor) => (
            <Card key={vendor.id} className="card-premium group p-5 transition hover:shadow-premium">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-brand">
                  <Building2 className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-display font-semibold">{vendor.name}</h3>
                  <p className="text-xs text-muted-foreground">{vendor.contact || "No primary contact"}</p>
                  {vendor.taxId ? <p className="mt-1 text-[11px] text-muted-foreground">Tax ID: {vendor.taxId}</p> : null}
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
                        setEditingVendor(vendor);
                        setOpen(true);
                      }}
                    >
                      Edit vendor
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        nav(`/purchases/orders?vendor=${encodeURIComponent(vendor.name)}`)
                      }
                    >
                      Open purchase orders
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        nav(`/purchases/expenses?vendor=${encodeURIComponent(vendor.name)}`)
                      }
                    >
                      Open expenses
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        nav(`/payment/transactions?type=supplier_payment&vendor=${encodeURIComponent(vendor.name)}`)
                      }
                    >
                      Open payments
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href={`mailto:${vendor.email}`}>Send email</a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href={`tel:${vendor.phone}`}>Call vendor</a>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void handleExport()}>Export vendors</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mb-4 space-y-1.5 text-sm text-muted-foreground">
                <p className="flex items-center gap-2 truncate">
                  <Mail className="h-3.5 w-3.5" /> {vendor.email || "No email"}
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5" /> {vendor.phone || "-"}
                </p>
                {vendor.address ? <p className="line-clamp-2 text-xs">{vendor.address}</p> : null}
              </div>

              <div className="flex items-end justify-between border-t border-border/60 pt-3">
                <div>
                  <p className="text-xs text-muted-foreground">Open payable</p>
                  <p className={`text-lg font-display font-bold tabular-nums ${vendor.balance > 0 ? "text-warning" : "text-success"}`}>
                    {fmtTHB(vendor.balance)}
                  </p>
                </div>
                <StatusBadge status={vendor.status} />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="card-premium">
          <EmptyState
            title="No vendors match this view"
            description="Adjust your filters or create a supplier profile to start creating purchase documents."
            action={{
              label: "New Vendor",
              onClick: () => {
                setEditingVendor(null);
                setOpen(true);
              },
            }}
            icon={<Building2 className="h-10 w-10 text-primary" />}
          />
        </Card>
      )}

      <MasterDataModal kind="vendor" open={open} onOpenChange={setOpen} vendor={editingVendor} />
    </AppShell>
  );
};

export default Vendors;

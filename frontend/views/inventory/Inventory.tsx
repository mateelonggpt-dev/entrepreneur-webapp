import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { InventoryMovementSheet } from "@/components/inventory/InventoryMovementSheet";
import { InventoryActionModal } from "@/components/modals/DomainModals";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { KpiCard } from "@/components/ui-kit/KpiCard";
import { ListToolbar } from "@/components/ui-kit/ListToolbar";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { useAppData } from "@/lib/app-data";
import { exportResource } from "@/lib/api";
import { fmtTHB } from "@/lib/demo-data";
import type { InventoryItem } from "@/lib/types";
import { ArrowRightLeft, Boxes, Download, MoreHorizontal, PackagePlus, Warehouse } from "lucide-react";
import { toast } from "sonner";

const Inventory = () => {
  const navigate = useNavigate();
  const { data } = useAppData();
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.inventory.filter((item) => {
      if (!query) {
        return true;
      }
      return item.sku.toLowerCase().includes(query) || item.name.toLowerCase().includes(query);
    });
  }, [data.inventory, search]);

  const activeMovements = useMemo(
    () =>
      selectedItem
        ? data.inventoryMovements.filter((movement) => movement.sku === selectedItem.sku)
        : [],
    [data.inventoryMovements, selectedItem]
  );

  const totalUnits = rows.reduce((sum, item) => sum + item.currentQty, 0);
  const lowStockCount = rows.filter((item) => ["low_stock", "out_of_stock", "negative_stock"].includes(item.stockStatus)).length;
  const stockValue = rows.reduce((sum, item) => sum + item.currentQty * item.averageCost, 0);

  const handleExport = async () => {
    try {
      await exportResource("inventory");
      toast.success("Inventory exported");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to export inventory.");
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Inventory"
        description="Monitor current stock, perpetual movement history, and one-warehouse adjustments."
        breadcrumbs={[{ label: "Contacts & Products" }, { label: "Inventory" }]}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Stocked SKUs" value={String(data.inventory.length)} icon={<Warehouse className="h-4 w-4" />} accent="primary" />
        <KpiCard label="On-hand units" value={String(totalUnits)} icon={<Boxes className="h-4 w-4" />} accent="success" />
        <KpiCard label="Inventory value" value={fmtTHB(stockValue)} icon={<ArrowRightLeft className="h-4 w-4" />} hint={`${lowStockCount} low / empty`} accent="warning" />
      </div>

      <ListToolbar
        searchPlaceholder="Search SKU or stock item..."
        searchValue={search}
        onSearchChange={setSearch}
        primaryAction={{
          label: "New Product",
          onClick: () => navigate("/products"),
        }}
        onExportClick={() => void handleExport()}
      />

      <Card className="card-premium overflow-hidden">
        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50">
                <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 text-left font-semibold">SKU</th>
                  <th className="px-3 py-3 text-left font-semibold">Name</th>
                  <th className="px-3 py-3 text-right font-semibold">Current Qty</th>
                  <th className="px-3 py-3 text-right font-semibold">Unit Cost</th>
                  <th className="px-3 py-3 text-right font-semibold">Average Cost</th>
                  <th className="px-3 py-3 text-left font-semibold">Stock Status</th>
                  <th className="px-3 py-3 text-left font-semibold">Last Movement</th>
                  <th className="w-10 px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr
                    key={item.sku}
                    className="cursor-pointer border-t border-border/50 hover:bg-secondary/30"
                    onClick={() => {
                      setSelectedItem(item);
                      setHistoryOpen(true);
                    }}
                  >
                    <td className="px-4 py-3.5 font-mono text-xs font-semibold text-primary">{item.sku}</td>
                    <td className="px-3 py-3.5 font-medium">{item.name}</td>
                    <td className="px-3 py-3.5 text-right font-semibold tabular-nums">{item.currentQty}</td>
                    <td className="px-3 py-3.5 text-right tabular-nums">{fmtTHB(item.unitCost)}</td>
                    <td className="px-3 py-3.5 text-right tabular-nums">{fmtTHB(item.averageCost)}</td>
                    <td className="px-3 py-3.5">
                      <StatusBadge status={item.stockStatus} />
                    </td>
                    <td className="px-3 py-3.5 text-muted-foreground">{item.lastMovementDate || "-"}</td>
                    <td className="px-3 py-3.5" onClick={(event) => event.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedItem(item);
                              setAdjustmentOpen(true);
                            }}
                          >
                            Adjust stock
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedItem(item);
                              setHistoryOpen(true);
                            }}
                          >
                            View movement history
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              const product = data.products.find((candidate) => candidate.sku === item.sku) ?? null;
                              if (!product) {
                                toast.error("Product details are not available for this SKU.");
                                return;
                              }
                              setSelectedItem(item);
                              setReceiveOpen(true);
                            }}
                          >
                            Receive stock
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void handleExport()}>
                            <Download className="mr-2 h-4 w-4" /> Export inventory
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No stock-counted products yet"
            description="Create stock-counted items first, then this page will track on-hand qty, average cost, and movement history."
            icon={<PackagePlus className="h-10 w-10 text-primary" />}
            action={{ label: "Open Products", onClick: () => navigate("/products") }}
          />
        )}
      </Card>

      <InventoryActionModal
        kind="stock_adjustment"
        open={adjustmentOpen}
        onOpenChange={setAdjustmentOpen}
        item={selectedItem}
        onSaved={(item) => {
          if (item) {
            setSelectedItem(item);
          }
        }}
      />
      <InventoryActionModal
        kind="receive"
        open={receiveOpen}
        onOpenChange={setReceiveOpen}
        seedProduct={
          selectedItem
            ? data.products.find((product) => product.sku === selectedItem.sku) ?? null
            : null
        }
      />
      <InventoryMovementSheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        item={selectedItem}
        movements={activeMovements}
      />
    </AppShell>
  );
};

export default Inventory;

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { PurchaseOrderModal } from "@/components/modals/PurchaseOrderModal";
import { NewReceiveModal } from "@/components/modals/NewReceiveModal";
import { ExpenseModal } from "@/components/modals/ExpenseModal";
import { PurchaseDocumentSheet } from "@/components/purchases/PurchaseDocumentSheet";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { ListToolbar } from "@/components/ui-kit/ListToolbar";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadDocumentPdf, exportResource, fetchDocument } from "@/lib/api";
import { fmtTHB } from "@/lib/demo-data";
import { useAppData } from "@/lib/app-data";
import type { PurchaseDocumentRecord } from "@/lib/types";
import { MoreHorizontal, PackagePlus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

const summaryToRecord = (summary: { id: string; party: string; date: string; amount: number; status: string }) =>
  ({
    id: summary.id,
    vendor: summary.party,
    date: summary.date,
    amount: summary.amount,
    status: summary.status,
    currency: "THB",
  }) as PurchaseDocumentRecord;

const PurchaseOrders = () => {
  const location = useLocation();
  const { data } = useAppData();
  const [search, setSearch] = useState(() => new URLSearchParams(location.search).get("vendor") ?? "");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeDocument, setActiveDocument] = useState<PurchaseDocumentRecord | null>(null);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.purchaseOrders.filter((row) => {
      if (!query) {
        return true;
      }
      return row.id.toLowerCase().includes(query) || row.party.toLowerCase().includes(query);
    });
  }, [data.purchaseOrders, search]);

  useEffect(() => {
    if (!sheetOpen || !activeDocument?.id) {
      return;
    }

    void fetchDocument<PurchaseDocumentRecord>("purchase_order", activeDocument.id)
      .then(setActiveDocument)
      .catch(() => undefined);
  }, [activeDocument?.id, sheetOpen]);

  const openDocument = async (documentId: string) => {
    const fallback = data.purchaseOrders.find((row) => row.id === documentId);
    setActiveDocument(fallback ? summaryToRecord(fallback) : null);
    setSheetOpen(true);
    try {
      const detailed = await fetchDocument<PurchaseDocumentRecord>("purchase_order", documentId);
      setActiveDocument(detailed);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load purchase order.");
    }
  };

  const openEdit = async (documentId: string) => {
    try {
      const detailed = await fetchDocument<PurchaseDocumentRecord>("purchase_order", documentId);
      setActiveDocument(detailed);
      setEditOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load purchase order.");
    }
  };

  const toggleSelection = (documentId: string, checked: boolean) => {
    setSelectedIds((current) =>
      checked ? Array.from(new Set([...current, documentId])) : current.filter((id) => id !== documentId)
    );
  };

  const handleExport = async () => {
    try {
      await exportResource("purchase-orders");
      toast.success("Purchase orders exported");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to export purchase orders.");
    }
  };

  const handlePdf = async (documentId: string) => {
    try {
      await downloadDocumentPdf("purchase_order", documentId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to generate PDF.");
    }
  };

  const activeSource =
    activeDocument ??
    (() => {
      if (selectedIds.length !== 1) {
        return null;
      }
      const selectedSummary = data.purchaseOrders.find((row) => row.id === selectedIds[0]);
      return selectedSummary ? summaryToRecord(selectedSummary) : null;
    })();

  return (
    <AppShell>
      <PageHeader
        title="Purchase Orders"
        description="Create, edit, and convert vendor orders into goods received or expense workflows."
        breadcrumbs={[{ label: "Purchases & Expenses" }, { label: "Purchase Orders" }]}
      />

      <ListToolbar
        searchPlaceholder="Search purchase orders or vendors..."
        searchValue={search}
        onSearchChange={setSearch}
        primaryAction={{ label: "New Purchase Order", onClick: () => setCreateOpen(true) }}
        onExportClick={() => void handleExport()}
        extra={
          selectedIds.length > 0 ? (
            <Button variant="outline" size="sm" onClick={() => setReceiveOpen(true)}>
              Convert Selected
            </Button>
          ) : null
        }
      />

      <Card className="card-premium overflow-hidden">
        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50">
                <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="w-10 px-4 py-3">
                    <Checkbox
                      checked={rows.length > 0 && selectedIds.length === rows.length}
                      onCheckedChange={(checked) =>
                        setSelectedIds(checked ? rows.map((row) => row.id) : [])
                      }
                    />
                  </th>
                  <th className="px-3 py-3 text-left font-semibold">Document</th>
                  <th className="px-3 py-3 text-left font-semibold">Vendor</th>
                  <th className="px-3 py-3 text-left font-semibold">Date</th>
                  <th className="px-3 py-3 text-right font-semibold">Amount</th>
                  <th className="px-3 py-3 text-left font-semibold">Status</th>
                  <th className="w-10 px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-t border-border/50 hover:bg-secondary/30"
                    onClick={() => void openDocument(row.id)}
                  >
                    <td className="px-4 py-3.5" onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.includes(row.id)}
                        onCheckedChange={(checked) => toggleSelection(row.id, Boolean(checked))}
                      />
                    </td>
                    <td className="px-3 py-3.5 font-mono text-xs font-semibold text-primary">{row.id}</td>
                    <td className="px-3 py-3.5 font-medium">{row.party}</td>
                    <td className="px-3 py-3.5 text-muted-foreground">{row.date}</td>
                    <td className="px-3 py-3.5 text-right font-semibold tabular-nums">{fmtTHB(row.amount)}</td>
                    <td className="px-3 py-3.5">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-3.5" onClick={(event) => event.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => void openDocument(row.id)}>View details</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void openEdit(row.id)}>Edit purchase order</DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async () => {
                              const detailed = await fetchDocument<PurchaseDocumentRecord>("purchase_order", row.id);
                              setActiveDocument(detailed);
                              setReceiveOpen(true);
                            }}
                          >
                            Convert to goods received
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async () => {
                              const detailed = await fetchDocument<PurchaseDocumentRecord>("purchase_order", row.id);
                              setActiveDocument(detailed);
                              setExpenseOpen(true);
                            }}
                          >
                            Convert to expense
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void handlePdf(row.id)}>Generate PDF</DropdownMenuItem>
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
            title="No purchase orders yet"
            description="Create your first PO, then convert it into goods received or an expense record."
            action={{ label: "New Purchase Order", onClick: () => setCreateOpen(true) }}
            icon={<ShoppingCart className="h-10 w-10 text-primary" />}
          />
        )}
      </Card>

      <PurchaseOrderModal open={createOpen} onOpenChange={setCreateOpen} />
      <PurchaseOrderModal
        open={editOpen}
        onOpenChange={setEditOpen}
        document={activeDocument}
        onSaved={(document) => setActiveDocument(document)}
      />
      <NewReceiveModal
        open={receiveOpen}
        onOpenChange={setReceiveOpen}
        sourcePurchaseOrder={activeSource}
      />
      <ExpenseModal
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        sourceDocumentId={activeSource?.id}
        sourceDocumentType="purchase_order"
        seed={
          activeSource
            ? {
                vendor: activeSource.vendor,
                amount: activeSource.amount,
                date: activeSource.date,
                notes: activeSource.notes,
              }
            : null
        }
      />
      <PurchaseDocumentSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        kind="purchase_order"
        document={activeDocument}
        data={data}
        onEdit={(document) => {
          setActiveDocument(document as PurchaseDocumentRecord);
          setEditOpen(true);
        }}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setReceiveOpen(true)}>
              <PackagePlus className="h-4 w-4" /> Goods Received
            </Button>
            <Button variant="outline" size="sm" onClick={() => setExpenseOpen(true)}>
              Convert to Expense
            </Button>
          </>
        }
      />
    </AppShell>
  );
};

export default PurchaseOrders;

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { NewReceiveModal } from "@/components/modals/NewReceiveModal";
import { ExpenseModal } from "@/components/modals/ExpenseModal";
import { PurchaseDocumentSheet } from "@/components/purchases/PurchaseDocumentSheet";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { ListToolbar } from "@/components/ui-kit/ListToolbar";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Boxes, MoreHorizontal } from "lucide-react";
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

const GoodsReceived = () => {
  const { data } = useAppData();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeDocument, setActiveDocument] = useState<PurchaseDocumentRecord | null>(null);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.receives.filter((row) => {
      if (!query) {
        return true;
      }
      return row.id.toLowerCase().includes(query) || row.party.toLowerCase().includes(query);
    });
  }, [data.receives, search]);

  useEffect(() => {
    if (!sheetOpen || !activeDocument?.id) {
      return;
    }
    void fetchDocument<PurchaseDocumentRecord>("receive", activeDocument.id)
      .then(setActiveDocument)
      .catch(() => undefined);
  }, [activeDocument?.id, sheetOpen]);

  const handleOpenDocument = async (documentId: string) => {
    const fallback = data.receives.find((row) => row.id === documentId);
    setActiveDocument(fallback ? summaryToRecord(fallback) : null);
    setSheetOpen(true);
    try {
      const detailed = await fetchDocument<PurchaseDocumentRecord>("receive", documentId);
      setActiveDocument(detailed);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load goods received.");
    }
  };

  const handleExport = async () => {
    try {
      await exportResource("receives");
      toast.success("Goods received exported");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to export goods received.");
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Goods Received"
        description="Capture received quantities, costs, evidence files, and links back to purchase orders."
        breadcrumbs={[{ label: "Purchases & Expenses" }, { label: "Goods Received" }]}
      />

      <ListToolbar
        searchPlaceholder="Search goods received or vendor..."
        searchValue={search}
        onSearchChange={setSearch}
        primaryAction={{ label: "New Goods Received", onClick: () => setCreateOpen(true) }}
        onExportClick={() => void handleExport()}
      />

      <Card className="card-premium overflow-hidden">
        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50">
                <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 text-left font-semibold">Document</th>
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
                    onClick={() => void handleOpenDocument(row.id)}
                  >
                    <td className="px-4 py-3.5 font-mono text-xs font-semibold text-primary">{row.id}</td>
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
                          <DropdownMenuItem onClick={() => void handleOpenDocument(row.id)}>View details</DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async () => {
                              const detailed = await fetchDocument<PurchaseDocumentRecord>("receive", row.id);
                              setActiveDocument(detailed);
                              setEditOpen(true);
                            }}
                          >
                            Edit receive
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async () => {
                              const detailed = await fetchDocument<PurchaseDocumentRecord>("receive", row.id);
                              setActiveDocument(detailed);
                              setExpenseOpen(true);
                            }}
                          >
                            Convert to expense
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void downloadDocumentPdf("receive", row.id)}>
                            Generate PDF
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
            title="No goods received yet"
            description="Create a standalone receipt or convert a purchase order into an inventory or operating-expense receive."
            action={{ label: "New Goods Received", onClick: () => setCreateOpen(true) }}
            icon={<Boxes className="h-10 w-10 text-primary" />}
          />
        )}
      </Card>

      <NewReceiveModal open={createOpen} onOpenChange={setCreateOpen} />
      <NewReceiveModal
        open={editOpen}
        onOpenChange={setEditOpen}
        document={activeDocument}
        onSaved={(document) => setActiveDocument(document)}
      />
      <ExpenseModal
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        sourceDocumentId={activeDocument?.id}
        sourceDocumentType="receive"
        seed={
          activeDocument
            ? {
                vendor: activeDocument.vendor,
                amount: activeDocument.amount,
                date: activeDocument.date,
                notes: activeDocument.notes,
                category: activeDocument.receiveType === "inventory" ? "Inventory" : "Professional Services",
              }
            : null
        }
      />
      <PurchaseDocumentSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        kind="receive"
        document={activeDocument}
        data={data}
        onEdit={(document) => {
          setActiveDocument(document as PurchaseDocumentRecord);
          setEditOpen(true);
        }}
      />
    </AppShell>
  );
};

export default GoodsReceived;

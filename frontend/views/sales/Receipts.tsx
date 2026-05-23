import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { CombinedReceiptModal } from "@/components/modals/CombinedReceiptModal";
import { SalesDocumentSheet } from "@/components/sales/SalesDocumentSheet";
import { SalesDocumentTable } from "@/components/sales/SalesDocumentTable";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { ListToolbar } from "@/components/ui-kit/ListToolbar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppData } from "@/lib/app-data";
import { downloadDocumentPdf, exportResource, fetchDocument } from "@/lib/api";
import { filterSummaries, summaryToSalesRecord } from "@/lib/sales";
import type { RecordStatus, SalesDocumentRecord } from "@/lib/types";
import { Download, MoreHorizontal, ReceiptText } from "lucide-react";
import { toast } from "sonner";

const Receipts = () => {
  const location = useLocation();
  const { data } = useAppData();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | RecordStatus>("all");
  const [variantFilter, setVariantFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<SalesDocumentRecord | null>(null);

  const receipts = useMemo(
    () =>
      filterSummaries(data.receipts, {
        query: search,
        statuses: statusFilter === "all" ? undefined : [statusFilter],
        variants: variantFilter === "all" ? undefined : [variantFilter],
      }),
    [data.receipts, search, statusFilter, variantFilter]
  );

  const loadReceipt = useCallback(async (receiptId: string) => {
    const fallback = data.receipts.find((receipt) => receipt.id === receiptId);

    try {
      return await fetchDocument<SalesDocumentRecord>("receipt", receiptId);
    } catch {
      return fallback ? summaryToSalesRecord(fallback) : null;
    }
  }, [data.receipts]);

  const openReceiptSheet = useCallback(async (receiptId: string) => {
    const detail = await loadReceipt(receiptId);
    if (!detail) {
      toast.error("Unable to open receipt.");
      return;
    }
    setActiveReceipt(detail);
    setSheetOpen(true);
  }, [loadReceipt]);

  useEffect(() => {
    const documentId = new URLSearchParams(location.search).get("document");
    if (!documentId) return;
    void openReceiptSheet(documentId);
  }, [location.search, openReceiptSheet]);

  const handleExport = async () => {
    try {
      await exportResource("receipts");
      toast.success("Receipts exported");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to export receipts.");
    }
  };

  const handleDownloadPdf = async (receiptId: string) => {
    try {
      await downloadDocumentPdf("receipt", receiptId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to download receipt PDF.");
    }
  };

  const handleBulkDownload = async () => {
    if (selectedIds.length === 0) {
      return;
    }

    try {
      for (const receiptId of selectedIds) {
        await downloadDocumentPdf("receipt", receiptId);
      }
      toast.success(`${selectedIds.length} receipt PDF(s) requested`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to download receipt PDFs.");
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Receipts"
        description="Record receipts from invoices or billing documents, including receipt footer adjustments and split collections."
        breadcrumbs={[{ label: "Sales" }, { label: "Receipts" }]}
      />

      <ListToolbar
        searchPlaceholder="Search receipt number, customer, variant..."
        searchValue={search}
        onSearchChange={setSearch}
        primaryAction={{ label: "New Receipt", onClick: () => setReceiptModalOpen(true) }}
        onExportClick={() => void handleExport()}
        extra={
          <>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as "all" | RecordStatus)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>

            <Select value={variantFilter} onValueChange={setVariantFilter}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All variants</SelectItem>
                <SelectItem value="tax-receipt">Tax receipt</SelectItem>
                <SelectItem value="receipt-only">Receipt only</SelectItem>
              </SelectContent>
            </Select>

            {selectedIds.length > 0 ? (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void handleBulkDownload()}>
                <Download className="h-4 w-4" /> PDFs
              </Button>
            ) : null}
          </>
        }
      />

      <SalesDocumentTable
        documents={receipts}
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        onRowClick={(summary) => void openReceiptSheet(summary.id)}
        emptyTitle="No receipts yet"
        emptyDescription="Create combined or partial receipts from invoices and billing documents."
        emptyAction={{ label: "New Receipt", onClick: () => setReceiptModalOpen(true) }}
        renderRowActions={(summary) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void openReceiptSheet(summary.id)}>
                View receipt
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleDownloadPdf(summary.id)}>
                Download PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <SalesDocumentSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        kind="receipt"
        document={activeReceipt}
        data={data}
        actions={
          activeReceipt ? (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void handleDownloadPdf(activeReceipt.id)}>
              <ReceiptText className="h-4 w-4" /> Receipt PDF
            </Button>
          ) : null
        }
      />

      <CombinedReceiptModal open={receiptModalOpen} onOpenChange={setReceiptModalOpen} />
    </AppShell>
  );
};

export default Receipts;

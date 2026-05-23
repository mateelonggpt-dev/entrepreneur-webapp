import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { CombinedBillingModal } from "@/components/modals/CombinedBillingModal";
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
import { HandCoins, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

const Billing = () => {
  const location = useLocation();
  const { data } = useAppData();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | RecordStatus>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [billingModalOpen, setBillingModalOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [activeBilling, setActiveBilling] = useState<SalesDocumentRecord | null>(null);

  const billings = useMemo(
    () =>
      filterSummaries(data.billings, {
        query: search,
        statuses: statusFilter === "all" ? undefined : [statusFilter],
      }),
    [data.billings, search, statusFilter]
  );

  const loadBilling = useCallback(async (billingId: string) => {
    const fallback = data.billings.find((billing) => billing.id === billingId);

    try {
      return await fetchDocument<SalesDocumentRecord>("billing", billingId);
    } catch {
      return fallback ? summaryToSalesRecord(fallback) : null;
    }
  }, [data.billings]);

  const openBillingSheet = useCallback(async (billingId: string) => {
    const detail = await loadBilling(billingId);
    if (!detail) {
      toast.error("Unable to open billing document.");
      return;
    }
    setActiveBilling(detail);
    setSheetOpen(true);
  }, [loadBilling]);

  useEffect(() => {
    const documentId = new URLSearchParams(location.search).get("document");
    if (!documentId) return;
    void openBillingSheet(documentId);
  }, [location.search, openBillingSheet]);

  const handleExport = async () => {
    try {
      await exportResource("billings");
      toast.success("Billing documents exported");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to export billing documents.");
    }
  };

  const handleDownloadPdf = async (billingId: string) => {
    try {
      await downloadDocumentPdf("billing", billingId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to download billing PDF.");
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Billing"
        description="Group invoices into billing runs, track billing statuses, and convert billing documents into receipts."
        breadcrumbs={[{ label: "Sales" }, { label: "Billing" }]}
      />

      <ListToolbar
        searchPlaceholder="Search billing number, customer, variant..."
        searchValue={search}
        onSearchChange={setSearch}
        primaryAction={{ label: "New Billing", onClick: () => setBillingModalOpen(true) }}
        onExportClick={() => void handleExport()}
        extra={
          <>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as "all" | RecordStatus)}
            >
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending_bill">Pending bill</SelectItem>
                <SelectItem value="billed">Billed</SelectItem>
                <SelectItem value="invoiced">Invoiced</SelectItem>
              </SelectContent>
            </Select>

            {selectedIds.length === 1 ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setActiveBilling(null);
                  setReceiptModalOpen(true);
                }}
              >
                <HandCoins className="h-4 w-4" /> Create Receipt
              </Button>
            ) : null}
          </>
        }
      />

      <SalesDocumentTable
        documents={billings}
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        onRowClick={(summary) => void openBillingSheet(summary.id)}
        emptyTitle="No billing documents yet"
        emptyDescription="Create combined billing documents from eligible invoices and follow them through collection."
        emptyAction={{ label: "New Billing", onClick: () => setBillingModalOpen(true) }}
        renderRowActions={(summary) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void openBillingSheet(summary.id)}>
                View billing
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  const detail = await loadBilling(summary.id);
                  if (detail) {
                    setActiveBilling(detail);
                    setReceiptModalOpen(true);
                  }
                }}
              >
                Create receipt
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
        kind="billing"
        document={activeBilling}
        data={data}
        actions={
          activeBilling ? (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setReceiptModalOpen(true)}>
              <HandCoins className="h-4 w-4" /> Create Receipt
            </Button>
          ) : null
        }
      />

      <CombinedBillingModal open={billingModalOpen} onOpenChange={setBillingModalOpen} />

      <CombinedReceiptModal
        open={receiptModalOpen}
        onOpenChange={setReceiptModalOpen}
        sourceBillingId={activeBilling?.id ?? (selectedIds.length === 1 ? selectedIds[0] : "")}
      />
    </AppShell>
  );
};

export default Billing;

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { DebitNoteModal } from "@/components/modals/DebitNoteModal";
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
import { ArrowUpCircle, Download, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

const DebitNotes = () => {
  const location = useLocation();
  const { data } = useAppData();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | RecordStatus>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [sourceInvoiceId, setSourceInvoiceId] = useState<string | undefined>(undefined);
  const [activeDebitNote, setActiveDebitNote] = useState<SalesDocumentRecord | null>(null);

  const debitNotes = useMemo(
    () =>
      filterSummaries(data.debitNotes, {
        query: search,
        statuses: statusFilter === "all" ? undefined : [statusFilter],
      }),
    [data.debitNotes, search, statusFilter]
  );

  const loadDebitNote = useCallback(async (debitNoteId: string) => {
    const fallback = data.debitNotes.find((note) => note.id === debitNoteId);

    try {
      return await fetchDocument<SalesDocumentRecord>("debit_note", debitNoteId);
    } catch {
      return fallback ? summaryToSalesRecord(fallback) : null;
    }
  }, [data.debitNotes]);

  const openDebitNoteSheet = useCallback(async (debitNoteId: string) => {
    const detail = await loadDebitNote(debitNoteId);
    if (!detail) {
      toast.error("Unable to open debit note.");
      return;
    }
    setActiveDebitNote(detail);
    setSheetOpen(true);
  }, [loadDebitNote]);

  useEffect(() => {
    const documentId = new URLSearchParams(location.search).get("document");
    if (!documentId) return;
    void openDebitNoteSheet(documentId);
  }, [location.search, openDebitNoteSheet]);

  const handleExport = async () => {
    try {
      await exportResource("debit-notes");
      toast.success("Debit notes exported");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to export debit notes.");
    }
  };

  const handleDownloadPdf = async (debitNoteId: string) => {
    try {
      await downloadDocumentPdf("debit_note", debitNoteId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to download debit note PDF.");
    }
  };

  const handleBulkDownload = async () => {
    if (selectedIds.length === 0) {
      return;
    }

    try {
      for (const debitNoteId of selectedIds) {
        await downloadDocumentPdf("debit_note", debitNoteId);
      }
      toast.success(`${selectedIds.length} debit note PDF(s) requested`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to download debit note PDFs.");
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Debit Notes"
        description="Increase invoice values, capture post-billing uplifts, and store stock-cut policy decisions in one place."
        breadcrumbs={[{ label: "Sales" }, { label: "Debit Notes" }]}
      />

      <ListToolbar
        searchPlaceholder="Search debit note number, customer..."
        searchValue={search}
        onSearchChange={setSearch}
        primaryAction={{
          label: "New Debit Note",
          onClick: () => {
            setSourceInvoiceId(undefined);
            setModalOpen(true);
          },
        }}
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
                <SelectItem value="approved">Approved</SelectItem>
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
        documents={debitNotes}
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        onRowClick={(summary) => void openDebitNoteSheet(summary.id)}
        emptyTitle="No debit notes yet"
        emptyDescription="Create debit notes from source invoices or as standalone sales adjustments."
        emptyAction={{
          label: "New Debit Note",
          onClick: () => {
            setSourceInvoiceId(undefined);
            setModalOpen(true);
          },
        }}
        renderRowActions={(summary) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void openDebitNoteSheet(summary.id)}>
                View debit note
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
        kind="debit_note"
        document={activeDebitNote}
        data={data}
        actions={
          activeDebitNote?.relatedInvoice ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setSourceInvoiceId(activeDebitNote.relatedInvoice);
                setModalOpen(true);
              }}
            >
              <ArrowUpCircle className="h-4 w-4" /> Create Another
            </Button>
          ) : null
        }
      />

      <DebitNoteModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        sourceInvoiceId={sourceInvoiceId}
      />
    </AppShell>
  );
};

export default DebitNotes;

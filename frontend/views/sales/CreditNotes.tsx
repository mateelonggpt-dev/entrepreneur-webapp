import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { CreditNoteModal } from "@/components/modals/CreditNoteModal";
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
import { ArrowDownCircle, Download, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

const CreditNotes = () => {
  const location = useLocation();
  const { data } = useAppData();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | RecordStatus>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [sourceInvoiceId, setSourceInvoiceId] = useState<string | undefined>(undefined);
  const [activeCreditNote, setActiveCreditNote] = useState<SalesDocumentRecord | null>(null);

  const creditNotes = useMemo(
    () =>
      filterSummaries(data.creditNotes, {
        query: search,
        statuses: statusFilter === "all" ? undefined : [statusFilter],
      }),
    [data.creditNotes, search, statusFilter]
  );

  const loadCreditNote = useCallback(async (creditNoteId: string) => {
    const fallback = data.creditNotes.find((note) => note.id === creditNoteId);

    try {
      return await fetchDocument<SalesDocumentRecord>("credit_note", creditNoteId);
    } catch {
      return fallback ? summaryToSalesRecord(fallback) : null;
    }
  }, [data.creditNotes]);

  const openCreditNoteSheet = useCallback(async (creditNoteId: string) => {
    const detail = await loadCreditNote(creditNoteId);
    if (!detail) {
      toast.error("Unable to open credit note.");
      return;
    }
    setActiveCreditNote(detail);
    setSheetOpen(true);
  }, [loadCreditNote]);

  useEffect(() => {
    const documentId = new URLSearchParams(location.search).get("document");
    if (!documentId) return;
    void openCreditNoteSheet(documentId);
  }, [location.search, openCreditNoteSheet]);

  const handleExport = async () => {
    try {
      await exportResource("credit-notes");
      toast.success("Credit notes exported");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to export credit notes.");
    }
  };

  const handleDownloadPdf = async (creditNoteId: string) => {
    try {
      await downloadDocumentPdf("credit_note", creditNoteId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to download credit note PDF.");
    }
  };

  const handleBulkDownload = async () => {
    if (selectedIds.length === 0) {
      return;
    }

    try {
      for (const creditNoteId of selectedIds) {
        await downloadDocumentPdf("credit_note", creditNoteId);
      }
      toast.success(`${selectedIds.length} credit note PDF(s) requested`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to download credit note PDFs.");
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Credit Notes"
        description="Track invoice reversals and post-sale reductions, including separate flows for paid or already-closed cases."
        breadcrumbs={[{ label: "Sales" }, { label: "Credit Notes" }]}
      />

      <ListToolbar
        searchPlaceholder="Search credit note number, customer..."
        searchValue={search}
        onSearchChange={setSearch}
        primaryAction={{
          label: "New Credit Note",
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
        documents={creditNotes}
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        onRowClick={(summary) => void openCreditNoteSheet(summary.id)}
        emptyTitle="No credit notes yet"
        emptyDescription="Create invoice-linked or standalone credit notes when you need to reduce customer receivables."
        emptyAction={{
          label: "New Credit Note",
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
              <DropdownMenuItem onClick={() => void openCreditNoteSheet(summary.id)}>
                View credit note
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
        kind="credit_note"
        document={activeCreditNote}
        data={data}
        actions={
          activeCreditNote?.relatedInvoice ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setSourceInvoiceId(activeCreditNote.relatedInvoice);
                setModalOpen(true);
              }}
            >
              <ArrowDownCircle className="h-4 w-4" /> Create Another
            </Button>
          ) : null
        }
      />

      <CreditNoteModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        sourceInvoiceId={sourceInvoiceId}
      />
    </AppShell>
  );
};

export default CreditNotes;

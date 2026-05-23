import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { QuotationModal } from "@/components/modals/QuotationModal";
import { InstallmentModal } from "@/components/modals/InstallmentModal";
import { DepositDocumentModal } from "@/components/modals/DepositDocumentModal";
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
import { createDocument, downloadDocumentPdf, exportResource, fetchDocument } from "@/lib/api";
import {
  addDaysToDateInputValue,
  filterSummaries,
  getLocalDateInputValue,
  summaryToSalesRecord,
} from "@/lib/sales";
import type { RecordStatus, SalesDocumentRecord } from "@/lib/types";
import { FilePlus2, Layers3, MoreHorizontal, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const Quotations = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { data, refresh } = useAppData();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | RecordStatus>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [quotationModalOpen, setQuotationModalOpen] = useState(false);
  const [installmentOpen, setInstallmentOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [activeQuotation, setActiveQuotation] = useState<SalesDocumentRecord | null>(null);
  const [editingQuotation, setEditingQuotation] = useState<SalesDocumentRecord | null>(null);

  const quotations = useMemo(
    () =>
      filterSummaries(data.quotations, {
        query: search,
        statuses: statusFilter === "all" ? undefined : [statusFilter],
      }),
    [data.quotations, search, statusFilter]
  );

  const loadQuotation = useCallback(async (quotationId: string) => {
    const fallback = data.quotations.find((quotation) => quotation.id === quotationId);

    try {
      const detail = await fetchDocument<SalesDocumentRecord>("quotation", quotationId);
      return detail;
    } catch {
      return fallback ? summaryToSalesRecord(fallback) : null;
    }
  }, [data.quotations]);

  const openQuotationSheet = useCallback(async (quotationId: string) => {
    const detail = await loadQuotation(quotationId);
    if (!detail) {
      toast.error(t("quotationPage.openError", { defaultValue: "Unable to open quotation." }));
      return;
    }

    setActiveQuotation(detail);
    setSheetOpen(true);
  }, [loadQuotation, t]);

  useEffect(() => {
    const documentId = new URLSearchParams(location.search).get("document");
    if (!documentId) return;
    void openQuotationSheet(documentId);
  }, [location.search, openQuotationSheet]);

  const handleExport = async () => {
    try {
      await exportResource("quotations");
      toast.success(t("quotationPage.exportSuccess", { defaultValue: "Quotations exported" }));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("quotationPage.exportError", { defaultValue: "Unable to export quotations." })
      );
    }
  };

  const handleDownloadPdf = async (quotationId: string) => {
    try {
      await downloadDocumentPdf("quotation", quotationId);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("quotationPage.downloadError", { defaultValue: "Unable to download quotation PDF." })
      );
    }
  };

  const handleCreateInvoice = async (quotation: SalesDocumentRecord) => {
    if (!quotation.lines?.length) {
      toast.error(
        t("quotationPage.noLineItems", {
          defaultValue: "This quotation does not have any line items to convert.",
        })
      );
      return;
    }

    const issueDate = getLocalDateInputValue();

    try {
      const created = await createDocument("invoice", {
        customer: quotation.customer,
        date: issueDate,
        due: addDaysToDateInputValue(issueDate, 30),
        reference: quotation.id,
        paymentTerms: quotation.paymentTerms ?? "Net 30",
        notes: t("quotationPage.convertedNote", {
          defaultValue: "Converted from quotation {{quotationId}}.",
          quotationId: quotation.id,
        }),
        status: "pending",
        currency: quotation.currency ?? "THB",
        documentVariant: "quotation-conversion",
        parentQuotationId: quotation.id,
        sourceDocumentId: quotation.id,
        sourceDocumentType: "quotation",
        linkedDocumentIds: [quotation.id],
        lines: quotation.lines,
        timeline: [
          {
            who: "Sales",
            what: t("quotationPage.convertedTimeline", {
              defaultValue: "converted {{quotationId}} to invoice",
              quotationId: quotation.id,
            }),
            time: issueDate,
            type: "invoice",
          },
        ],
      });

      await refresh();
      toast.success(t("quotationPage.createInvoiceSuccess", {
        defaultValue: "Invoice {{id}} created",
        id: created.id,
      }), {
        description: t("quotationPage.createInvoiceDescription", {
          defaultValue: "Converted from quotation {{quotationId}}.",
          quotationId: quotation.id,
        }),
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("quotationPage.createInvoiceError", { defaultValue: "Unable to create invoice." })
      );
    }
  };

  const openEditModal = (quotation: SalesDocumentRecord) => {
    setEditingQuotation(quotation);
    setQuotationModalOpen(true);
  };

  const openInstallmentModal = async (quotationId: string) => {
    const detail = await loadQuotation(quotationId);
    if (!detail) {
      toast.error(
        t("quotationPage.openInstallmentError", {
          defaultValue: "Unable to open installment flow.",
        })
      );
      return;
    }
    setActiveQuotation(detail);
    setInstallmentOpen(true);
  };

  const openDepositModal = async (quotationId: string) => {
    const detail = await loadQuotation(quotationId);
    if (!detail) {
      toast.error(
        t("quotationPage.openDepositError", {
          defaultValue: "Unable to open deposit flow.",
        })
      );
      return;
    }
    setActiveQuotation(detail);
    setDepositOpen(true);
  };

  return (
    <AppShell>
      <PageHeader
        title={t("nav.quotations")}
        description={t("quotationPage.description", {
          defaultValue:
            "Prepare quotations, convert them into downstream sales documents, and track installment history.",
        })}
        breadcrumbs={[{ label: t("nav.sales") }, { label: t("nav.quotations") }]}
      />

      <ListToolbar
        searchPlaceholder={t("quotationPage.searchPlaceholder", {
          defaultValue: "Search quotation number, customer, variant...",
        })}
        searchValue={search}
        onSearchChange={setSearch}
        primaryAction={{
          label: t("module.actions.newQuotation"),
          onClick: () => {
            setEditingQuotation(null);
            setQuotationModalOpen(true);
          },
        }}
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
                <SelectItem value="all">{t("quotationPage.allStatuses", { defaultValue: "All statuses" })}</SelectItem>
                <SelectItem value="draft">{t("status.draft")}</SelectItem>
                <SelectItem value="pending">{t("status.pending")}</SelectItem>
                <SelectItem value="approved">{t("status.approved")}</SelectItem>
                <SelectItem value="cancelled">{t("status.cancelled", { defaultValue: "Cancelled" })}</SelectItem>
              </SelectContent>
            </Select>

            {selectedIds.length === 1 ? (
              <>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void openInstallmentModal(selectedIds[0])}>
                  <Layers3 className="h-4 w-4" /> {t("quotationPage.installments", { defaultValue: "Installments" })}
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void openDepositModal(selectedIds[0])}>
                  <Wallet className="h-4 w-4" /> {t("quotationPage.deposit", { defaultValue: "Deposit" })}
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <SalesDocumentTable
        documents={quotations}
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        onRowClick={(summary) => void openQuotationSheet(summary.id)}
        emptyTitle={t("quotationPage.emptyTitle", { defaultValue: "No quotations yet" })}
        emptyDescription={t("quotationPage.emptyDescription", {
          defaultValue:
            "Create your first quotation to start converting estimates into invoices, deposits, or installment documents.",
        })}
        emptyAction={{
          label: t("module.actions.newQuotation"),
          onClick: () => {
            setEditingQuotation(null);
            setQuotationModalOpen(true);
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
              <DropdownMenuItem onClick={() => void openQuotationSheet(summary.id)}>
                {t("quotationPage.view", { defaultValue: "View quotation" })}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  const detail = await loadQuotation(summary.id);
                  if (detail) {
                    openEditModal(detail);
                  }
                }}
              >
                {t("quotationPage.edit", { defaultValue: "Edit quotation" })}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void openInstallmentModal(summary.id)}>
                {t("quotationPage.createInstallments", { defaultValue: "Create installments" })}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void openDepositModal(summary.id)}>
                {t("quotationPage.createDeposit", { defaultValue: "Create deposit" })}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleDownloadPdf(summary.id)}>
                {t("quotationPage.downloadPdf", { defaultValue: "Download PDF" })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <SalesDocumentSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        kind="quotation"
        document={activeQuotation}
        data={data}
        onEdit={openEditModal}
        actions={
          activeQuotation ? (
            <>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void handleCreateInvoice(activeQuotation)}>
                <FilePlus2 className="h-4 w-4" /> {t("quotationPage.invoice", { defaultValue: "Invoice" })}
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setInstallmentOpen(true)}>
                <Layers3 className="h-4 w-4" /> {t("quotationPage.installments", { defaultValue: "Installments" })}
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setDepositOpen(true)}>
                <Wallet className="h-4 w-4" /> {t("quotationPage.deposit", { defaultValue: "Deposit" })}
              </Button>
            </>
          ) : null
        }
      />

      <QuotationModal
        open={quotationModalOpen}
        onOpenChange={setQuotationModalOpen}
        quotation={editingQuotation}
        onSaved={(quotation) => {
          setActiveQuotation(quotation);
          setEditingQuotation(quotation);
        }}
      />

      <InstallmentModal
        open={installmentOpen}
        onOpenChange={setInstallmentOpen}
        quotation={activeQuotation}
        onCreated={setActiveQuotation}
      />

      <DepositDocumentModal
        open={depositOpen}
        onOpenChange={setDepositOpen}
        quotation={activeQuotation}
        onCreated={setActiveQuotation}
      />
    </AppShell>
  );
};

export default Quotations;

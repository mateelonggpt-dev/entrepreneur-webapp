import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { DocumentTypeSelector } from "@/components/documents/DocumentTypeSelector";
import { CombinedReceiptModal } from "@/components/modals/CombinedReceiptModal";
import { CreditNoteModal } from "@/components/modals/CreditNoteModal";
import { DebitNoteModal } from "@/components/modals/DebitNoteModal";
import { QuotationModal } from "@/components/modals/QuotationModal";
import { SalesDocumentActionsMenu } from "@/components/sales/SalesDocumentActionsMenu";
import { SalesDocumentTable } from "@/components/sales/SalesDocumentTable";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { ListToolbar } from "@/components/ui-kit/ListToolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createDocument, downloadDocumentPdf, fetchDocument } from "@/lib/api";
import { useAppData } from "@/lib/app-data";
import {
  SALE_DOCUMENT_TYPE_OPTIONS,
  SALES_DOCUMENT_KIND_LABELS,
  invoiceToSalesSummary,
  saleDocumentRoute,
} from "@/lib/document-sections";
import {
  getActionSourceKind,
  getSalesDocumentActionType,
  type SalesDocumentActionId,
} from "@/lib/sales-document-actions";
import type { DocumentSummary, RecordStatus, SalesDocumentRecord } from "@/lib/types";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  FileCheck2,
  FileText,
  ReceiptText,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_FILTERS = ["all", "draft", "pending", "sent", "overdue", "partial", "paid", "approved"];

const Sales = () => {
  const nav = useNavigate();
  const { data, refresh } = useAppData();
  const [activeTab, setActiveTab] = useState("create");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["none"]);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [quotationOpen, setQuotationOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [creditNoteOpen, setCreditNoteOpen] = useState(false);
  const [debitNoteOpen, setDebitNoteOpen] = useState(false);

  const documents = useMemo<DocumentSummary[]>(
    () =>
      [
        ...data.quotations,
        ...data.invoices.map(invoiceToSalesSummary),
        ...data.receipts,
        ...data.billings,
        ...data.creditNotes,
        ...data.debitNotes,
        ...data.deposits,
      ]
        .map((summary) => ({
          ...summary,
          documentVariant: summary.documentVariant ?? SALES_DOCUMENT_KIND_LABELS[summary.kind],
        }))
        .sort((left, right) => right.date.localeCompare(left.date)),
    [data]
  );

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return documents.filter((summary) => {
      const matchesQuery =
        !query ||
        summary.id.toLowerCase().includes(query) ||
        summary.party.toLowerCase().includes(query) ||
        (summary.documentVariant ?? "").toLowerCase().includes(query);
      const matchesKind = kindFilter === "all" || summary.kind === kindFilter;
      const matchesStatus = statusFilter === "all" || summary.status === statusFilter;
      return matchesQuery && matchesKind && matchesStatus;
    });
  }, [documents, kindFilter, search, statusFilter]);

  const createActions = [
    {
      id: "quotation",
      label: "Create Quotation",
      thaiLabel: "สร้างใบเสนอราคา",
      icon: FileText,
      action: () => setQuotationOpen(true),
    },
    {
      id: "invoice",
      label: "Create Invoice",
      thaiLabel: "สร้างใบแจ้งหนี้",
      icon: FileCheck2,
      action: () => nav("/sales/invoices/new"),
    },
    {
      id: "tax_invoice",
      label: "Create Tax Invoice",
      thaiLabel: "สร้างใบกำกับภาษี",
      icon: ReceiptText,
      action: () => nav("/sales/invoices/new"),
    },
    {
      id: "credit_note",
      label: "Create Credit Note",
      thaiLabel: "สร้างใบลดหนี้",
      icon: ArrowDownCircle,
      action: () => setCreditNoteOpen(true),
    },
    {
      id: "debit_note",
      label: "Create Debit Note",
      thaiLabel: "สร้างใบเพิ่มหนี้",
      icon: ArrowUpCircle,
      action: () => setDebitNoteOpen(true),
    },
    {
      id: "receipt",
      label: "Create Receipt",
      thaiLabel: "สร้างใบเสร็จรับเงิน",
      icon: ReceiptText,
      action: () => setReceiptOpen(true),
    },
  ];

  const activeCreateActions = createActions.filter((action) => selectedTypes.includes(action.id));

  const openDocument = (summary: DocumentSummary) => {
    nav(selectedDocumentPath(summary));
  };

  const selectedDocumentPath = (summary: DocumentSummary, mode?: "edit") => {
    if (summary.kind === "invoice") {
      const suffix = mode ? "?mode=edit" : "";
      return `/sales/invoices/${encodeURIComponent(summary.id)}${suffix}`;
    }

    const params = new URLSearchParams({
      document: summary.id,
      type: getSalesDocumentActionType(summary),
    });
    if (mode) params.set("mode", mode);
    return `${saleDocumentRoute(summary)}?${params.toString()}`;
  };

  const createFromDocumentPath = (summary: DocumentSummary, documentType: string, extra?: Record<string, string>) => {
    const params = new URLSearchParams({
      documentTypes: documentType,
      sourceDocumentId: summary.id,
      sourceDocumentType: getActionSourceKind(summary),
      sourceDocumentNumber: summary.id,
      ...extra,
    });
    return `/income/create?${params.toString()}`;
  };

  const appendViewParams = (summary: DocumentSummary, params: Record<string, string>) => {
    const path = selectedDocumentPath(summary);
    const [base, query = ""] = path.split("?");
    const nextParams = new URLSearchParams(query);
    Object.entries(params).forEach(([key, value]) => nextParams.set(key, value));
    return `${base}?${nextParams.toString()}`;
  };

  const updateDocumentStatus = async (document: DocumentSummary, status: RecordStatus, successMessage: string) => {
    try {
      const detail = await fetchDocument<SalesDocumentRecord>(document.kind, document.id);
      await createDocument(document.kind, { ...detail, status });
      await refresh();
      toast.success(successMessage, { description: document.id });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Unable to update ${document.id}.`);
    }
  };

  const handleDocumentAction = async (action: SalesDocumentActionId, document: DocumentSummary) => {
    switch (action) {
      case "view":
        nav(selectedDocumentPath(document));
        return;
      case "edit":
        nav(selectedDocumentPath(document, "edit"));
        return;
      case "download_pdf":
        try {
          await downloadDocumentPdf(document.kind, document.id);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : `Unable to download PDF for ${document.id}.`);
        }
        return;
      case "duplicate":
      case "duplicate_recreate":
        nav(createFromDocumentPath(document, getSalesDocumentActionType(document), { duplicateDocumentId: document.id }));
        return;
      case "create_revision":
        nav(createFromDocumentPath(document, getSalesDocumentActionType(document), { revisionFromDocumentId: document.id }));
        return;
      case "create_invoice":
        nav(createFromDocumentPath(document, "invoice"));
        return;
      case "create_deposit_invoice":
        nav(createFromDocumentPath(document, "invoice", { documentVariant: "deposit_invoice" }));
        return;
      case "create_installment":
        nav(createFromDocumentPath(document, "invoice", { flow: "installment" }));
        return;
      case "create_delivery_note":
        nav(createFromDocumentPath(document, "delivery_note"));
        return;
      case "create_billing_note":
        nav(createFromDocumentPath(document, "billing_note"));
        return;
      case "create_tax_invoice":
        nav(createFromDocumentPath(document, "tax_invoice"));
        return;
      case "create_receipt":
      case "create_receipt_remaining":
        nav(createFromDocumentPath(document, "receipt"));
        return;
      case "record_payment":
        nav(appendViewParams(document, { tab: "payments", action: "record_payment" }));
        return;
      case "create_credit_note":
        nav(createFromDocumentPath(document, "credit_note"));
        return;
      case "create_debit_note":
        nav(createFromDocumentPath(document, "debit_note"));
        return;
      case "view_related_documents":
      case "view_related_invoice":
      case "view_related_invoices":
      case "view_receipt":
      case "view_payment_history":
      case "view_payment_details":
      case "view_application_history":
        nav(appendViewParams(document, { tab: "related" }));
        return;
      case "submit_for_approval":
        await updateDocumentStatus(document, "pending", "Submitted for approval");
        return;
      case "cancel_request":
        await updateDocumentStatus(document, "draft", "Approval request cancelled");
        return;
      case "approve":
        await updateDocumentStatus(document, "approved", "Document approved");
        return;
      case "reject":
        await updateDocumentStatus(document, "rejected", "Document rejected");
        return;
      case "cancel_void":
        await updateDocumentStatus(document, "void", "Document voided");
        return;
      case "delete":
        await updateDocumentStatus(document, "inactive", "Document soft deleted");
        return;
      case "apply_to_invoice":
        nav(appendViewParams(document, { action: "apply_to_invoice" }));
        return;
      default:
        toast.info(`${document.id}: action is not available.`);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Income"
        description="Create income documents or manage the full income document library from one place."
        breadcrumbs={[{ label: "Income" }]}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="h-auto rounded-xl bg-secondary/70 p-1">
          <TabsTrigger value="create" className="rounded-lg px-4 py-2">
            Create / สร้าง
          </TabsTrigger>
          <TabsTrigger value="documents" className="rounded-lg px-4 py-2">
            Documents / คลังเอกสาร
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="mt-0">
          <Card className="card-premium p-6">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold">Document types</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Select one or more income document types before starting a workflow.
                </p>
              </div>
              <Badge variant="secondary" className="w-fit">
                {selectedTypes.includes("none") ? "No document selected" : `${selectedTypes.length} selected`}
              </Badge>
            </div>

            <DocumentTypeSelector
              options={SALE_DOCUMENT_TYPE_OPTIONS}
              selectedValues={selectedTypes}
              onSelectedValuesChange={setSelectedTypes}
              otherMenuLabel="Other income documents"
            />

            <div className="mt-6 rounded-xl border border-border/70 bg-secondary/25 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Selected actions</h3>
                  <p className="text-xs text-muted-foreground">Open the matching existing sales workflow.</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedTypes(["none"])}>
                  Clear
                </Button>
              </div>

              {activeCreateActions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {activeCreateActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <Button key={action.id} variant="outline" className="h-auto gap-2 py-2.5" onClick={action.action}>
                        <Icon className="h-4 w-4 text-primary" />
                        <span className="flex flex-col items-start leading-tight">
                          <span>{action.label}</span>
                          <span className="text-xs font-normal text-muted-foreground">{action.thaiLabel}</span>
                        </span>
                      </Button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Choose a document type above. Selecting None clears every other choice.
                </p>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-0">
          <ListToolbar
            searchPlaceholder="Search income document number, customer, type..."
            searchValue={search}
            onSearchChange={setSearch}
            primaryAction={{ label: "Create", onClick: () => setActiveTab("create") }}
            extra={
              <>
                <Select value={kindFilter} onValueChange={setKindFilter}>
                  <SelectTrigger className="w-[190px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SALES_DOCUMENT_KIND_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_FILTERS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status === "all" ? "All statuses" : status[0].toUpperCase() + status.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            }
          />

          <SalesDocumentTable
            documents={filteredDocuments}
            selectedIds={selectedIds}
            onSelectedIdsChange={setSelectedIds}
            onRowClick={openDocument}
            emptyTitle="No income documents found"
            emptyDescription="Try another search or filter, or create a new income document."
            emptyAction={{ label: "Create", onClick: () => setActiveTab("create") }}
            renderRowActions={(summary) => (
              <SalesDocumentActionsMenu
                document={summary}
                allowApprovedEdit={!data.policySummary.lockDocumentsAfterPayment}
                onAction={(action, document) => void handleDocumentAction(action, document)}
              />
            )}
          />
        </TabsContent>
      </Tabs>

      <QuotationModal open={quotationOpen} onOpenChange={setQuotationOpen} />
      <CombinedReceiptModal open={receiptOpen} onOpenChange={setReceiptOpen} />
      <CreditNoteModal open={creditNoteOpen} onOpenChange={setCreditNoteOpen} />
      <DebitNoteModal open={debitNoteOpen} onOpenChange={setDebitNoteOpen} />
    </AppShell>
  );
};

export default Sales;

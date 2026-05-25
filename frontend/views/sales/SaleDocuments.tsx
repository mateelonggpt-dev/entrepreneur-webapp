import { useMemo, useState } from "react";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DocumentTypeSelector } from "@/components/documents/DocumentTypeSelector";
import { AppShell } from "@/components/layout/AppShell";
import { ConfigurableActionDrawer, ConfigurableActionModal } from "@/components/modals/DomainModals";
import { SalesDocumentActionsMenu } from "@/components/sales/SalesDocumentActionsMenu";
import { SalesDocumentTable } from "@/components/sales/SalesDocumentTable";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { ListToolbar } from "@/components/ui-kit/ListToolbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createDocument, downloadDocumentPdf, fetchDocument, removeDocument as removeDocumentApi } from "@/lib/api";
import { useAppData } from "@/lib/app-data";
import { useAuth } from "@/lib/auth";
import {
  SALE_DOCUMENT_TYPE_OPTIONS,
  SALES_DOCUMENT_KIND_LABELS,
  invoiceToSalesSummary,
  saleDocumentRoute,
  salesSummaryMatchesDocumentTypes,
} from "@/lib/document-sections";
import {
  getActionSourceKind,
  getSalesDocumentActionType,
  type SalesDocumentActionId,
} from "@/lib/sales-document-actions";
import { workflowStepSourceKind, workflowStepToDocumentType, type SalesWorkflowStepId } from "@/lib/sales-workflow";
import type { DocumentSummary, RecordStatus, SalesDocumentRecord } from "@/lib/types";
import { toast } from "sonner";
import { EvidenceAttachmentModal } from "@/components/modals/DomainModals";

const STATUS_FILTERS = ["all", "draft", "pending", "sent", "overdue", "partial", "paid", "approved"];
const PAYMENT_STATUS_FILTERS = ["all", "unpaid", "partial", "paid"];
const TAX_STATUS_FILTERS = ["all", "taxable", "non_tax"];

const SaleDocuments = () => {
  const nav = useNavigate();
  const location = useLocation();
  const { i18n } = useTranslation();
  const { data, refresh } = useAppData();
  const { user } = useAuth();
  const activeLanguage = i18n.language?.startsWith("th") ? "th" : "en";
  const canRemoveDocuments = user?.role === "owner";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [taxStatusFilter, setTaxStatusFilter] = useState("all");
  const [createdByFilter, setCreatedByFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [typeFilters, setTypeFilters] = useState<string[]>(["none"]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [commonAction, setCommonAction] = useState<{ action: SalesDocumentActionId; document: DocumentSummary } | null>(null);
  const [workflowAction, setWorkflowAction] = useState<{ action: SalesDocumentActionId; document: DocumentSummary } | null>(null);
  const [evidenceDocument, setEvidenceDocument] = useState<DocumentSummary | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const type = params.get("type");
    const documentId = params.get("document");
    if (type) {
      setTypeFilters([type]);
    }
    if (documentId) {
      setSearch(documentId);
    }
  }, [location.search]);

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
        .filter((summary) => !["inactive", "void", "cancelled"].includes(String(summary.status).toLowerCase()))
        .map((summary) => ({
          ...summary,
          documentVariant: summary.documentTitle ?? summary.documentVariant ?? SALES_DOCUMENT_KIND_LABELS[summary.kind],
        }))
        .sort((left, right) => right.date.localeCompare(left.date)),
    [data]
  );

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();
    const createdByQuery = createdByFilter.trim().toLowerCase();
    return documents.filter((summary) => {
      const summaryTypes = summary.documentTypes ?? [];
      const paymentStatus =
        summary.paymentSummary?.status ??
        (["paid"].includes(summary.status) ? "paid" : ["partial"].includes(summary.status) ? "partial" : "unpaid");
      const hasTaxDocument = summaryTypes.some((type) => ["tax_invoice", "short_tax_invoice"].includes(type));
      const matchesQuery =
        !query ||
        summary.id.toLowerCase().includes(query) ||
        summary.party.toLowerCase().includes(query) ||
        (summary.documentVariant ?? "").toLowerCase().includes(query) ||
        (summary.sourceDocumentNumber ?? summary.sourceDocumentId ?? "").toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || summary.status === statusFilter;
      const matchesTypes = salesSummaryMatchesDocumentTypes(summary, typeFilters);
      const matchesCustomer = customerFilter === "all" || summary.party === customerFilter;
      const matchesDateFrom = !dateFrom || summary.date >= dateFrom;
      const matchesDateTo = !dateTo || summary.date <= dateTo;
      const matchesPayment = paymentStatusFilter === "all" || paymentStatus === paymentStatusFilter;
      const matchesTax = taxStatusFilter === "all" || (taxStatusFilter === "taxable" ? hasTaxDocument : !hasTaxDocument);
      const matchesCreatedBy = !createdByQuery || "matter acc.".includes(createdByQuery);
      return matchesQuery && matchesStatus && matchesTypes && matchesCustomer && matchesDateFrom && matchesDateTo && matchesPayment && matchesTax && matchesCreatedBy;
    });
  }, [createdByFilter, customerFilter, dateFrom, dateTo, documents, paymentStatusFilter, search, statusFilter, taxStatusFilter, typeFilters]);

  const customerOptions = useMemo(
    () => Array.from(new Set(documents.map((summary) => summary.party).filter(Boolean))).sort(),
    [documents]
  );

  const openDocument = (summary: DocumentSummary) => {
    nav(selectedDocumentPath(summary));
  };

  const selectedDocumentPath = (summary: DocumentSummary, mode?: "edit") => {
    const params = new URLSearchParams({
      type: getSalesDocumentActionType(summary),
    });
    if (mode) params.set("mode", mode);
    return `/income/documents/${encodeURIComponent(summary.id)}?${params.toString()}`;
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

  const createFromWorkflowStep = (summary: DocumentSummary, step: SalesWorkflowStepId) => {
    const documentType = workflowStepToDocumentType(step);
    const params: Record<string, string> = {
      workflowSourceId: summary.id,
      workflowStep: step,
    };
    nav(createFromDocumentPath({ ...summary, kind: workflowStepSourceKind(summary) }, documentType, params));
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

  const isWorkflowAction = (action: SalesDocumentActionId) =>
    [
      "create_invoice",
      "create_deposit_invoice",
      "create_installment",
      "create_delivery_note",
      "create_billing_note",
      "create_tax_invoice",
      "create_receipt",
      "create_receipt_remaining",
      "create_credit_note",
      "create_debit_note",
      "apply_to_invoice",
    ].includes(action);

  const isCommonModalAction = (action: SalesDocumentActionId) =>
    [
      "download_pdf",
      "record_payment",
      "submit_for_approval",
      "cancel_request",
      "approve",
      "reject",
      "cancel_void",
      "delete",
      "view_payment_history",
      "view_payment_details",
      "view_application_history",
      "view_related_documents",
      "view_related_invoice",
      "view_related_invoices",
      "view_receipt",
    ].includes(action);

  const handleDocumentAction = async (action: SalesDocumentActionId, document: DocumentSummary) => {
    switch (action) {
      case "view":
        nav(selectedDocumentPath(document));
        return;
      case "edit":
        nav(selectedDocumentPath(document, "edit"));
        return;
      case "duplicate":
      case "duplicate_recreate":
        nav(createFromDocumentPath(document, getSalesDocumentActionType(document), {
          duplicateDocumentId: document.id,
          duplicateDocumentType: getActionSourceKind(document),
        }));
        toast.success(activeLanguage === "th" ? "คัดลอกเอกสารแล้ว กรุณาตรวจสอบก่อนบันทึก" : "Document duplicated. Review before saving.");
        return;
      case "create_from_reference":
        nav(createFromDocumentPath(document, getSalesDocumentActionType(document), { sourceDocumentId: document.id }));
        return;
      case "attach_evidence":
      case "view_evidence":
        setEvidenceDocument(document);
        return;
      case "create_revision":
        nav(createFromDocumentPath(document, getSalesDocumentActionType(document), { revisionFromDocumentId: document.id }));
        return;
      default:
        if (isWorkflowAction(action)) {
          setWorkflowAction({ action, document });
          return;
        }
        if (isCommonModalAction(action)) {
          setCommonAction({ action, document });
          return;
        }
        toast.info(`${document.id}: action is not available.`);
    }
  };

  const executeCommonAction = async () => {
    if (!commonAction) return;
    const { action, document } = commonAction;
    switch (action) {
      case "download_pdf":
        try {
          await downloadDocumentPdf(document.kind, document.id);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : `Unable to download PDF for ${document.id}.`);
        }
        break;
      case "record_payment":
        nav(appendViewParams(document, { tab: "payments", action: "record_payment" }));
        break;
      case "view_related_documents":
      case "view_related_invoice":
      case "view_related_invoices":
      case "view_receipt":
      case "view_payment_history":
      case "view_payment_details":
      case "view_application_history":
        nav(appendViewParams(document, { tab: "related" }));
        break;
      case "submit_for_approval":
        await updateDocumentStatus(document, "pending", "Submitted for approval");
        break;
      case "cancel_request":
        await updateDocumentStatus(document, "draft", "Approval request cancelled");
        break;
      case "approve":
        await updateDocumentStatus(document, "approved", "Document approved");
        break;
      case "reject":
        await updateDocumentStatus(document, "rejected", "Document rejected");
        break;
      case "cancel_void":
        await removeDocumentApi(document.kind, document.id, { mode: "void", preserveAuditTrail: true });
        await refresh();
        toast.success(activeLanguage === "th" ? "ยกเลิกเอกสารแล้ว" : "Document voided", { description: document.id });
        break;
      case "delete":
        await removeDocumentApi(document.kind, document.id, { mode: "delete", preserveAuditTrail: true });
        await refresh();
        toast.success(activeLanguage === "th" ? "ลบเอกสารแล้ว" : "Document deleted", { description: document.id });
        break;
      default:
        toast.info(`${document.id}: action is not available yet.`);
    }
    setCommonAction(null);
  };

  const executeWorkflowAction = () => {
    if (!workflowAction) return;
    const { action, document } = workflowAction;
    const routeByAction: Partial<Record<SalesDocumentActionId, string>> = {
      create_invoice: createFromDocumentPath(document, "invoice"),
      create_deposit_invoice: createFromDocumentPath(document, "invoice", { documentVariant: "deposit_invoice" }),
      create_installment: createFromDocumentPath(document, "invoice", { flow: "installment" }),
      create_delivery_note: createFromDocumentPath(document, "delivery_note"),
      create_billing_note: createFromDocumentPath(document, "invoice"),
      create_tax_invoice: createFromDocumentPath(document, "tax_invoice"),
      create_receipt: createFromDocumentPath(document, "receipt"),
      create_receipt_remaining: createFromDocumentPath(document, "receipt"),
      create_credit_note: createFromDocumentPath(document, "credit_note"),
      create_debit_note: createFromDocumentPath(document, "debit_note"),
      apply_to_invoice: appendViewParams(document, { action: "apply_to_invoice" }),
    };
    const route = routeByAction[action];
    setWorkflowAction(null);
    if (route) nav(route);
  };

  return (
    <AppShell>
      <PageHeader
        title="All Income Documents"
        description="Search, filter, and manage every income-related document in one table."
        breadcrumbs={[{ label: "Income" }, { label: "All Documents / คลังเอกสาร" }]}
      />

      <Card className="card-premium mb-4 p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-sm font-semibold">Income document filters</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Select multiple filters. None clears the selected document type filters.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setTypeFilters(["none"])}>
            Clear
          </Button>
        </div>
        <DocumentTypeSelector
          options={SALE_DOCUMENT_TYPE_OPTIONS}
          selectedValues={typeFilters}
          onSelectedValuesChange={setTypeFilters}
          language={activeLanguage}
          otherMenuLabel={activeLanguage === "th" ? "เอกสารอื่น ๆ" : "Other income filters"}
        />
      </Card>

      <ListToolbar
        searchPlaceholder="Search income document number, customer, type, reference..."
        searchValue={search}
        onSearchChange={setSearch}
        primaryAction={{ label: "Create", onClick: () => nav("/income/create") }}
        extra={
          <div className="flex flex-wrap gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status === "all" ? "All statuses" : status[0].toUpperCase() + status.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={customerFilter} onValueChange={setCustomerFilter}>
              <SelectTrigger className="w-[190px]"><SelectValue placeholder="Customer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All customers</SelectItem>
                {customerOptions.map((customer) => (
                  <SelectItem key={customer} value={customer}>{customer}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="w-[145px]" />
            <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="w-[145px]" />
            <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_STATUS_FILTERS.map((status) => (
                  <SelectItem key={status} value={status}>{status === "all" ? "All payments" : status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={taxStatusFilter} onValueChange={setTaxStatusFilter}>
              <SelectTrigger className="w-[135px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TAX_STATUS_FILTERS.map((status) => (
                  <SelectItem key={status} value={status}>{status === "all" ? "All tax" : status === "taxable" ? "Tax invoice" : "Non-tax"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={createdByFilter} onChange={(event) => setCreatedByFilter(event.target.value)} placeholder="Created by" className="w-[140px]" />
          </div>
        }
      />

      <SalesDocumentTable
        documents={filteredDocuments}
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        onRowClick={openDocument}
        emptyTitle="No income documents found"
        emptyDescription="Try another search or filter, or create a new income document."
        emptyAction={{ label: "Create", onClick: () => nav("/income/create") }}
        renderRowActions={(summary) => (
          <SalesDocumentActionsMenu
            document={summary}
            allowApprovedEdit={!data.policySummary.lockDocumentsAfterPayment}
            variant="shared"
            canRemove={canRemoveDocuments}
            onAction={(action, document) => void handleDocumentAction(action, document)}
          />
        )}
        allDocuments={documents}
        linkedDocumentGraph={data.linkedDocumentGraph}
        groupPacks={typeFilters.filter((type) => !["none", "others"].includes(type)).length === 0}
        onWorkflowCreateStep={createFromWorkflowStep}
        onAttachmentClick={setEvidenceDocument}
      />
      <ConfigurableActionModal
        open={Boolean(commonAction)}
        onOpenChange={(open) => !open && setCommonAction(null)}
        title={
          commonAction?.action === "delete"
            ? activeLanguage === "th"
              ? "ลบเอกสารนี้?"
              : "Delete this document?"
            : commonAction?.action === "cancel_void"
              ? activeLanguage === "th"
                ? "ยกเลิก/ทำให้เอกสารเป็นโมฆะ?"
                : "Void this document?"
              : "Document Action"
        }
        description={
          commonAction?.action === "delete"
            ? activeLanguage === "th"
              ? "การดำเนินการนี้จะซ่อนเอกสารออกจากรายการหลัก แต่ยังเก็บประวัติไว้เพื่อการตรวจสอบ"
              : "This will remove the document from active lists while keeping an audit trail."
            : commonAction?.action === "cancel_void"
              ? activeLanguage === "th"
                ? "เอกสารที่ออกแล้วจะถูกเก็บไว้ในประวัติและไม่แสดงในรายการหลัก"
                : "The issued document will be kept for audit history and removed from active lists."
              : "Confirm this action for the selected Income Document. Important actions are kept in the document activity/audit trail."
        }
        confirmLabel={
          commonAction?.action === "delete"
            ? activeLanguage === "th"
              ? "ลบเอกสาร"
              : "Delete document"
            : commonAction?.action === "cancel_void"
              ? activeLanguage === "th"
                ? "ยกเลิกเอกสาร"
                : "Void document"
              : undefined
        }
        onConfirm={executeCommonAction}
      >
          <div className="space-y-2 text-sm">
            <p className="font-medium">{commonAction?.document.id}</p>
          </div>
      </ConfigurableActionModal>
      <ConfigurableActionDrawer
        open={Boolean(workflowAction)}
        onOpenChange={(open) => !open && setWorkflowAction(null)}
        title="Workflow Action"
        description="Convert or create a related Income Document from the selected source document."
        onConfirm={executeWorkflowAction}
      >
          <div className="mt-6 rounded-lg border bg-secondary/30 p-4 text-sm">
            <p className="font-semibold">{workflowAction?.document.id}</p>
            <p className="mt-1 text-muted-foreground">
              The next document will keep the source document link and reference chain.
            </p>
          </div>
      </ConfigurableActionDrawer>
      <EvidenceAttachmentModal
        open={Boolean(evidenceDocument)}
        onOpenChange={(open) => !open && setEvidenceDocument(null)}
        entityType={evidenceDocument?.kind === "billing" ? "billing" : evidenceDocument?.kind}
        entityId={evidenceDocument?.id}
        onSaved={() => void refresh()}
      />
    </AppShell>
  );
};

export default SaleDocuments;

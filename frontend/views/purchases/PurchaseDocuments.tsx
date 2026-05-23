import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DocumentTypeSelector } from "@/components/documents/DocumentTypeSelector";
import { AppShell } from "@/components/layout/AppShell";
import {
  ConfigurableActionDrawer,
  ConfigurableActionModal,
  EvidenceAttachmentModal,
  ExpenseDocumentModal,
  PaymentActionModal,
} from "@/components/modals/DomainModals";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { ListToolbar } from "@/components/ui-kit/ListToolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { downloadDocumentPdf, downloadExpenseReceipt, downloadWithholdingTaxText, updateExpense } from "@/lib/api";
import { useAppData } from "@/lib/app-data";
import {
  PURCHASE_DOCUMENT_KIND_LABELS,
  PURCHASE_DOCUMENT_TYPE_OPTIONS,
  getRealDocumentTypes,
} from "@/lib/document-sections";
import { buildPayables, normalizePaymentSummary } from "@/lib/purchases";
import { readRemainingTasks, type RemainingTask } from "@/lib/remaining-tasks";
import type { DocumentKind, PaymentStatus, PurchaseDocumentRecord, RecordStatus, WithholdingTaxDocument } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Download, FileText, Mail, MoreHorizontal, Paperclip, Printer, RefreshCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

type ExpenseDocumentKind = "expense" | "purchase_order" | "receive" | "supplier_payment" | "withholding_tax";

type ExpenseDocumentRow = {
  id: string;
  kind: ExpenseDocumentKind;
  documentType: string;
  supplier: string;
  date: string;
  category: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  status: RecordStatus;
  paymentStatus: PaymentStatus | "not_applicable";
  relatedDocumentIds: string[];
  sourceDocumentId?: string;
  attachmentCount: number;
  raw: unknown;
};

type QuickAction =
  | "print"
  | "download_pdf"
  | "send_email"
  | "cancel"
  | "reset"
  | "delete";
type DrawerAction = "convert_to_receive" | "convert_to_expense" | "create_wht" | "edit_payment";

const STATUS_FILTERS = ["all", "draft", "pending", "approved", "partial", "paid", "completed", "void", "cancelled"];
const PAYMENT_FILTERS = ["all", "unpaid", "partial", "paid", "not_applicable"];
const EVIDENCE_FILTERS = [
  { value: "all", label: "All evidence" },
  { value: "missing_payment", label: "Missing payment evidence" },
  { value: "missing_invoice_receipt", label: "Missing invoice / receipt" },
  { value: "missing_delivery_evidence", label: "Missing delivery evidence" },
];

const money = (value: number, currency = "THB") =>
  `${currency} ${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const statusTone = (status: string) => {
  if (["paid", "completed", "approved"].includes(status)) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (["partial", "pending", "draft"].includes(status)) return "bg-amber-50 text-amber-800 border-amber-200";
  if (["void", "cancelled", "inactive"].includes(status)) return "bg-slate-100 text-slate-600 border-slate-200";
  return "bg-blue-50 text-blue-700 border-blue-200";
};

const PurchaseDocuments = () => {
  const nav = useNavigate();
  const { data, refresh } = useAppData();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [evidenceFilter, setEvidenceFilter] = useState("all");
  const [typeFilters, setTypeFilters] = useState<string[]>(() => {
    const params = new URLSearchParams(location.search);
    const type = params.get("type");
    return type ? [type] : ["none"];
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [remainingTasks, setRemainingTasks] = useState<RemainingTask[]>([]);
  const [activeRow, setActiveRow] = useState<ExpenseDocumentRow | null>(null);
  const [quickAction, setQuickAction] = useState<QuickAction | null>(null);
  const [drawerAction, setDrawerAction] = useState<DrawerAction | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [whtOpen, setWhtOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  const payables = useMemo(() => buildPayables(data), [data]);

  useEffect(() => {
    const load = () => setRemainingTasks(readRemainingTasks());
    load();
    window.addEventListener("matter.remainingTasksChanged", load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener("matter.remainingTasksChanged", load);
      window.removeEventListener("storage", load);
    };
  }, []);

  const rows = useMemo<ExpenseDocumentRow[]>(() => {
    const purchaseOrders = data.purchaseOrders.map((summary) => {
      const document = summary as unknown as Partial<PurchaseDocumentRecord>;
      const paymentSummary = normalizePaymentSummary(summary.amount, summary.paymentSummary);
      return {
        id: summary.id,
        kind: "purchase_order" as const,
        documentType: "Purchase Order",
        supplier: summary.party,
        date: summary.date,
        category: summary.documentVariant ?? "Purchase",
        amount: summary.amount,
        paidAmount: paymentSummary.paid,
        remainingAmount: paymentSummary.remaining,
        status: summary.status,
        paymentStatus: "not_applicable" as const,
        relatedDocumentIds: summary.linkedDocumentIds ?? document.relatedDocumentIds ?? [],
        sourceDocumentId: summary.sourceDocumentId,
        attachmentCount: summary.attachments?.length ?? summary.attachmentCount ?? document.attachments?.length ?? 0,
        raw: summary,
      };
    });

    const receives = data.receives.map((summary) => {
      const document = summary as unknown as Partial<PurchaseDocumentRecord>;
      const paymentSummary = normalizePaymentSummary(summary.amount, summary.paymentSummary);
      return {
        id: summary.id,
        kind: "receive" as const,
        documentType: "Goods Receipt",
        supplier: summary.party,
        date: summary.date,
        category: document.receiveType === "operating_expense" ? "Operating expense" : "Inventory receipt",
        amount: summary.amount,
        paidAmount: paymentSummary.paid,
        remainingAmount: paymentSummary.remaining,
        status: summary.status,
        paymentStatus: paymentSummary.status,
        relatedDocumentIds: summary.linkedDocumentIds ?? document.relatedDocumentIds ?? [],
        sourceDocumentId: summary.sourceDocumentId ?? document.relatedPurchaseOrderId,
        attachmentCount: summary.attachments?.length ?? summary.attachmentCount ?? document.attachments?.length ?? 0,
        raw: summary,
      };
    });

    const expenses = data.expenses.map((document) => {
      const paymentSummary = normalizePaymentSummary(document.amount, document.paymentSummary);
      return {
        id: document.id,
        kind: "expense" as const,
        documentType: "Expense",
        supplier: document.vendor,
        date: document.date,
        category: document.category,
        amount: document.amount,
        paidAmount: paymentSummary.paid,
        remainingAmount: paymentSummary.remaining,
        status: document.status,
        paymentStatus: paymentSummary.status,
        relatedDocumentIds: document.linkedDocumentIds ?? document.relatedDocumentIds ?? [],
        sourceDocumentId: document.sourceDocumentId,
        attachmentCount: document.attachments?.length ?? document.evidenceCount ?? 0,
        raw: document,
      };
    });

    const payments = data.vendorPayments.map((payment) => ({
      id: payment.id,
      kind: "supplier_payment" as const,
      documentType: "Supplier Payment",
      supplier: payment.vendor,
      date: payment.paymentDate,
      category: payment.paymentMethod,
      amount: payment.amount,
      paidAmount: payment.amount,
      remainingAmount: payment.remainingBalance ?? 0,
      status: payment.paymentStatus === "paid" ? "paid" as RecordStatus : "pending" as RecordStatus,
      paymentStatus: payment.paymentStatus,
      relatedDocumentIds: payment.sourceDocumentIds ?? payment.allocations?.map((allocation) => allocation.documentId) ?? [],
      sourceDocumentId: payment.sourceDocumentId,
      attachmentCount: 0,
      raw: payment,
    }));

    const withholdingTax = data.withholdingTaxDocuments.map((document: WithholdingTaxDocument) => ({
      id: document.id,
      kind: "withholding_tax" as const,
      documentType: "Withholding Tax Certificate",
      supplier: document.vendor,
      date: document.date,
      category: document.incomeType,
      amount: document.amount,
      paidAmount: document.amount,
      remainingAmount: 0,
      status: document.status,
      paymentStatus: "not_applicable" as const,
      relatedDocumentIds: [document.sourceDocumentId, document.relatedExpenseId, document.relatedPaymentId].filter(Boolean) as string[],
      sourceDocumentId: document.sourceDocumentId,
      attachmentCount: 0,
      raw: document,
    }));

    return [...purchaseOrders, ...receives, ...expenses, ...payments, ...withholdingTax].sort((left, right) =>
      right.date.localeCompare(left.date)
    );
  }, [data]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const realTypes = getRealDocumentTypes(typeFilters);
    return rows.filter((row) => {
      const matchesQuery =
        !query ||
        row.id.toLowerCase().includes(query) ||
        row.supplier.toLowerCase().includes(query) ||
        row.documentType.toLowerCase().includes(query) ||
        row.category.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || row.status === statusFilter;
      const matchesPayment = paymentFilter === "all" || row.paymentStatus === paymentFilter;
      const matchesType = realTypes.length === 0 || realTypes.includes(row.kind);
      const evidenceType =
        evidenceFilter === "missing_payment"
          ? "paymentEvidence"
          : evidenceFilter === "missing_invoice_receipt"
            ? "invoiceReceipt"
            : evidenceFilter === "missing_delivery_evidence"
              ? "deliveryEvidence"
              : null;
      const matchesEvidence =
        !evidenceType ||
        remainingTasks.some(
          (task) =>
            task.status === "pending" &&
            task.relatedDocumentNumber === row.id &&
            task.missingEvidenceType === evidenceType
        );
      return matchesQuery && matchesStatus && matchesPayment && matchesType && matchesEvidence;
    });
  }, [evidenceFilter, paymentFilter, remainingTasks, rows, search, statusFilter, typeFilters]);

  const allVisibleSelected = filteredRows.length > 0 && filteredRows.every((row) => selectedIds.includes(row.id));

  const openDocument = (row: ExpenseDocumentRow) => {
    nav(`/expense/documents?document=${encodeURIComponent(row.id)}&type=${encodeURIComponent(row.kind)}`);
  };

  const editDocument = (row: ExpenseDocumentRow) => {
    nav(`/expense/create?documentTypes=${encodeURIComponent(row.kind)}&sourceDocumentId=${encodeURIComponent(row.id)}`);
  };

  const startQuickAction = (action: QuickAction, row: ExpenseDocumentRow) => {
    setActiveRow(row);
    setQuickAction(action);
  };

  const startDrawerAction = (action: DrawerAction, row: ExpenseDocumentRow) => {
    setActiveRow(row);
    setDrawerAction(action);
  };

  const handleDeleteExpense = async (row: ExpenseDocumentRow) => {
    if (row.kind !== "expense") {
      toast.info("Soft delete for this document type will use the document workflow when its backend update endpoint is available.");
      return;
    }
    if (row.paymentStatus === "paid" || row.paidAmount > 0) {
      toast.error("Reset payment status before deleting a paid expense.");
      return;
    }

    const expense = data.expenses.find((item) => item.id === row.id);
    if (!expense) return;
    await updateExpense(expense.id, {
      vendor: expense.vendor,
      category: expense.category,
      date: expense.date,
      amount: expense.amount,
      paymentMethod: String(expense.paymentMethod ?? "Bank transfer"),
      currency: expense.currency,
      exchangeRate: expense.exchangeRate,
      projectId: expense.projectId,
      projectName: expense.projectName,
      due: expense.due,
      reference: expense.reference,
      notes: expense.notes,
      accountantCategory: expense.accountantCategory,
      linkedDocumentIds: expense.linkedDocumentIds,
      status: "inactive",
    });
    await refresh();
    toast.success(`Expense ${row.id} soft deleted`);
  };

  const confirmQuickAction = async () => {
    if (!activeRow || !quickAction) return;
    if (quickAction === "download_pdf") {
      if (activeRow.kind === "expense") {
        await downloadExpenseReceipt(activeRow.id);
      } else if (activeRow.kind === "withholding_tax") {
        await downloadWithholdingTaxText(activeRow.id);
      } else if (activeRow.kind === "purchase_order" || activeRow.kind === "receive") {
        await downloadDocumentPdf(activeRow.kind as DocumentKind, activeRow.id);
      } else {
        toast.info("Supplier payment PDF export is not available yet.");
      }
    } else if (quickAction === "print") {
      window.print();
    } else if (quickAction === "delete") {
      await handleDeleteExpense(activeRow);
    } else if (quickAction === "reset") {
      toast.info(`Reset workflow queued for ${activeRow.id}.`);
    } else if (quickAction === "cancel") {
      toast.info(`Cancel workflow queued for ${activeRow.id}.`);
    } else {
      toast.success(`${quickAction.replaceAll("_", " ")} prepared for ${activeRow.id}.`);
    }
    setQuickAction(null);
  };

  const drawerTitle = drawerAction
    ? {
        convert_to_receive: "Convert Purchase Order to Goods Receipt",
        convert_to_expense: "Convert Purchase Order to Expense",
        create_wht: "Create Withholding Tax Certificate",
        edit_payment: "Edit Payment Details",
      }[drawerAction]
    : "";

  const quickTitle = quickAction
    ? {
        print: "Print document",
        download_pdf: "Download PDF",
        send_email: "Send email",
        cancel: "Cancel document",
        reset: "Reset document",
        delete: "Delete document",
      }[quickAction]
    : "";

  return (
    <AppShell>
      <PageHeader
        title="Expense / Documents"
        description="All expense, purchase, receiving, supplier payment, and withholding tax documents in one workspace."
        breadcrumbs={[{ label: "Expense" }, { label: "Documents" }]}
      />

      <Card className="card-premium mb-4 p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-sm font-semibold">Document type filters</h2>
            <p className="mt-1 text-xs text-muted-foreground">Filter the shared Expense document table without switching pages.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setTypeFilters(["none"])}>
            Clear
          </Button>
        </div>
        <DocumentTypeSelector
          options={PURCHASE_DOCUMENT_TYPE_OPTIONS}
          selectedValues={typeFilters}
          onSelectedValuesChange={setTypeFilters}
          otherMenuLabel="Other expense filters"
        />
      </Card>

      <ListToolbar
        searchPlaceholder="Search document number, supplier, category..."
        searchValue={search}
        onSearchChange={setSearch}
        primaryAction={{ label: "Create", onClick: () => nav("/expense/create") }}
        extra={
          <div className="flex flex-wrap gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((status) => (
                  <SelectItem key={status} value={status}>{status === "all" ? "All statuses" : status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_FILTERS.map((status) => (
                  <SelectItem key={status} value={status}>{status === "all" ? "All payments" : status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={evidenceFilter} onValueChange={setEvidenceFilter}>
              <SelectTrigger className="w-[230px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVIDENCE_FILTERS.map((filter) => (
                  <SelectItem key={filter.value} value={filter.value}>{filter.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10">
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={(checked) => setSelectedIds(checked ? filteredRows.map((row) => row.id) : [])}
                />
              </TableHead>
              <TableHead>Document number</TableHead>
              <TableHead>Document type</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Related</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map((row) => (
              <TableRow key={`${row.kind}-${row.id}`} className="cursor-pointer" onClick={() => openDocument(row)}>
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.includes(row.id)}
                    onCheckedChange={(checked) =>
                      setSelectedIds((current) => checked ? [...current, row.id] : current.filter((id) => id !== row.id))
                    }
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-primary">{row.id}</span>
                    {row.attachmentCount ? <Paperclip className="h-3.5 w-3.5 text-muted-foreground" /> : null}
                  </div>
                </TableCell>
                <TableCell>{row.documentType}</TableCell>
                <TableCell className="font-medium">{row.supplier}</TableCell>
                <TableCell>{row.date}</TableCell>
                <TableCell>{row.category}</TableCell>
                <TableCell className="text-right">{money(row.amount)}</TableCell>
                <TableCell className="text-right">{money(row.paidAmount)}</TableCell>
                <TableCell className="text-right">{money(row.remainingAmount)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("capitalize", statusTone(row.status))}>{row.status}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="capitalize">{row.paymentStatus.replace("_", " ")}</Badge>
                </TableCell>
                <TableCell>
                  {row.relatedDocumentIds.length ? (
                    <span className="text-xs text-muted-foreground">{row.relatedDocumentIds.slice(0, 2).join(", ")}{row.relatedDocumentIds.length > 2 ? ` +${row.relatedDocumentIds.length - 2}` : ""}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <RowActions
                    row={row}
                    onOpen={openDocument}
                    onEdit={editDocument}
                    onPayment={(selectedRow) => {
                      setActiveRow(selectedRow);
                      setPaymentOpen(true);
                    }}
                    onWithholding={(selectedRow) => {
                      setActiveRow(selectedRow);
                      setWhtOpen(true);
                    }}
                    onEvidence={(selectedRow) => {
                      setActiveRow(selectedRow);
                      setEvidenceOpen(true);
                    }}
                    onQuickAction={startQuickAction}
                    onDrawerAction={startDrawerAction}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filteredRows.length === 0 ? (
          <div className="p-10 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
            <h3 className="mt-3 font-display text-base font-semibold">No expense documents found</h3>
            <p className="mt-1 text-sm text-muted-foreground">Try another filter or create a new document.</p>
            <Button className="mt-4" onClick={() => nav("/expense/create")}>Create</Button>
          </div>
        ) : null}
      </Card>

      <PaymentActionModal
        kind="vendor_payment"
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        payables={payables}
        initialSelection={activeRow ? [activeRow.id] : []}
        onSaved={() => void refresh()}
      />
      <ExpenseDocumentModal
        kind="withholding_tax"
        open={whtOpen}
        onOpenChange={setWhtOpen}
        payables={activeRow ? payables.filter((row) => row.id === activeRow.id) : payables}
      />
      <EvidenceAttachmentModal
        open={evidenceOpen}
        onOpenChange={setEvidenceOpen}
        entityType={activeRow?.kind ?? "expense"}
        entityId={activeRow?.id}
        onSaved={() => void refresh()}
      />
      <ConfigurableActionModal
        open={Boolean(quickAction)}
        onOpenChange={(open) => !open && setQuickAction(null)}
        title={quickTitle}
        description={activeRow ? `${quickTitle} for ${activeRow.documentType} ${activeRow.id}.` : undefined}
        confirmLabel={quickAction === "delete" ? "Delete" : "Continue"}
        onConfirm={confirmQuickAction}
      />
      <ConfigurableActionDrawer
        open={Boolean(drawerAction)}
        onOpenChange={(open) => !open && setDrawerAction(null)}
        title={drawerTitle}
        description={activeRow ? `Source document: ${activeRow.id}. The created document will keep this source link.` : undefined}
        confirmLabel="Continue"
        onConfirm={() => {
          if (!activeRow || !drawerAction) return;
          if (drawerAction === "convert_to_receive") {
            nav(`/expense/create?documentTypes=receive&sourceDocumentId=${encodeURIComponent(activeRow.id)}`);
          } else if (drawerAction === "convert_to_expense") {
            nav(`/expense/create?documentTypes=expense&sourceDocumentId=${encodeURIComponent(activeRow.id)}`);
          } else if (drawerAction === "create_wht") {
            setDrawerAction(null);
            setWhtOpen(true);
          } else if (drawerAction === "edit_payment") {
            setDrawerAction(null);
            setPaymentOpen(true);
          }
        }}
      >
        <div className="space-y-3 rounded-lg border p-4 text-sm">
          <div className="flex justify-between gap-3"><span className="text-muted-foreground">Document</span><span className="font-mono font-semibold">{activeRow?.id}</span></div>
          <div className="flex justify-between gap-3"><span className="text-muted-foreground">Supplier</span><span>{activeRow?.supplier}</span></div>
          <div className="flex justify-between gap-3"><span className="text-muted-foreground">Amount</span><span>{money(activeRow?.amount ?? 0)}</span></div>
        </div>
      </ConfigurableActionDrawer>
    </AppShell>
  );
};

const RowActions = ({
  row,
  onOpen,
  onEdit,
  onPayment,
  onWithholding,
  onEvidence,
  onQuickAction,
  onDrawerAction,
}: {
  row: ExpenseDocumentRow;
  onOpen: (row: ExpenseDocumentRow) => void;
  onEdit: (row: ExpenseDocumentRow) => void;
  onPayment: (row: ExpenseDocumentRow) => void;
  onWithholding: (row: ExpenseDocumentRow) => void;
  onEvidence: (row: ExpenseDocumentRow) => void;
  onQuickAction: (action: QuickAction, row: ExpenseDocumentRow) => void;
  onDrawerAction: (action: DrawerAction, row: ExpenseDocumentRow) => void;
}) => {
  const isPurchaseOrder = row.kind === "purchase_order";
  const canPay = row.kind === "expense" || row.kind === "receive";
  const canDelete = !["paid", "completed", "void", "cancelled"].includes(row.status) && row.paidAmount <= 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem onClick={() => onOpen(row)}>Open</DropdownMenuItem>
        {!["paid", "completed", "void", "cancelled"].includes(row.status) ? (
          <DropdownMenuItem onClick={() => onEdit(row)}>Edit</DropdownMenuItem>
        ) : null}
        {isPurchaseOrder ? (
          <>
            <DropdownMenuItem onClick={() => onDrawerAction("convert_to_receive", row)}>Convert Purchase Order to Goods Receipt</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDrawerAction("convert_to_expense", row)}>Convert Purchase Order to Expense</DropdownMenuItem>
          </>
        ) : null}
        {canPay ? <DropdownMenuItem onClick={() => onPayment(row)}>Record Supplier Payment</DropdownMenuItem> : null}
        {canPay ? <DropdownMenuItem onClick={() => onWithholding(row)}>Add Withholding Tax</DropdownMenuItem> : null}
        {row.kind === "withholding_tax" ? <DropdownMenuItem onClick={() => onOpen(row)}>View Withholding Tax Certificate</DropdownMenuItem> : null}
        <DropdownMenuItem onClick={() => onEvidence(row)}>Attach Evidence</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onQuickAction("print", row)}><Printer className="mr-2 h-4 w-4" /> Print</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onQuickAction("download_pdf", row)}><Download className="mr-2 h-4 w-4" /> Download PDF</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onQuickAction("send_email", row)}><Mail className="mr-2 h-4 w-4" /> Send Email</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEdit(row)}>Duplicate</DropdownMenuItem>
        <DropdownMenuSeparator />
        {!["void", "cancelled"].includes(row.status) ? <DropdownMenuItem onClick={() => onQuickAction("cancel", row)}>Cancel</DropdownMenuItem> : null}
        {row.paidAmount > 0 || row.paymentStatus === "paid" ? (
          <DropdownMenuItem onClick={() => onQuickAction("reset", row)}><RefreshCcw className="mr-2 h-4 w-4" /> Reset</DropdownMenuItem>
        ) : null}
        {canDelete ? (
          <DropdownMenuItem className="text-destructive" onClick={() => onQuickAction("delete", row)}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default PurchaseDocuments;

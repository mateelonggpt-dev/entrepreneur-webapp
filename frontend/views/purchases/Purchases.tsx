import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DocumentTypeSelector } from "@/components/documents/DocumentTypeSelector";
import { AppShell } from "@/components/layout/AppShell";
import { ExpenseModal } from "@/components/modals/ExpenseModal";
import { NewReceiveModal } from "@/components/modals/NewReceiveModal";
import { PurchaseOrderModal } from "@/components/modals/PurchaseOrderModal";
import { SalesDocumentTable } from "@/components/sales/SalesDocumentTable";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { ListToolbar } from "@/components/ui-kit/ListToolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppData } from "@/lib/app-data";
import {
  PURCHASE_DOCUMENT_KIND_LABELS,
  PURCHASE_DOCUMENT_TYPE_OPTIONS,
  expenseToPurchaseSummary,
  purchaseDocumentRoute,
} from "@/lib/document-sections";
import type { DocumentSummary } from "@/lib/types";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ClipboardCheck,
  FileText,
  MoreHorizontal,
  PackageCheck,
  Wallet,
} from "lucide-react";

const STATUS_FILTERS = ["all", "draft", "pending", "approved", "partial", "paid", "void"];

const Purchases = () => {
  const nav = useNavigate();
  const { data } = useAppData();
  const [activeTab, setActiveTab] = useState("create");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["none"]);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [purchaseOrderOpen, setPurchaseOrderOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);

  const documents = useMemo<DocumentSummary[]>(
    () =>
      [
        ...data.purchaseOrders,
        ...data.receives,
        ...data.expenses.map(expenseToPurchaseSummary),
        ...data.withholdingTaxDocuments.map((document) => ({
          id: document.id,
          party: document.vendor,
          date: document.date,
          amount: document.amount,
          status: document.status,
          kind: "withholding_tax" as const,
          documentVariant: "Withholding Tax",
          sourceDocumentId: document.sourceDocumentId,
        })),
      ]
        .map((summary) => ({
          ...summary,
          documentVariant: summary.documentVariant ?? PURCHASE_DOCUMENT_KIND_LABELS[summary.kind],
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
      id: "purchase_order",
      label: "Create Purchase Order",
      thaiLabel: "สร้างใบสั่งซื้อ",
      icon: ClipboardCheck,
      action: () => setPurchaseOrderOpen(true),
    },
    {
      id: "expense",
      label: "Record Expense",
      thaiLabel: "บันทึกรายจ่าย",
      icon: Wallet,
      action: () => setExpenseOpen(true),
    },
    {
      id: "receive",
      label: "Create GRN",
      thaiLabel: "สร้างใบรับสินค้า",
      icon: PackageCheck,
      action: () => setReceiveOpen(true),
    },
    {
      id: "purchase_credit_note",
      label: "Review Credit Notes",
      thaiLabel: "ตรวจสอบใบลดหนี้",
      icon: ArrowDownCircle,
      action: () => setActiveTab("documents"),
    },
    {
      id: "purchase_debit_note",
      label: "Review Debit Notes",
      thaiLabel: "ตรวจสอบใบเพิ่มหนี้",
      icon: ArrowUpCircle,
      action: () => setActiveTab("documents"),
    },
    {
      id: "purchase_receipt",
      label: "Record Purchase Receipt",
      thaiLabel: "บันทึกใบเสร็จรับเงินจากการซื้อ",
      icon: FileText,
      action: () => nav("/payment/transactions?type=supplier_payment"),
    },
  ];

  const activeCreateActions = createActions.filter((action) => selectedTypes.includes(action.id));

  const openDocument = (summary: DocumentSummary) => {
    nav(purchaseDocumentRoute(summary));
  };

  return (
    <AppShell>
      <PageHeader
        title="Purchase"
        description="Create purchase documents or manage the purchase document library from one place."
        breadcrumbs={[{ label: "Purchase" }]}
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
                  Select one or more purchase document types before starting a workflow.
                </p>
              </div>
              <Badge variant="secondary" className="w-fit">
                {selectedTypes.includes("none") ? "No document selected" : `${selectedTypes.length} selected`}
              </Badge>
            </div>

            <DocumentTypeSelector
              options={PURCHASE_DOCUMENT_TYPE_OPTIONS}
              selectedValues={selectedTypes}
              onSelectedValuesChange={setSelectedTypes}
              otherMenuLabel="Other purchase documents"
            />

            <div className="mt-6 rounded-xl border border-border/70 bg-secondary/25 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Selected actions</h3>
                  <p className="text-xs text-muted-foreground">Open the matching existing purchase workflow.</p>
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
            searchPlaceholder="Search purchase document number, vendor, type..."
            searchValue={search}
            onSearchChange={setSearch}
            primaryAction={{ label: "Create", onClick: () => setActiveTab("create") }}
            extra={
              <>
                <Select value={kindFilter} onValueChange={setKindFilter}>
                  <SelectTrigger className="w-[210px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PURCHASE_DOCUMENT_KIND_LABELS).map(([value, label]) => (
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
            emptyTitle="No purchase documents found"
            emptyDescription="Try another search or filter, or create a new purchase document."
            emptyAction={{ label: "Create", onClick: () => setActiveTab("create") }}
            renderRowActions={(summary) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openDocument(summary)}>
                    Open / Manage
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          />
        </TabsContent>
      </Tabs>

      <PurchaseOrderModal open={purchaseOrderOpen} onOpenChange={setPurchaseOrderOpen} />
      <NewReceiveModal open={receiveOpen} onOpenChange={setReceiveOpen} />
      <ExpenseModal open={expenseOpen} onOpenChange={setExpenseOpen} />
    </AppShell>
  );
};

export default Purchases;

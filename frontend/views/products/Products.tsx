import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { InventoryActionModal, MasterDataModal } from "@/components/modals/DomainModals";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { ListToolbar } from "@/components/ui-kit/ListToolbar";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { KpiCard } from "@/components/ui-kit/KpiCard";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { fmtTHB } from "@/lib/demo-data";
import { useAppData } from "@/lib/app-data";
import { exportResource } from "@/lib/api";
import { upsertRemainingTasks, type RemainingTask } from "@/lib/remaining-tasks";
import type { InventoryItem, Product } from "@/lib/types";
import { Package, Boxes, AlertTriangle, MoreHorizontal, Upload } from "lucide-react";
import { toast } from "sonner";

type SourceDocumentCategory = "invoiceReceipt" | "paymentEvidence" | "deliveryEvidence";
type SourceDocuments = Record<SourceDocumentCategory, File[]>;

const sourceDocumentCategories: Array<{
  id: SourceDocumentCategory;
  labelKey: string;
}> = [
  { id: "invoiceReceipt", labelKey: "inventory.evidence.invoiceReceipt" },
  { id: "paymentEvidence", labelKey: "inventory.evidence.paymentEvidence" },
  { id: "deliveryEvidence", labelKey: "inventory.evidence.deliveryEvidence" },
];

const Products = () => {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { data } = useAppData();
  const { products, inventory } = data;
  const [open, setOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null);
  const [explainOpen, setExplainOpen] = useState(false);
  const [explainDecision, setExplainDecision] = useState<"can_sell" | "cannot_sell">("can_sell");
  const [sourceDocuments, setSourceDocuments] = useState<SourceDocuments>({
    invoiceReceipt: [],
    paymentEvidence: [],
    deliveryEvidence: [],
  });
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "service" | "stock-counted" | "non-stock">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const filteredProducts = useMemo(() => {
    const searchLower = search.trim().toLowerCase();
    return products.filter((product) => {
      const productType = product.productType ?? "service";
      const matchesSearch =
        !searchLower ||
        product.sku.toLowerCase().includes(searchLower) ||
        product.name.toLowerCase().includes(searchLower) ||
        product.type.toLowerCase().includes(searchLower);

      const matchesType = typeFilter === "all" || productType === typeFilter;
      const matchesStatus = statusFilter === "all" || product.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [products, search, statusFilter, typeFilter]);

  const totalSkus = products.length;
  const inventoryBySku = useMemo(
    () => new Map(inventory.map((item) => [item.sku, item])),
    [inventory]
  );
  const stockValue = products.reduce((sum, product) => {
    if ((product.productType ?? "service") !== "stock-counted") {
      return sum;
    }
    return sum + (product.stock ?? 0) * product.price;
  }, 0);
  const lowStockCount = products.filter(
    (product) => (product.productType ?? "service") === "stock-counted" && (product.stock ?? 0) < 20
  ).length;

  const handleExport = async () => {
    try {
      await exportResource("products");
      toast.success(t("inventory.toast.productsExported"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("inventory.toast.unableToExportProducts"));
    }
  };

  const openExplainModal = (decision: "can_sell" | "cannot_sell") => {
    setExplainDecision(decision);
    setSourceDocuments({ invoiceReceipt: [], paymentEvidence: [], deliveryEvidence: [] });
    setExplainOpen(true);
  };

  const updateSourceDocuments = (category: SourceDocumentCategory, files: FileList | null) => {
    setSourceDocuments((current) => ({ ...current, [category]: Array.from(files ?? []) }));
  };

  const saveExplainRecord = () => {
    if (!selectedProduct) return;
    const missing = sourceDocumentCategories.filter((category) => sourceDocuments[category.id].length === 0);
    if (missing.length) {
      const tasks: RemainingTask[] = missing.map((category) => ({
        id: `${selectedProduct.sku}-${explainDecision}-${category.id}`,
        title: t("inventory.tasks.attachEvidence", { evidence: t(category.labelKey), sku: selectedProduct.sku }),
        relatedDocumentNumber: selectedProduct.sku,
        documentType: explainDecision === "can_sell" ? t("inventory.saleStatus.canSellExplanation") : t("inventory.saleStatus.cannotSellExplanation"),
        missingEvidenceType: category.id,
        createdDate: new Date().toISOString().slice(0, 10),
        status: "pending",
        documentPath: "/products",
      }));
      upsertRemainingTasks(tasks);
      toast.warning(t("inventory.toast.remainingTasksCreated", { count: tasks.length }));
    } else {
      toast.success(t("inventory.toast.explanationSaved"));
    }
    setExplainOpen(false);
  };

  const handleCopySku = async (sku: string) => {
    try {
      await navigator.clipboard.writeText(sku);
      toast.success(t("inventory.toast.skuCopied", { sku }));
    } catch {
      toast.error(t("inventory.toast.unableToCopySku"));
    }
  };

  const getProductTypeLabel = (product: Product) => {
    const productType = product.productType ?? "service";
    if (productType === "stock-counted") return t("inventory.productTypes.stockCounted");
    if (productType === "non-stock") return t("inventory.productTypes.nonStock");
    return t("inventory.productTypes.service");
  };

  return (
    <AppShell>
      <PageHeader
        title={t("inventory.title")}
        description={t("inventory.description")}
        breadcrumbs={[{ label: t("nav.contacts") }, { label: t("nav.products") }]}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label={t("inventory.kpi.totalSkus")} value={String(totalSkus)} icon={<Package className="h-4 w-4" />} accent="primary" />
        <KpiCard label={t("inventory.kpi.stockValue")} value={fmtTHB(stockValue)} icon={<Boxes className="h-4 w-4" />} accent="success" />
        <KpiCard label={t("inventory.kpi.lowStock")} value={String(lowStockCount)} icon={<AlertTriangle className="h-4 w-4" />} hint={t("inventory.kpi.reorderSoon")} accent="warning" />
      </div>

      <ListToolbar
        searchPlaceholder={t("inventory.filters.search")}
        searchValue={search}
        onSearchChange={setSearch}
        primaryAction={{
          label: t("inventory.newProduct"),
          onClick: () => {
            setEditingProduct(null);
            setOpen(true);
          },
        }}
        onExportClick={() => void handleExport()}
        extra={
          <>
            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as typeof typeFilter)}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("inventory.filters.allProductTypes")}</SelectItem>
                <SelectItem value="service">{t("inventory.productTypes.service")}</SelectItem>
                <SelectItem value="stock-counted">{t("inventory.productTypes.stockCounted")}</SelectItem>
                <SelectItem value="non-stock">{t("inventory.productTypes.nonStock")}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("contacts.filters.allStatuses")}</SelectItem>
                <SelectItem value="active">{t("status.active")}</SelectItem>
                <SelectItem value="inactive">{t("status.inactive")}</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      <Card className="card-premium overflow-hidden">
        {filteredProducts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50">
                <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 text-left font-semibold">{t("inventory.fields.sku")}</th>
                  <th className="px-3 py-3 text-left font-semibold">{t("inventory.fields.name")}</th>
                  <th className="px-3 py-3 text-left font-semibold">{t("inventory.fields.type")}</th>
                  <th className="px-3 py-3 text-right font-semibold">{t("inventory.fields.price")}</th>
                  <th className="px-3 py-3 text-right font-semibold">{t("inventory.fields.stock")}</th>
                  <th className="px-3 py-3 text-left font-semibold">{t("inventory.fields.stockSummary")}</th>
                  <th className="px-3 py-3 text-left font-semibold">{t("inventory.fields.status")}</th>
                  <th className="w-10 px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr
                    key={product.sku}
                    className="cursor-pointer border-t border-border/50 hover:bg-secondary/40"
                    onClick={() => setSelectedProduct(product)}
                  >
                    <td className="px-4 py-3.5 font-mono text-xs font-semibold text-primary">{product.sku}</td>
                    <td className="px-3 py-3.5 font-medium">{product.name}</td>
                    <td className="px-3 py-3.5">
                      <span className="rounded-md bg-secondary px-2 py-0.5 text-xs">{getProductTypeLabel(product)}</span>
                    </td>
                    <td className="px-3 py-3.5 text-right font-semibold tabular-nums">{fmtTHB(product.price)}</td>
                    <td className="px-3 py-3.5 text-right tabular-nums">
                      {product.stock === null ? <span className="text-muted-foreground">-</span> : product.stock}
                    </td>
                    <td className="px-3 py-3.5 text-muted-foreground">{product.stockSummary ?? "-"}</td>
                    <td className="px-3 py-3.5">
                      <StatusBadge status={product.status} />
                    </td>
                    <td className="px-3 py-3.5" onClick={(event) => event.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => void handleCopySku(product.sku)}>{t("inventory.actions.copySku")}</DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingProduct(product);
                              setOpen(true);
                            }}
                          >
                            {t("inventory.editProduct")}
                          </DropdownMenuItem>
                          {(product.productType ?? "service") === "stock-counted" ? (
                            <DropdownMenuItem
                              onClick={() => {
                                const inventoryItem = inventoryBySku.get(product.sku) ?? null;
                                setSelectedInventoryItem(inventoryItem);
                                setAdjustmentOpen(true);
                              }}
                            >
                              {t("inventory.adjustStock")}
                            </DropdownMenuItem>
                          ) : null}
                          {(product.productType ?? "service") === "stock-counted" ? (
                            <DropdownMenuItem onClick={() => nav("/inventory")}>
                              {t("inventory.actions.openInventory")}
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem onClick={() => nav("/sales/invoices/new")}>{t("contacts.actions.createInvoice")}</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void handleExport()}>{t("inventory.actions.exportProducts")}</DropdownMenuItem>
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
            title={t("inventory.empty.noProductsTitle")}
            description={t("inventory.empty.noProductsDescription")}
            action={{
              label: t("inventory.newProduct"),
              onClick: () => {
                setEditingProduct(null);
                setOpen(true);
              },
            }}
          />
        )}
      </Card>

      <MasterDataModal kind="product" open={open} onOpenChange={setOpen} product={editingProduct} />

      <Sheet open={Boolean(selectedProduct)} onOpenChange={(nextOpen) => !nextOpen && setSelectedProduct(null)}>
        <SheetContent className="sm:max-w-lg">
          {selectedProduct ? (
            <>
              <SheetHeader>
                <SheetTitle>{selectedProduct.name}</SheetTitle>
                <SheetDescription>{selectedProduct.sku}</SheetDescription>
              </SheetHeader>

                <div className="mt-6 space-y-4">
                  <div className="rounded-xl border border-border/60 p-4">
                  <p className="text-xs text-muted-foreground">{t("inventory.fields.type")}</p>
                  <p className="mt-1 font-semibold">{getProductTypeLabel(selectedProduct)}</p>
                </div>

                <div className="rounded-xl border border-border/60 p-4">
                  <p className="text-xs text-muted-foreground">{t("inventory.fields.price")}</p>
                  <p className="mt-1 font-semibold">{fmtTHB(selectedProduct.price)}</p>
                </div>

                <div className="rounded-xl border border-border/60 p-4">
                  <p className="text-xs text-muted-foreground">{t("inventory.fields.stockSummary")}</p>
                  <p className="mt-1 font-semibold">{selectedProduct.stockSummary ?? "-"}</p>
                  {selectedProduct.productType === "stock-counted" ? (
                    <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                      <p>{t("inventory.stock.currentStock")}: {selectedProduct.stock ?? 0}</p>
                      <p>{t("inventory.fields.openingStock")}: {selectedProduct.openingStockQty ?? 0}</p>
                      <p>{t("inventory.fields.openingCost")}: {fmtTHB(selectedProduct.openingCost ?? 0)}</p>
                      <p>{t("inventory.fields.averageCost")}: {fmtTHB(selectedProduct.averageCost ?? selectedProduct.openingCost ?? 0)}</p>
                      <p>{t("inventory.fields.openingDate")}: {selectedProduct.openingDate || "-"}</p>
                      <p>{t("inventory.fields.lastMovement")}: {selectedProduct.lastMovementDate || "-"}</p>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-xl border border-border/60 p-4">
                  <p className="text-xs text-muted-foreground">{t("inventory.fields.status")}</p>
                  <div className="mt-2">
                    <StatusBadge status={selectedProduct.status} />
                  </div>
                </div>

                <div className="flex gap-2">
                  {(selectedProduct.productType ?? "service") === "stock-counted" ? (
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setSelectedInventoryItem(inventoryBySku.get(selectedProduct.sku) ?? null);
                        setAdjustmentOpen(true);
                      }}
                    >
                      {t("inventory.adjustStock")}
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setEditingProduct(selectedProduct);
                      setOpen(true);
                    }}
                  >
                    {t("inventory.editProduct")}
                  </Button>
                  <Button className="flex-1 border-0 bg-gradient-brand text-primary-foreground shadow-brand" onClick={() => nav("/sales/invoices/new")}>
                    {t("contacts.actions.createInvoice")}
                  </Button>
                </div>
                <div className="rounded-xl border border-border/60 p-4">
                  <p className="text-xs text-muted-foreground">{t("inventory.saleStatus.title")}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" onClick={() => openExplainModal("can_sell")}>
                      {t("inventory.saleStatus.canSell")}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => openExplainModal("cannot_sell")}>
                      {t("inventory.saleStatus.cannotSell")}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={explainOpen} onOpenChange={setExplainOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {t("inventory.saleStatus.sourceDocumentsTitle", {
                status: explainDecision === "can_sell" ? t("inventory.saleStatus.canSell") : t("inventory.saleStatus.cannotSell"),
              })}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("inventory.saleStatus.sourceDocumentsDescription")}
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            {sourceDocumentCategories.map((category) => (
              <SourceDocumentUploadBox
                key={category.id}
                category={category}
                files={sourceDocuments[category.id]}
                onFilesChange={updateSourceDocuments}
              />
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setExplainOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" onClick={saveExplainRecord}>
              {t("inventory.actions.saveExplanation")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InventoryActionModal
        kind="stock_adjustment"
        open={adjustmentOpen}
        onOpenChange={setAdjustmentOpen}
        item={selectedInventoryItem}
        onSaved={(item) => {
          if (item) {
            setSelectedInventoryItem(item);
          }
        }}
      />
    </AppShell>
  );
};

const SourceDocumentUploadBox = ({
  category,
  files,
  onFilesChange,
}: {
  category: (typeof sourceDocumentCategories)[number];
  files: File[];
  onFilesChange: (category: SourceDocumentCategory, files: FileList | null) => void;
}) => {
  const { t } = useTranslation();
  const imageFiles = files.filter((file) => file.type.startsWith("image/"));

  return (
    <div className="rounded-xl border border-border/70 bg-background p-3">
      <Label className="text-xs font-semibold">
        {t(category.labelKey)}
      </Label>
      <label className="mt-3 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-secondary/30 px-3 py-4 text-center text-xs text-muted-foreground hover:bg-secondary/50">
        <Upload className="mb-2 h-5 w-5" />
        <span>{t("inventory.evidence.uploadFiles")}</span>
        <Input
          type="file"
          multiple
          className="sr-only"
          onChange={(event) => onFilesChange(category.id, event.target.files)}
        />
      </label>
      {files.length ? (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-muted-foreground">{t("inventory.evidence.filesSelected", { count: files.length })}</p>
          {imageFiles.length ? (
            <div className="grid grid-cols-3 gap-2">
              {imageFiles.slice(0, 6).map((file) => (
                <img
                  key={`${file.name}-${file.lastModified}`}
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="h-16 w-full rounded-md border border-border object-cover"
                />
              ))}
            </div>
          ) : null}
          <div className="space-y-1">
            {files.map((file) => (
              <p key={`${file.name}-${file.lastModified}`} className="truncate text-[11px] text-muted-foreground">
                {file.name}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Products;

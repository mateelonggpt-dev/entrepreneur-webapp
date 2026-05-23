import { useMemo, useState } from "react";
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
  en: string;
  th: string;
}> = [
  { id: "invoiceReceipt", en: "Invoice / Receipt", th: "ใบแจ้งหนี้ / ใบเสร็จรับเงิน" },
  { id: "paymentEvidence", en: "Payment Evidence", th: "หลักฐานการชำระเงิน" },
  { id: "deliveryEvidence", en: "Delivery Note / Proof of Delivery", th: "ใบส่งของ / หลักฐานการจัดส่ง" },
];

const Products = () => {
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
      toast.success("Products exported");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to export products.");
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
        title: `Please attach ${category.en} for ${selectedProduct.sku}`,
        relatedDocumentNumber: selectedProduct.sku,
        documentType: explainDecision === "can_sell" ? "Can Sell explanation" : "Cannot Sell explanation",
        missingEvidenceType: category.id,
        createdDate: new Date().toISOString().slice(0, 10),
        status: "pending",
        documentPath: "/products",
      }));
      upsertRemainingTasks(tasks);
      toast.warning(`${tasks.length} remaining task${tasks.length > 1 ? "s" : ""} created for missing source documents.`);
    } else {
      toast.success("Explanation record saved with complete source documents.");
    }
    setExplainOpen(false);
  };

  const handleCopySku = async (sku: string) => {
    try {
      await navigator.clipboard.writeText(sku);
      toast.success(`${sku} copied`);
    } catch {
      toast.error("Unable to copy SKU.");
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Products & Inventory"
        description="Manage products, services, stock setup, and search-ready catalog actions."
        breadcrumbs={[{ label: "Contacts & Products" }, { label: "Products" }]}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Total SKUs" value={String(totalSkus)} icon={<Package className="h-4 w-4" />} accent="primary" />
        <KpiCard label="Stock value" value={fmtTHB(stockValue)} icon={<Boxes className="h-4 w-4" />} accent="success" />
        <KpiCard label="Low stock" value={String(lowStockCount)} icon={<AlertTriangle className="h-4 w-4" />} hint="reorder soon" accent="warning" />
      </div>

      <ListToolbar
        searchPlaceholder="Search SKU, product name, type..."
        searchValue={search}
        onSearchChange={setSearch}
        primaryAction={{
          label: "New Product",
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
                <SelectItem value="all">All product types</SelectItem>
                <SelectItem value="service">Service</SelectItem>
                <SelectItem value="stock-counted">Stock Counted</SelectItem>
                <SelectItem value="non-stock">Non-stock</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
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
                  <th className="px-4 py-3 text-left font-semibold">SKU</th>
                  <th className="px-3 py-3 text-left font-semibold">Name</th>
                  <th className="px-3 py-3 text-left font-semibold">Type</th>
                  <th className="px-3 py-3 text-right font-semibold">Price</th>
                  <th className="px-3 py-3 text-right font-semibold">Stock</th>
                  <th className="px-3 py-3 text-left font-semibold">Stock Summary</th>
                  <th className="px-3 py-3 text-left font-semibold">Status</th>
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
                      <span className="rounded-md bg-secondary px-2 py-0.5 text-xs">{product.type}</span>
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
                          <DropdownMenuItem onClick={() => void handleCopySku(product.sku)}>Copy SKU</DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingProduct(product);
                              setOpen(true);
                            }}
                          >
                            Edit product
                          </DropdownMenuItem>
                          {(product.productType ?? "service") === "stock-counted" ? (
                            <DropdownMenuItem
                              onClick={() => {
                                const inventoryItem = inventoryBySku.get(product.sku) ?? null;
                                setSelectedInventoryItem(inventoryItem);
                                setAdjustmentOpen(true);
                              }}
                            >
                              Adjust stock
                            </DropdownMenuItem>
                          ) : null}
                          {(product.productType ?? "service") === "stock-counted" ? (
                            <DropdownMenuItem onClick={() => nav("/inventory")}>
                              Open inventory
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem onClick={() => nav("/sales/invoices/new")}>Create invoice</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void handleExport()}>Export products</DropdownMenuItem>
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
            title="No products match this view"
            description="Adjust the filters or create a product to start issuing documents from the catalog."
            action={{
              label: "New Product",
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
                  <p className="text-xs text-muted-foreground">Type</p>
                  <p className="mt-1 font-semibold">{selectedProduct.type}</p>
                </div>

                <div className="rounded-xl border border-border/60 p-4">
                  <p className="text-xs text-muted-foreground">Sale price</p>
                  <p className="mt-1 font-semibold">{fmtTHB(selectedProduct.price)}</p>
                </div>

                <div className="rounded-xl border border-border/60 p-4">
                  <p className="text-xs text-muted-foreground">Stock summary</p>
                  <p className="mt-1 font-semibold">{selectedProduct.stockSummary ?? "-"}</p>
                  {selectedProduct.productType === "stock-counted" ? (
                    <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                      <p>Current stock: {selectedProduct.stock ?? 0}</p>
                      <p>Opening qty: {selectedProduct.openingStockQty ?? 0}</p>
                      <p>Opening cost: {fmtTHB(selectedProduct.openingCost ?? 0)}</p>
                      <p>Average cost: {fmtTHB(selectedProduct.averageCost ?? selectedProduct.openingCost ?? 0)}</p>
                      <p>Opening date: {selectedProduct.openingDate || "-"}</p>
                      <p>Last movement: {selectedProduct.lastMovementDate || "-"}</p>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-xl border border-border/60 p-4">
                  <p className="text-xs text-muted-foreground">Status</p>
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
                      Adjust Stock
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
                    Edit Product
                  </Button>
                  <Button className="flex-1 border-0 bg-gradient-brand text-primary-foreground shadow-brand" onClick={() => nav("/sales/invoices/new")}>
                    Create Invoice
                  </Button>
                </div>
                <div className="rounded-xl border border-border/60 p-4">
                  <p className="text-xs text-muted-foreground">Explain sale status</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" onClick={() => openExplainModal("can_sell")}>
                      Can Sell
                    </Button>
                    <Button type="button" variant="outline" onClick={() => openExplainModal("cannot_sell")}>
                      Cannot Sell
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
              {explainDecision === "can_sell" ? "Can Sell" : "Cannot Sell"} source documents
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Attach supporting documents/images. You can save with missing categories; Remaining Tasks will be created.
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
              Cancel
            </Button>
            <Button type="button" onClick={saveExplainRecord}>
              Save explanation record
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
  const imageFiles = files.filter((file) => file.type.startsWith("image/"));

  return (
    <div className="rounded-xl border border-border/70 bg-background p-3">
      <Label className="text-xs font-semibold">
        {category.en}
        <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">{category.th}</span>
      </Label>
      <label className="mt-3 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-secondary/30 px-3 py-4 text-center text-xs text-muted-foreground hover:bg-secondary/50">
        <Upload className="mb-2 h-5 w-5" />
        <span>Upload one or more files</span>
        <Input
          type="file"
          multiple
          className="sr-only"
          onChange={(event) => onFilesChange(category.id, event.target.files)}
        />
      </label>
      {files.length ? (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-muted-foreground">{files.length} file(s) selected</p>
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

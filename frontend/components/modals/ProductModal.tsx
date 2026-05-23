import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProcessingDialog } from "./ProcessingDialog";
import { createProduct, updateProduct } from "@/lib/api";
import { useAppData } from "@/lib/app-data";
import { readFormNumber, readFormString } from "@/lib/document-utils";
import { validateProductDraft } from "@/lib/products";
import type { Product } from "@/lib/types";
import { Loader2, Package } from "lucide-react";
import { toast } from "sonner";

type ProductType = "service" | "stock-counted" | "non-stock";

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  product?: Product | null;
  onSaved?: (product: Product) => void;
}

const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  service: "Service",
  "stock-counted": "Stock Counted",
  "non-stock": "Non-stock",
};

export const ProductModal = ({ open, onOpenChange, product, onSaved }: Props) => {
  const { refresh } = useAppData();
  const formRef = useRef<HTMLFormElement>(null);
  const [productType, setProductType] = useState<ProductType>("service");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(product);
  const requiresOpeningStock = productType === "stock-counted";
  const stockDisabled = productType !== "stock-counted";

  const title = useMemo(() => (isEditing ? "Edit Product" : "New Product"), [isEditing]);

  useEffect(() => {
    if (!open) {
      return;
    }

    formRef.current?.reset();
    setProductType((product?.productType as ProductType | undefined) ?? "service");
    setStatus(product?.status === "inactive" ? "inactive" : "active");
    setSubmitting(false);
    setError(null);
  }, [open, product]);

  const handleSubmit = async () => {
    const form = formRef.current;
    if (!form) {
      return;
    }

    const formData = new FormData(form);
    const name = readFormString(formData, "name");
    const price = readFormNumber(formData, "price");
    const openingStockQty = stockDisabled ? 0 : readFormNumber(formData, "openingStockQty");
    const openingCost = stockDisabled ? 0 : readFormNumber(formData, "openingCost");
    const openingDate = stockDisabled ? "" : readFormString(formData, "openingDate");
    const draftValidation = validateProductDraft({
      productType,
      name,
      price,
      stock: stockDisabled ? null : readFormNumber(formData, "stock"),
      openingStockQty,
      openingCost,
      openingDate,
    });

    if (!draftValidation.valid) {
      const nextError =
        draftValidation.errors.opening ??
        draftValidation.errors.name ??
        draftValidation.errors.price ??
        "Please complete the product form.";
      setError(nextError);
      toast.error(nextError);
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const stock = stockDisabled
        ? null
        : readFormNumber(formData, "stock") || openingStockQty;
      const payload = {
        sku: product?.sku,
        name,
        type: PRODUCT_TYPE_LABELS[productType],
        productType,
        price,
        stock,
        openingStockQty,
        openingCost,
        openingDate,
        status,
      };

      const saved = product
        ? await updateProduct(product.sku, payload)
        : await createProduct(payload);

      await refresh();
      onSaved?.(saved);
      onOpenChange(false);
      toast.success(product ? `Product ${saved.sku} updated` : `Product ${saved.sku} created`, {
        description: `${saved.name} is now available in the catalog.`,
      });
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Unable to save product.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
          <div className="flex items-start gap-3 border-b border-border bg-card px-6 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-brand text-primary-foreground shadow-brand">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold leading-tight">{title}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Add or update a product, service, or stock-counted item in your catalog.
              </p>
            </div>
          </div>

          <form ref={formRef} className="space-y-4 bg-background px-6 py-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="product-sku">SKU</Label>
                <Input
                  id="product-sku"
                  name="sku"
                  defaultValue={product?.sku ?? ""}
                  className="mt-1.5 font-mono"
                  placeholder={isEditing ? "" : "Optional auto-generated"}
                  disabled={isEditing}
                />
              </div>

              <div>
                <Label>Product type</Label>
                <Select value={productType} onValueChange={(value) => setProductType(value as ProductType)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="stock-counted">Stock Counted</SelectItem>
                    <SelectItem value="non-stock">Non-stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2">
                <Label htmlFor="product-name">Name</Label>
                <Input id="product-name" name="name" defaultValue={product?.name ?? ""} className="mt-1.5" />
              </div>

              <div>
                <Label htmlFor="product-price">Sale price</Label>
                <Input
                  id="product-price"
                  name="price"
                  type="number"
                  defaultValue={product?.price ?? ""}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as "active" | "inactive")}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="product-stock">Current stock / on hand</Label>
                <Input
                  id="product-stock"
                  name="stock"
                  type="number"
                  defaultValue={product?.stock ?? ""}
                  className="mt-1.5"
                  disabled={stockDisabled}
                />
              </div>

              <div>
                <Label htmlFor="product-opening-stock">Opening stock qty</Label>
                <Input
                  id="product-opening-stock"
                  name="openingStockQty"
                  type="number"
                  defaultValue={product?.openingStockQty ?? ""}
                  className="mt-1.5"
                  disabled={stockDisabled}
                />
              </div>

              <div>
                <Label htmlFor="product-opening-cost">Opening cost / unit</Label>
                <Input
                  id="product-opening-cost"
                  name="openingCost"
                  type="number"
                  defaultValue={product?.openingCost ?? ""}
                  className="mt-1.5"
                  disabled={stockDisabled}
                />
              </div>

              <div>
                <Label htmlFor="product-opening-date">Opening stock date</Label>
                <Input
                  id="product-opening-date"
                  name="openingDate"
                  type="date"
                  defaultValue={product?.openingDate ?? ""}
                  className="mt-1.5"
                  disabled={stockDisabled}
                />
              </div>
            </div>

            {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
          </form>

          <div className="flex items-center justify-end gap-2 border-t border-border bg-card px-6 py-3.5">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              className="border-0 bg-gradient-brand text-primary-foreground shadow-brand"
              onClick={() => void handleSubmit()}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {isEditing ? "Save Product" : "Create Product"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ProcessingDialog
        open={submitting}
        title={isEditing ? "Saving product..." : "Creating product..."}
        message="Saving the product record to the backend."
      />
    </>
  );
};

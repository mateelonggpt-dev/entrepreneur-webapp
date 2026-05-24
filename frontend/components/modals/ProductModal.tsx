import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const { refresh } = useAppData();
  const formRef = useRef<HTMLFormElement>(null);
  const [productType, setProductType] = useState<ProductType>("service");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(product);
  const requiresOpeningStock = productType === "stock-counted";
  const stockDisabled = productType !== "stock-counted";

  const title = useMemo(() => (isEditing ? t("inventory.editProduct") : t("inventory.newProduct")), [isEditing, t]);

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
      const nextErrorKey = draftValidation.errors.opening
        ? "opening"
        : draftValidation.errors.name
          ? "name"
          : draftValidation.errors.price
            ? "price"
            : "completeForm";
      const nextError = t(`inventory.validation.${nextErrorKey}`);
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
      toast.success(product ? t("inventory.toast.productUpdated", { sku: saved.sku }) : t("inventory.toast.productCreated", { sku: saved.sku }), {
        description: t("inventory.toast.productAvailable", { name: saved.name }),
      });
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : t("inventory.toast.unableToSaveProduct"));
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
                {t("inventory.modals.productDescription")}
              </p>
            </div>
          </div>

          <form ref={formRef} className="space-y-4 bg-background px-6 py-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="product-sku">{t("inventory.fields.sku")}</Label>
                <Input
                  id="product-sku"
                  name="sku"
                  defaultValue={product?.sku ?? ""}
                  className="mt-1.5 font-mono"
                  placeholder={isEditing ? "" : t("inventory.fields.optionalAutoGenerated")}
                  disabled={isEditing}
                />
              </div>

              <div>
                <Label>{t("inventory.fields.productType")}</Label>
                <Select value={productType} onValueChange={(value) => setProductType(value as ProductType)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="service">{t("inventory.productTypes.service")}</SelectItem>
                    <SelectItem value="stock-counted">{t("inventory.productTypes.stockCounted")}</SelectItem>
                    <SelectItem value="non-stock">{t("inventory.productTypes.nonStock")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2">
                <Label htmlFor="product-name">{t("inventory.fields.name")}</Label>
                <Input id="product-name" name="name" defaultValue={product?.name ?? ""} className="mt-1.5" />
              </div>

              <div>
                <Label htmlFor="product-price">{t("inventory.fields.price")}</Label>
                <Input
                  id="product-price"
                  name="price"
                  type="number"
                  defaultValue={product?.price ?? ""}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label>{t("inventory.fields.status")}</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as "active" | "inactive")}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t("status.active")}</SelectItem>
                    <SelectItem value="inactive">{t("status.inactive")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="product-stock">{t("inventory.fields.currentStock")}</Label>
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
                <Label htmlFor="product-opening-stock">{t("inventory.fields.openingStock")}</Label>
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
                <Label htmlFor="product-opening-cost">{t("inventory.fields.openingCost")}</Label>
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
                <Label htmlFor="product-opening-date">{t("inventory.fields.openingDate")}</Label>
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
              {t("common.cancel")}
            </Button>
            <Button
              className="border-0 bg-gradient-brand text-primary-foreground shadow-brand"
              onClick={() => void handleSubmit()}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {isEditing ? t("inventory.actions.saveProduct") : t("inventory.actions.createProduct")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ProcessingDialog
        open={submitting}
        title={isEditing ? t("inventory.processing.savingProduct") : t("inventory.processing.creatingProduct")}
        message={t("inventory.processing.productMessage")}
      />
    </>
  );
};

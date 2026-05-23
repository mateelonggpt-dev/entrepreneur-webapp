export type ProductDraftType = "service" | "stock-counted" | "non-stock";

export interface ProductDraftInput {
  productType: ProductDraftType;
  name: string;
  price: number;
  stock?: number | null;
  openingStockQty?: number;
  openingCost?: number;
  openingDate?: string;
}

export const validateProductDraft = (draft: ProductDraftInput) => {
  const errors: Record<string, string> = {};

  if (!draft.name.trim()) {
    errors.name = "Product name is required.";
  }

  if (!Number.isFinite(draft.price) || draft.price <= 0) {
    errors.price = "Sale price must be greater than zero.";
  }

  if (draft.productType === "stock-counted") {
    const openingQty = draft.openingStockQty;
    const openingCost = draft.openingCost;
    const openingDate = (draft.openingDate ?? "").trim();

    if (
      !Number.isFinite(Number(openingQty)) ||
      !Number.isFinite(Number(openingCost)) ||
      !openingDate
    ) {
      errors.opening = "Opening qty, opening cost, and opening date are required together.";
    } else {
      if (Number(openingQty) < 0) {
        errors.opening = "Opening qty cannot be negative.";
      }
      if (Number(openingCost) < 0) {
        errors.opening = "Opening cost cannot be negative.";
      }
    }
  } else {
    const hasOpeningValues =
      Boolean((draft.openingDate ?? "").trim()) ||
      Number(draft.openingStockQty ?? 0) !== 0 ||
      Number(draft.openingCost ?? 0) !== 0;

    if (hasOpeningValues) {
      errors.opening = "Only stock-counted products can include opening stock fields.";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};

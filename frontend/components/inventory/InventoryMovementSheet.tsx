import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Card } from "@/components/ui/card";
import type { InventoryItem, InventoryMovement } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  item?: InventoryItem | null;
  movements: InventoryMovement[];
}

export const InventoryMovementSheet = ({ open, onOpenChange, item, movements }: Props) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent className="sm:max-w-2xl">
      <SheetHeader>
        <SheetTitle>{item?.name ?? "Movement history"}</SheetTitle>
        <SheetDescription>{item?.sku ?? "Select a stock item to inspect its movement timeline."}</SheetDescription>
      </SheetHeader>

      {item ? (
        <div className="mt-6 space-y-4">
          <Card className="rounded-2xl border border-border/60 p-4">
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Current qty</p>
                <p className="mt-1 font-semibold">{item.currentQty}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Average cost</p>
                <p className="mt-1 font-semibold">{item.averageCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Warehouse</p>
                <p className="mt-1 font-semibold">{item.warehouse}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Stock status</p>
                <div className="mt-2">
                  <StatusBadge status={item.stockStatus} />
                </div>
              </div>
            </div>
          </Card>

          {movements.length > 0 ? (
            <div className="space-y-3">
              {movements.map((movement) => (
                <div key={movement.id} className="rounded-2xl border border-border/60 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold capitalize">
                        {movement.sourceType.replace(/_/g, " ")}
                        {movement.sourceLabel ? ` • ${movement.sourceLabel}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {movement.effectiveDate}
                        {movement.reason ? ` • ${movement.reason}` : ""}
                      </p>
                    </div>
                    <div className="text-right text-sm font-semibold">
                      <p className="text-success">+{movement.qtyIn || 0}</p>
                      <p className="text-destructive">-{movement.qtyOut || 0}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Source document</p>
                      <p className="mt-1 font-mono text-xs">{movement.sourceDocumentId || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Before / After</p>
                      <p className="mt-1 font-semibold">{movement.beforeQty} → {movement.afterQty}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Unit / Avg cost</p>
                      <p className="mt-1 font-semibold">
                        {movement.unitCost.toLocaleString("en-US", { minimumFractionDigits: 2 })} /{" "}
                        {(movement.averageCost ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Warehouse</p>
                      <p className="mt-1 font-semibold">{movement.warehouse ?? "-"}</p>
                    </div>
                  </div>

                  {movement.notes ? (
                    <p className="mt-3 rounded-xl bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
                      {movement.notes}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <Card className="rounded-2xl border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
              No movement history is available for this SKU yet.
            </Card>
          )}
        </div>
      ) : null}
    </SheetContent>
  </Sheet>
);

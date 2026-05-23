import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { ListToolbar } from "@/components/ui-kit/ListToolbar";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { ExpenseDocumentModal, IncomeDocumentModal } from "@/components/modals/DomainModals";
import { useAppData } from "@/lib/app-data";
import { fmtTHB } from "@/lib/demo-data";
import { exportResource } from "@/lib/api";
import { toast } from "sonner";

interface ModulePageProps {
  titleKey?: string;
  groupKey?: string;
  primaryActionKey?: string;
  modalKind?: "quotation" | "invoice" | "receipt" | "po" | "receive" | "none";
  title?: string;
  group?: string;
  description?: string;
  primaryActionLabel?: string;
}

export const ModulePage = ({
  titleKey,
  groupKey,
  primaryActionKey,
  modalKind,
  title,
  group,
  description,
  primaryActionLabel = "Create New",
}: ModulePageProps) => {
  const { t } = useTranslation();
  const { data } = useAppData();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const resolvedTitle = titleKey ? t(titleKey) : (title ?? "");
  const resolvedGroup = groupKey ? t(groupKey) : (group ?? "");
  const resolvedAction = primaryActionKey ? t(primaryActionKey) : primaryActionLabel;
  const lower = resolvedTitle.toLowerCase();
  const resolvedModalKind =
    modalKind ??
    (lower.includes("quotation")
      ? "quotation"
      : lower.includes("invoice")
        ? "invoice"
        : lower.includes("receipt")
          ? "receipt"
          : lower.includes("purchase order")
            ? "po"
            : lower.includes("received") || lower.includes("receive")
              ? "receive"
              : "none");

  const collectionMap = {
    quotation: data.quotations,
    invoice: data.invoices.map((invoice) => ({
      id: invoice.id,
      party: invoice.customer,
      date: invoice.date,
      amount: invoice.amount,
      status: invoice.status,
      kind: "invoice" as const,
    })),
    receipt: data.receipts,
    po: data.purchaseOrders,
    receive: data.receives,
    none: null,
  };

  const exportMap = {
    quotation: "quotations",
    invoice: "invoices",
    receipt: "receipts",
    po: "purchase-orders",
    receive: "receives",
    none: null,
  };

  const renderModal = () => {
    switch (resolvedModalKind) {
      case "quotation":
        return <IncomeDocumentModal kind="quotation" open={open} onOpenChange={setOpen} />;
      case "invoice":
        return <IncomeDocumentModal kind="invoice" open={open} onOpenChange={setOpen} />;
      case "receipt":
        return <IncomeDocumentModal kind="receipt" open={open} onOpenChange={setOpen} />;
      case "po":
        return <ExpenseDocumentModal kind="purchase_order" open={open} onOpenChange={setOpen} />;
      case "receive":
        return <ExpenseDocumentModal kind="receive" open={open} onOpenChange={setOpen} />;
      default:
        return null;
    }
  };

  const rows = collectionMap[resolvedModalKind];
  const exportKey = exportMap[resolvedModalKind];
  const filteredRows = useMemo(() => {
    if (!Array.isArray(rows)) {
      return rows;
    }

    const query = search.trim().toLowerCase();
    if (!query) {
      return rows;
    }

    return rows.filter((item) =>
      [item.id, item.party, item.date, String(item.amount)]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [rows, search]);

  const hasRows = Array.isArray(filteredRows) && filteredRows.length > 0;
  const canCreate = resolvedModalKind !== "none";

  const handleExport = async () => {
    if (!exportKey) {
      return;
    }

    try {
      await exportResource(exportKey);
      toast.success(`${resolvedTitle} export downloaded`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to export this list.");
    }
  };

  return (
    <AppShell>
      <PageHeader
        title={resolvedTitle}
        description={description ?? t("module.manage", { name: resolvedTitle })}
        breadcrumbs={[{ label: resolvedGroup }, { label: resolvedTitle }]}
      />
      <ListToolbar
        primaryAction={canCreate ? { label: resolvedAction, onClick: () => setOpen(true) } : undefined}
        searchPlaceholder={t("module.searchPlaceholder", { name: resolvedTitle })}
        searchValue={search}
        onSearchChange={setSearch}
        onExportClick={exportKey ? () => void handleExport() : undefined}
      />
      <Card className="card-premium">
        {hasRows ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50">
                <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 text-left font-semibold">Document</th>
                  <th className="px-3 py-3 text-left font-semibold">Party</th>
                  <th className="px-3 py-3 text-left font-semibold">Date</th>
                  <th className="px-3 py-3 text-right font-semibold">Amount</th>
                  <th className="px-3 py-3 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows?.map((item) => (
                  <tr key={item.id} className="border-t border-border/50">
                    <td className="px-4 py-3.5 font-mono text-xs font-semibold text-primary">{item.id}</td>
                    <td className="px-3 py-3.5 font-medium">{item.party}</td>
                    <td className="px-3 py-3.5 text-muted-foreground">{item.date}</td>
                    <td className="px-3 py-3.5 text-right font-semibold tabular-nums">{fmtTHB(item.amount)}</td>
                    <td className="px-3 py-3.5">
                      <StatusBadge status={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={t("module.emptyTitle", { name: resolvedTitle })}
            description={t("module.emptyDesc", { name: resolvedTitle })}
            action={canCreate ? { label: resolvedAction, onClick: () => setOpen(true) } : undefined}
          />
        )}
      </Card>
      {renderModal()}
    </AppShell>
  );
};

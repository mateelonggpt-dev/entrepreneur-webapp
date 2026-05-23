import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { WithholdingTaxModal } from "@/components/modals/WithholdingTaxModal";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { ListToolbar } from "@/components/ui-kit/ListToolbar";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  createTaxFiling,
  downloadTaxFiling,
  downloadWithholdingTaxText,
  exportResource,
  fetchTaxFilings,
  fetchTaxOverview,
} from "@/lib/api";
import { useAppData } from "@/lib/app-data";
import { fmtTHB } from "@/lib/demo-data";
import { buildPayables } from "@/lib/purchases";
import type { TaxFilingRecord, TaxOverview } from "@/lib/types";
import { FileText, MoreHorizontal, ReceiptText } from "lucide-react";
import { toast } from "sonner";

const WithholdingTax = () => {
  const { data } = useAppData();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [taxOverview, setTaxOverview] = useState<TaxOverview | null>(null);
  const [filings, setFilings] = useState<TaxFilingRecord[]>([]);
  const [filingTypeLoading, setFilingTypeLoading] = useState<string | null>(null);
  const payables = useMemo(() => buildPayables(data), [data]);
  const filingPeriod = data.withholdingTaxDocuments[0]?.filingMonth || data.vatSummary.filingPeriod || "2026-04";

  const loadTaxShells = async () => {
    try {
      const [nextOverview, nextFilings] = await Promise.all([fetchTaxOverview(), fetchTaxFilings()]);
      setTaxOverview(nextOverview);
      setFilings(nextFilings);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load tax shells.");
    }
  };

  useEffect(() => {
    void loadTaxShells();
  }, []);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.withholdingTaxDocuments.filter((row) => {
      if (!query) {
        return true;
      }
      return (
        row.id.toLowerCase().includes(query) ||
        row.vendor.toLowerCase().includes(query) ||
        row.sourceDocumentId.toLowerCase().includes(query)
      );
    });
  }, [data.withholdingTaxDocuments, search]);

  const handleExport = async () => {
    try {
      await exportResource("withholding-tax");
      toast.success("Withholding tax export downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to export withholding tax.");
    }
  };

  const handleCreateFiling = async (
    filingType: TaxFilingRecord["filingType"],
    note: string
  ) => {
    setFilingTypeLoading(filingType);
    try {
      await createTaxFiling({
        filingType,
        period: filingPeriod,
        note,
      });
      await loadTaxShells();
      toast.success("Tax filing shell created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create tax filing shell.");
    } finally {
      setFilingTypeLoading(null);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Withholding Tax"
        description="Track WHT documents created from expense payments and export filing-ready text shells."
        breadcrumbs={[{ label: "Purchases & Expenses" }, { label: "Withholding Tax" }]}
      />

      <ListToolbar
        searchPlaceholder="Search WHT document, vendor, or source..."
        searchValue={search}
        onSearchChange={setSearch}
        primaryAction={{ label: "New WHT Document", onClick: () => setOpen(true) }}
        onExportClick={() => void handleExport()}
      />

      <div className="mb-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="card-premium p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold">Tax filing shells</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Create VAT summary, WHT filing, tax period close, and payment-posting shells from the shared tax store.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">Period {filingPeriod}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {[
              ["vat_summary", "VAT Summary", "Create a filing-ready shell from current VAT summary data."],
              ["wht_filing", "WHT Filing", "Bundle withholding documents for the filing month."],
              ["close_tax_period", "Close Tax Period", "Prepare a close-period checklist and summary shell."],
              ["payment_posting", "Payment Posting", "Capture the posting shell for tax settlement."],
            ].map(([type, label, description]) => (
              <div key={type} className="rounded-xl border border-border/60 p-4">
                <p className="font-semibold">{label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() =>
                    void handleCreateFiling(type as TaxFilingRecord["filingType"], `${label} shell for ${filingPeriod}`)
                  }
                  disabled={filingTypeLoading === type}
                >
                  {filingTypeLoading === type ? "Creating..." : "Create shell"}
                </Button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="card-premium p-5">
          <h2 className="font-display text-lg font-semibold">Tax overview</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Output tax</span>
              <span className="font-semibold">{fmtTHB(taxOverview?.vatSummary.outputTax ?? data.vatSummary.outputTax)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Input tax</span>
              <span className="font-semibold">{fmtTHB(taxOverview?.vatSummary.inputTax ?? data.vatSummary.inputTax)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Net VAT payable</span>
              <span className="font-semibold">{fmtTHB(taxOverview?.vatSummary.netVatPayable ?? data.vatSummary.netVatPayable)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Pending WHT docs</span>
              <span className="font-semibold">{taxOverview?.pendingWhtDocuments ?? data.withholdingTaxDocuments.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Saved filing shells</span>
              <span className="font-semibold">{taxOverview?.filingCount ?? filings.length}</span>
            </div>
          </div>
        </Card>
      </div>

      <Card className="card-premium mb-6 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">Saved tax filings</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Filing shells are stored in the backend so VAT and WHT modules can grow without page-local logic.
            </p>
          </div>
        </div>

        {filings.length > 0 ? (
          <div className="space-y-3">
            {filings.map((filing) => (
              <div key={filing.id} className="flex flex-col gap-3 rounded-xl border border-border/60 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-semibold">{filing.id}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {filing.filingType.replace(/_/g, " ")} • {filing.period} • {filing.note || "Tax filing shell"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={filing.status === "draft" ? "draft" : "pending"} />
                  <Button variant="ghost" size="sm" onClick={() => void downloadTaxFiling(filing.id)}>
                    <FileText className="mr-1.5 h-4 w-4" /> Download shell
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No filing shells created yet.</p>
        )}
      </Card>

      <Card className="card-premium overflow-hidden">
        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50">
                <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 text-left font-semibold">Document</th>
                  <th className="px-3 py-3 text-left font-semibold">Vendor</th>
                  <th className="px-3 py-3 text-left font-semibold">Source</th>
                  <th className="px-3 py-3 text-left font-semibold">Filing Month</th>
                  <th className="px-3 py-3 text-right font-semibold">WHT Amount</th>
                  <th className="px-3 py-3 text-left font-semibold">Status</th>
                  <th className="w-10 px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-border/50 hover:bg-secondary/30">
                    <td className="px-4 py-3.5 font-mono text-xs font-semibold text-primary">{row.id}</td>
                    <td className="px-3 py-3.5 font-medium">{row.vendor}</td>
                    <td className="px-3 py-3.5 text-muted-foreground">{row.sourceDocumentId}</td>
                    <td className="px-3 py-3.5 text-muted-foreground">{row.filingMonth}</td>
                    <td className="px-3 py-3.5 text-right font-semibold tabular-nums">{fmtTHB(row.amount)}</td>
                    <td className="px-3 py-3.5">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-3.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => void downloadWithholdingTaxText(row.id)}>
                            Download filing text
                          </DropdownMenuItem>
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
            title="No WHT documents yet"
            description="They will be generated from vendor payments, or you can create one manually from this page."
            action={{ label: "New WHT Document", onClick: () => setOpen(true) }}
            icon={<ReceiptText className="h-10 w-10 text-primary" />}
          />
        )}
      </Card>

      <WithholdingTaxModal open={open} onOpenChange={setOpen} payables={payables} />
    </AppShell>
  );
};

export default WithholdingTax;

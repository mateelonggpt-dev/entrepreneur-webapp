import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { fetchJournalEntries } from "@/lib/api";
import { useAppData } from "@/lib/app-data";
import { fmtTHB } from "@/lib/demo-data";
import type { JournalEntry } from "@/lib/types";
import { FileBarChart, Loader2, ReceiptText, Scale } from "lucide-react";
import { toast } from "sonner";

const JOURNAL_TABS: Array<{ value: "all" | "JV" | "UV" | "SV" | "PV" | "RV"; label: string }> = [
  { value: "all", label: "All" },
  { value: "JV", label: "JV" },
  { value: "UV", label: "UV" },
  { value: "SV", label: "SV" },
  { value: "PV", label: "PV" },
  { value: "RV", label: "RV" },
];

const normalizeStatus = (status?: string) => {
  if (!status || status === "posted") {
    return "approved";
  }
  return status as "active" | "approved" | "paid" | "pending" | "draft" | "partial" | "sent" | "inactive";
};

const Journal = () => {
  const nav = useNavigate();
  const { data } = useAppData();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<(typeof JOURNAL_TABS)[number]["value"]>("all");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const nextEntries = await fetchJournalEntries();
        if (!cancelled) {
          setEntries(nextEntries);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Unable to load journal entries.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const flattenedRows = useMemo(
    () =>
      entries.flatMap((entry) =>
        entry.lines.map((line, index) => ({
          id: `${entry.id}-${index}`,
          entry,
          line,
          debit: line.side === "debit" ? line.amount : 0,
          credit: line.side === "credit" ? line.amount : 0,
        }))
      ),
    [entries]
  );

  const filteredRows = useMemo(
    () => flattenedRows.filter((row) => tab === "all" || row.entry.journalType === tab),
    [flattenedRows, tab]
  );

  const selectedRuleExplanation = filteredRows[0]?.entry.ruleExplanation ?? "Journal rows are derived from the shared accounting-event layer.";

  return (
    <AppShell>
      <PageHeader
        title="Journal"
        description="Every posted accounting event flows through this shared journal model."
        breadcrumbs={[{ label: "Finance & Reports" }, { label: "Journal" }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => nav("/finance/statements")}>
              <FileBarChart className="mr-1.5 h-4 w-4" /> Statements
            </Button>
            <Button variant="outline" size="sm" onClick={() => nav("/reports")}>
              <ReceiptText className="mr-1.5 h-4 w-4" /> Reports
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.8fr_1fr]">
        <Card className="card-premium p-6">
          <div className="mb-4 flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            <div>
              <h2 className="font-display font-semibold">Posting policy</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                VAT on {data.policySummary.outputTaxRecognition}, stock on {data.policySummary.stockDeductionTiming}, base currency {data.policySummary.baseCurrency}.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-border/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Receipt variant</p>
              <p className="mt-2 text-sm font-semibold">{data.policySummary.receiptVariant}</p>
            </div>
            <div className="rounded-xl border border-border/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Document mutability</p>
              <p className="mt-2 text-sm font-semibold">
                {data.policySummary.lockDocumentsAfterPayment ? "Locked after payment" : "Editable after payment"}
              </p>
            </div>
          </div>
        </Card>

        <Card className="card-premium p-6">
          <h2 className="font-display font-semibold">Rule explanation</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">The active journal view explains how these entries are derived.</p>
          <div className="mt-4 rounded-xl border border-border/50 p-4 text-sm text-muted-foreground">
            {selectedRuleExplanation}
          </div>
          <div className="mt-4 space-y-3">
            {data.trialBalance.slice(0, 4).map((line) => (
              <div key={line.account} className="flex items-center justify-between rounded-xl border border-border/50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">{line.account}</p>
                  <p className="text-xs text-muted-foreground">Debit {fmtTHB(line.debit)} - Credit {fmtTHB(line.credit)}</p>
                </div>
                <p className="text-sm font-semibold">{fmtTHB(Math.abs(line.balance))}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="card-premium p-6">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display font-semibold">Journal rows</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Click any row to open the originating document or source module.</p>
          </div>
          <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
            <TabsList className="bg-secondary">
              {JOURNAL_TABS.map((item) => (
                <TabsTrigger key={item.value} value={item.value}>
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading journal...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold">Type</th>
                  <th className="px-3 py-3 text-left font-semibold">Date</th>
                  <th className="px-3 py-3 text-left font-semibold">Source document</th>
                  <th className="px-3 py-3 text-left font-semibold">Memo</th>
                  <th className="px-3 py-3 text-left font-semibold">Account</th>
                  <th className="px-3 py-3 text-right font-semibold">Debit</th>
                  <th className="px-3 py-3 text-right font-semibold">Credit</th>
                  <th className="px-3 py-3 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-t border-border/50 hover:bg-secondary/20"
                    onClick={() => nav(row.entry.sourceRoute || "/reports")}
                  >
                    <td className="px-3 py-3">
                      <span className="rounded bg-secondary px-2 py-1 text-[11px] font-semibold text-primary">
                        {row.entry.journalType ?? "JV"}
                      </span>
                    </td>
                    <td className="px-3 py-3">{row.entry.date}</td>
                    <td className="px-3 py-3">
                      <p className="font-mono text-xs font-semibold text-primary">{row.entry.sourceId}</p>
                      <p className="text-xs text-muted-foreground">{row.entry.description}</p>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{row.entry.memo ?? row.entry.description}</td>
                    <td className="px-3 py-3">{row.line.account}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">
                      {row.debit ? fmtTHB(row.debit) : "-"}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">
                      {row.credit ? fmtTHB(row.credit) : "-"}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={normalizeStatus(row.entry.status)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AppShell>
  );
};

export default Journal;

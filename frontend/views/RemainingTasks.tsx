import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { ListToolbar } from "@/components/ui-kit/ListToolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { readRemainingTasks, saveRemainingTasks, type RemainingTask } from "@/lib/remaining-tasks";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";

const evidenceLabels: Record<RemainingTask["missingEvidenceType"], string> = {
  payment: "Payment evidence",
  tax_invoice: "Tax invoice evidence",
  inventory: "Inventory evidence",
  invoiceReceipt: "Invoice / Receipt",
  paymentEvidence: "Payment Evidence",
  deliveryEvidence: "Delivery Note / Proof of Delivery",
};

const RemainingTasks = () => {
  const nav = useNavigate();
  const [tasks, setTasks] = useState<RemainingTask[]>([]);
  const [search, setSearch] = useState("");

  const load = () => setTasks(readRemainingTasks());

  useEffect(() => {
    load();
    window.addEventListener("matter.remainingTasksChanged", load);
    return () => window.removeEventListener("matter.remainingTasksChanged", load);
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter((task) =>
      !query ||
      task.title.toLowerCase().includes(query) ||
      task.relatedDocumentNumber.toLowerCase().includes(query) ||
      task.documentType.toLowerCase().includes(query)
    );
  }, [search, tasks]);

  const pendingCount = tasks.filter((task) => task.status === "pending").length;

  const markComplete = (task: RemainingTask) => {
    const next = tasks.map((item) => (item.id === task.id ? { ...item, status: "completed" as const } : item));
    setTasks(next);
    saveRemainingTasks(next);
  };

  return (
    <AppShell>
      <PageHeader
        title="Remaining Tasks / งานค้าง"
        description="Unfinished document work that needs evidence or review."
        breadcrumbs={[{ label: "Remaining Tasks / งานค้าง" }]}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Pending</p>
          <p className="font-display text-2xl font-bold text-primary">{pendingCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Completed</p>
          <p className="font-display text-2xl font-bold">{tasks.length - pendingCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="font-display text-2xl font-bold">{tasks.length}</p>
        </Card>
      </div>

      <ListToolbar searchPlaceholder="Search tasks, document number, evidence type..." searchValue={search} onSearchChange={setSearch} />

      <div className="space-y-3">
        {filtered.map((task) => (
          <Card key={task.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 items-start gap-3">
              {task.status === "completed" ? <CheckCircle2 className="mt-1 h-5 w-5 text-emerald-600" /> : <Circle className="mt-1 h-5 w-5 text-amber-500" />}
              <div className="min-w-0">
                <p className="font-semibold">{task.title}</p>
                <p className="text-sm text-muted-foreground">
                  {task.relatedDocumentNumber} · {task.documentType} · {task.createdDate}
                </p>
                <Badge variant={task.status === "completed" ? "secondary" : "outline"} className="mt-2">
                  {task.status} · {evidenceLabels[task.missingEvidenceType]}
                </Badge>
              </div>
            </div>
            <div className="flex gap-2">
              {task.status === "pending" ? <Button variant="outline" size="sm" onClick={() => markComplete(task)}>Mark complete</Button> : null}
              <Button size="sm" className="gap-1.5" onClick={() => nav(task.documentPath)}>
                <ExternalLink className="h-4 w-4" /> Open
              </Button>
            </div>
          </Card>
        ))}
        {!filtered.length ? (
          <Card className="p-8 text-center text-muted-foreground">No remaining tasks found.</Card>
        ) : null}
      </div>
    </AppShell>
  );
};

export default RemainingTasks;

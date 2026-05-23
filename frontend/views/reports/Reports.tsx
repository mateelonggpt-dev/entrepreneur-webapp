import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { MasterDataModal } from "@/components/modals/DomainModals";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  ChevronRight,
  FileBarChart,
  Package,
  Percent,
  Receipt,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useAppData } from "@/lib/app-data";
import { deleteProject, downloadReport } from "@/lib/api";
import { fmtTHB } from "@/lib/demo-data";
import type { Project } from "@/lib/types";
import { toast } from "sonner";

const reportIcons = {
  BarChart3,
  FileBarChart,
  Package,
  Percent,
  Receipt,
  TrendingUp,
  Users,
  Wallet,
};

const Reports = () => {
  const { data, refresh } = useAppData();
  const reports = data.reports;
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const handleReport = async (reportKey?: string, reportName?: string) => {
    if (!reportKey || !reportName) {
      toast.error("This report is not available yet.");
      return;
    }

    try {
      await downloadReport(reportKey);
      toast.success(`${reportName} generated`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to generate report.");
    }
  };

  const handleDeleteProject = async (project: Project) => {
    const confirmed = window.confirm(`Delete project ${project.name}?`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteProject(project.id);
      await refresh();
      toast.success(`Project ${project.name} deleted`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete project.");
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Reports"
        description="Generate financial, tax, operational, and project profitability reports."
        breadcrumbs={[{ label: "Finance & Reports" }, { label: "Reports" }]}
        actions={
          <Button
            size="sm"
            className="gap-1.5 border-0 bg-gradient-brand text-primary-foreground shadow-brand"
            onClick={() => {
              setEditingProject(null);
              setProjectModalOpen(true);
            }}
          >
            New project
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="card-premium p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Net profit</p>
          <p className="mt-2 font-display text-2xl font-bold">{fmtTHB(data.profitAndLoss.netProfit)}</p>
        </Card>
        <Card className="card-premium p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assets</p>
          <p className="mt-2 font-display text-2xl font-bold">{fmtTHB(data.balanceSheet.assets)}</p>
        </Card>
        <Card className="card-premium p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Net VAT payable</p>
          <p className="mt-2 font-display text-2xl font-bold">{fmtTHB(data.vatSummary.netVatPayable)}</p>
        </Card>
        <Card className="card-premium p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Open receivables</p>
          <p className="mt-2 font-display text-2xl font-bold">{fmtTHB(data.dashboardSummary.receivables)}</p>
        </Card>
      </div>

      {reports.map((group) => (
        <div key={group.cat} className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.cat}</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {group.items.map((report) => {
              const Icon = reportIcons[report.icon as keyof typeof reportIcons] ?? FileBarChart;

              return (
                <Card
                  key={report.name}
                  className="card-premium group cursor-pointer p-5 transition hover:shadow-premium"
                  onClick={() => void handleReport(report.key, report.name)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void handleReport(report.key, report.name);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-gradient-brand-soft">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display font-semibold">{report.name}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">{report.desc}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      <Card className="card-premium p-6">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display font-semibold">Project profitability</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Manage projects here and keep revenue/cost visibility tied to shared document data.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void handleReport("project-profitability", "Project profitability")}>
            Export project report
          </Button>
        </div>

        {data.projects.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold">Project</th>
                  <th className="px-3 py-3 text-left font-semibold">Customer</th>
                  <th className="px-3 py-3 text-right font-semibold">Revenue</th>
                  <th className="px-3 py-3 text-right font-semibold">Cost</th>
                  <th className="px-3 py-3 text-right font-semibold">Profit</th>
                  <th className="px-3 py-3 text-left font-semibold">Status</th>
                  <th className="px-3 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.projects.map((project) => (
                  <tr key={project.id} className="border-t border-border/50">
                    <td className="px-3 py-3">
                      <p className="font-semibold">{project.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {project.code || project.id}
                        {project.lastActivityDate ? ` - Last activity ${project.lastActivityDate}` : ""}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{project.customer || "-"}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{fmtTHB(project.revenue ?? 0)}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{fmtTHB(project.cost ?? 0)}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{fmtTHB(project.profit ?? 0)}</td>
                    <td className="px-3 py-3">
                      <StatusBadge status={(project.status as "active" | "inactive") ?? "active"} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingProject(project);
                            setProjectModalOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => void handleDeleteProject(project)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No projects yet"
            description="Create a project to tag documents and unlock profitability reporting."
            action={{
              label: "Create project",
              onClick: () => {
                setEditingProject(null);
                setProjectModalOpen(true);
              },
            }}
          />
        )}
      </Card>

      <MasterDataModal
        kind="project"
        open={projectModalOpen}
        onOpenChange={setProjectModalOpen}
        project={editingProject}
        onSaved={() => setEditingProject(null)}
      />
    </AppShell>
  );
};

export default Reports;

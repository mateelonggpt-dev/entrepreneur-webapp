import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const { data, refresh } = useAppData();
  const reports = data.reports;
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const handleReport = async (reportKey?: string, reportName?: string) => {
    if (!reportKey || !reportName) {
      toast.error(t("reports.toast.notAvailable"));
      return;
    }

    try {
      await downloadReport(reportKey);
      toast.success(t("reports.toast.generated", { report: reportName }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("reports.toast.unableToGenerate"));
    }
  };

  const handleDeleteProject = async (project: Project) => {
    const confirmed = window.confirm(t("reports.projects.confirmDelete", { name: project.name }));
    if (!confirmed) {
      return;
    }

    try {
      await deleteProject(project.id);
      await refresh();
      toast.success(t("reports.toast.projectDeleted", { name: project.name }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("reports.toast.unableToDeleteProject"));
    }
  };

  const reportGroupLabel = (category: string) =>
    t(`reports.groups.${category.toLowerCase()}`, { defaultValue: category });

  const reportName = (reportKey: string | undefined, fallback: string) =>
    reportKey ? t(`reports.items.${reportKey}.name`, { defaultValue: fallback }) : fallback;

  const reportDescription = (reportKey: string | undefined, fallback: string) =>
    reportKey ? t(`reports.items.${reportKey}.description`, { defaultValue: fallback }) : fallback;

  return (
    <AppShell>
      <PageHeader
        title={t("reports.title")}
        description={t("reports.description")}
        breadcrumbs={[{ label: t("nav.finance") }, { label: t("reports.title") }]}
        actions={
          <Button
            size="sm"
            className="gap-1.5 border-0 bg-gradient-brand text-primary-foreground shadow-brand"
            onClick={() => {
              setEditingProject(null);
              setProjectModalOpen(true);
            }}
          >
            {t("reports.projects.newProject")}
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="card-premium p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("reports.kpi.netProfit")}</p>
          <p className="mt-2 font-display text-2xl font-bold">{fmtTHB(data.profitAndLoss.netProfit)}</p>
        </Card>
        <Card className="card-premium p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("reports.kpi.assets")}</p>
          <p className="mt-2 font-display text-2xl font-bold">{fmtTHB(data.balanceSheet.assets)}</p>
        </Card>
        <Card className="card-premium p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("reports.kpi.netVatPayable")}</p>
          <p className="mt-2 font-display text-2xl font-bold">{fmtTHB(data.vatSummary.netVatPayable)}</p>
        </Card>
        <Card className="card-premium p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("reports.kpi.openReceivables")}</p>
          <p className="mt-2 font-display text-2xl font-bold">{fmtTHB(data.dashboardSummary.receivables)}</p>
        </Card>
      </div>

      {reports.map((group) => (
        <div key={group.cat} className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{reportGroupLabel(group.cat)}</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {group.items.map((report) => {
              const Icon = reportIcons[report.icon as keyof typeof reportIcons] ?? FileBarChart;

              return (
                <Card
                  key={report.name}
                  className="card-premium group cursor-pointer p-5 transition hover:shadow-premium"
                  onClick={() => void handleReport(report.key, reportName(report.key, report.name))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void handleReport(report.key, reportName(report.key, report.name));
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
                      <h3 className="font-display font-semibold">{reportName(report.key, report.name)}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">{reportDescription(report.key, report.desc)}</p>
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
            <h2 className="font-display font-semibold">{t("reports.projects.title")}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("reports.projects.description")}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void handleReport("project-profitability", t("reports.projects.title"))}>
            {t("reports.actions.exportProjectReport")}
          </Button>
        </div>

        {data.projects.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold">{t("reports.projects.fields.project")}</th>
                  <th className="px-3 py-3 text-left font-semibold">{t("reports.projects.fields.customer")}</th>
                  <th className="px-3 py-3 text-right font-semibold">{t("reports.projects.fields.revenue")}</th>
                  <th className="px-3 py-3 text-right font-semibold">{t("reports.projects.fields.cost")}</th>
                  <th className="px-3 py-3 text-right font-semibold">{t("reports.projects.fields.profit")}</th>
                  <th className="px-3 py-3 text-left font-semibold">{t("reports.projects.fields.status")}</th>
                  <th className="px-3 py-3 text-right font-semibold">{t("reports.projects.fields.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {data.projects.map((project) => (
                  <tr key={project.id} className="border-t border-border/50">
                    <td className="px-3 py-3">
                      <p className="font-semibold">{project.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {project.code || project.id}
                        {project.lastActivityDate ? ` - ${t("reports.projects.lastActivity", { date: project.lastActivityDate })}` : ""}
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
                          {t("common.edit")}
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => void handleDeleteProject(project)}>
                          {t("common.delete")}
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
            title={t("reports.empty.noProjectsTitle")}
            description={t("reports.empty.noProjectsDescription")}
            action={{
              label: t("reports.projects.createProject"),
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

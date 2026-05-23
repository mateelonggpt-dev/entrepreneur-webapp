import { useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { KpiCard } from "@/components/ui-kit/KpiCard";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mascot } from "@/components/brand/Mascot";
import { IncomeDocumentModal } from "@/components/modals/DomainModals";
import {
  TrendingUp,
  Wallet,
  Banknote,
  FileText,
  Receipt,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Sparkles,
  ChevronRight,
  Activity,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";
import { fmtTHB } from "@/lib/demo-data";
import { useAppData } from "@/lib/app-data";
import { sendPaymentReminders } from "@/lib/api";
import { toast } from "sonner";

const Dashboard = () => {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { data, refresh } = useAppData();
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);
  const { invoices, cashFlow, topCustomersChart, recentActivity, dashboardSummary } = data;

  const openAssistant = () => {
    window.dispatchEvent(new Event("matter-assistant:open"));
  };

  const handleSendReminders = async () => {
    setSendingReminders(true);
    try {
      const result = await sendPaymentReminders();
      await refresh();
      toast.success("Payment reminders sent", {
        description: `${result.count} reminder(s) were logged in the backend.`,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send reminders.");
    } finally {
      setSendingReminders(false);
    }
  };

  const quickActions = [
    { label: t("dashboard.quick.invoice"), icon: Receipt, action: () => setInvoiceOpen(true) },
    { label: t("dashboard.quick.expense"), icon: Wallet, action: () => nav("/purchases/expenses") },
    { label: t("dashboard.quick.customer"), icon: FileText, action: () => nav("/contacts/customers") },
    { label: t("dashboard.quick.payment"), icon: Banknote, action: () => setReceiptOpen(true) },
  ];

  const alertCards = [
    { title: t("dashboard.alertsList.overdue.t"), subtitle: t("dashboard.alertsList.overdue.s"), to: "/sales/invoices" },
    { title: t("dashboard.alertsList.vat.t"), subtitle: t("dashboard.alertsList.vat.s"), to: "/reports" },
    { title: t("dashboard.alertsList.stock.t"), subtitle: t("dashboard.alertsList.stock.s"), to: "/products" },
  ];

  return (
    <AppShell>
      <PageHeader
        title={t("dashboard.greeting")}
        description={t("dashboard.subtitle")}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => nav("/reports")}>
              <FileText className="h-4 w-4" /> {t("common.generateReport")}
            </Button>
            <Button
              size="sm"
              className="gap-1.5 border-0 bg-gradient-brand text-primary-foreground shadow-brand hover:opacity-90"
              onClick={() => setInvoiceOpen(true)}
            >
              <Plus className="h-4 w-4" /> {t("common.newInvoice")}
            </Button>
          </>
        }
      />

      <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-brand p-6 text-primary-foreground shadow-brand" data-tour="dashboard">
        <div className="absolute inset-0 gradient-mesh opacity-60 mix-blend-overlay" />
        <div className="relative flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold backdrop-blur">
              <Sparkles className="h-3 w-3" /> {t("dashboard.aiInsights")}
            </div>
            <h2 className="mb-2 max-w-2xl font-display text-2xl font-bold lg:text-3xl">
              <Trans
                i18nKey="dashboard.insightHeadline"
                components={[<span className="underline decoration-white/50 underline-offset-4" />]}
              />
            </h2>
            <p className="max-w-xl text-sm text-white/80">{t("dashboard.insightBody")}</p>
          </div>
          <div className="flex gap-2">
            <Button
              className="border-0 bg-white text-primary hover:bg-white/90"
              onClick={() => void handleSendReminders()}
              disabled={sendingReminders}
            >
              {t("common.sendReminders")}
            </Button>
            <Button variant="ghost" className="text-white hover:bg-white/15" onClick={() => nav("/reports")}>
              {t("common.viewReport")} <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label={t("dashboard.kpi.revenue")} value={fmtTHB(dashboardSummary.revenue)} icon={<TrendingUp className="h-4 w-4" />} hint={`${dashboardSummary.openInvoices} open invoices`} accent="primary" />
        <KpiCard label={t("dashboard.kpi.expenses")} value={fmtTHB(dashboardSummary.expenses)} icon={<Wallet className="h-4 w-4" />} hint={`${dashboardSummary.pendingExpenses} expenses pending`} accent="warning" />
        <KpiCard label={t("dashboard.kpi.netProfit")} value={fmtTHB(dashboardSummary.netProfit)} icon={<Banknote className="h-4 w-4" />} hint={`VAT due ${fmtTHB(dashboardSummary.vatPayable)}`} accent="success" />
        <KpiCard label={t("dashboard.kpi.receivables")} value={fmtTHB(dashboardSummary.receivables)} icon={<ArrowUpRight className="h-4 w-4" />} hint={t("dashboard.kpi.hintInv", { n: dashboardSummary.openInvoices })} accent="info" />
        <KpiCard label={t("dashboard.kpi.payables")} value={fmtTHB(dashboardSummary.payables)} icon={<ArrowDownRight className="h-4 w-4" />} hint={t("dashboard.kpi.hintBills", { n: dashboardSummary.pendingExpenses })} accent="destructive" />
        <KpiCard label={t("dashboard.kpi.cash")} value={fmtTHB(dashboardSummary.cash)} icon={<Banknote className="h-4 w-4" />} hint={`${dashboardSummary.overdueInvoices} overdue invoice(s)`} accent="primary" />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="card-premium p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display font-semibold">{t("dashboard.cashFlow")}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{t("dashboard.cashFlowSub")}</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" /> {t("dashboard.cashIn")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-warning" /> {t("dashboard.cashOut")}
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={cashFlow} margin={{ left: -10, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--warning))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(var(--warning))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 12,
                  fontSize: 12,
                }}
                formatter={(value: number) => fmtTHB(value)}
              />
              <Area type="monotone" dataKey="in" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#gIn)" />
              <Area type="monotone" dataKey="out" stroke="hsl(var(--warning))" strokeWidth={2.5} fill="url(#gOut)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="card-premium p-6">
          <div className="mb-4">
            <h3 className="font-display font-semibold">{t("dashboard.topCustomers")}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("dashboard.topCustomersSub")}</p>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topCustomersChart} layout="vertical" margin={{ left: 0, right: 16 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={110}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 12,
                  fontSize: 12,
                }}
                formatter={(value: number) => fmtTHB(value)}
              />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="card-premium p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-display font-semibold">
              <Activity className="h-4 w-4 text-primary" /> {t("dashboard.recentActivity")}
            </h3>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => nav("/alerts")}>
              {t("common.viewAll")} <ChevronRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
          <div className="space-y-1">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center gap-3 border-b border-border/40 py-2.5 last:border-0">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-secondary text-xs font-semibold text-foreground">
                    {activity.who
                      .split(" ")
                      .map((segment) => segment[0])
                      .slice(0, 2)
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-semibold">{activity.who}</span>{" "}
                    <span className="text-muted-foreground">{activity.what}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{activity.time}</p>
                </div>
                {activity.amount ? (
                  <span className="text-sm font-semibold tabular-nums text-success">
                    {fmtTHB(activity.amount)}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="card-premium border-warning/20 bg-gradient-to-br from-warning/5 to-card p-6">
            <h3 className="mb-3 flex items-center gap-2 font-display font-semibold">
              <AlertTriangle className="h-4 w-4 text-warning" /> {t("dashboard.alerts")}
            </h3>
            <div className="space-y-2.5">
              {alertCards.map((alert) => (
                <button
                  key={alert.title}
                  className="w-full rounded-xl border border-border/60 bg-card p-3 text-left transition hover:border-warning/40"
                  onClick={() => nav(alert.to)}
                >
                  <p className="text-sm font-semibold">{alert.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{alert.subtitle}</p>
                </button>
              ))}
            </div>
          </Card>

          <Card className="card-premium p-6">
            <h3 className="mb-3 font-display font-semibold">{t("dashboard.quickActions")}</h3>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    onClick={action.action}
                    className="group flex flex-col items-center gap-1.5 rounded-xl border border-border/60 p-3 transition hover:border-primary/40 hover:bg-primary/5"
                  >
                    <Icon className="h-5 w-5 text-primary transition-transform group-hover:scale-110" />
                    <span className="text-xs font-semibold">{action.label}</span>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="card-premium p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display font-semibold">{t("dashboard.pendingDocs")}</h3>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => nav("/sales/invoices")}>
              {t("dashboard.allInvoices")} <ChevronRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-2 py-2 text-left font-semibold">{t("dashboard.table.document")}</th>
                  <th className="px-2 py-2 text-left font-semibold">{t("dashboard.table.customer")}</th>
                  <th className="px-2 py-2 text-left font-semibold">{t("dashboard.table.due")}</th>
                  <th className="px-2 py-2 text-right font-semibold">{t("dashboard.table.amount")}</th>
                  <th className="px-2 py-2 text-left font-semibold">{t("dashboard.table.status")}</th>
                </tr>
              </thead>
              <tbody>
                {invoices.slice(0, 5).map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="cursor-pointer border-t border-border/40 hover:bg-secondary/40"
                    onClick={() => nav(`/sales/invoices/${invoice.id}`)}
                  >
                    <td className="px-2 py-3 font-mono text-xs font-semibold">{invoice.id}</td>
                    <td className="px-2 py-3">{invoice.customer}</td>
                    <td className="px-2 py-3 text-xs text-muted-foreground">{invoice.due}</td>
                    <td className="px-2 py-3 text-right font-semibold tabular-nums">{fmtTHB(invoice.amount)}</td>
                    <td className="px-2 py-3">
                      <StatusBadge status={invoice.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="card-premium flex items-center gap-4 border-primary/20 bg-gradient-brand-soft p-6">
          <Mascot size="sm" />
          <div>
            <h4 className="font-display text-sm font-semibold">{t("dashboard.needHand")}</h4>
            <p className="mb-3 mt-1 text-xs text-muted-foreground">{t("dashboard.needHandBody")}</p>
            <Button
              size="sm"
              className="border-0 bg-gradient-brand text-primary-foreground shadow-brand hover:opacity-90"
              onClick={openAssistant}
            >
              {t("common.openAssistant")}
            </Button>
          </div>
        </Card>
      </div>

      <IncomeDocumentModal kind="invoice" open={invoiceOpen} onOpenChange={setInvoiceOpen} />
      <IncomeDocumentModal kind="receipt" open={receiptOpen} onOpenChange={setReceiptOpen} />
    </AppShell>
  );
};

export default Dashboard;

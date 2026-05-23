import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Trans, useTranslation } from "react-i18next";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BrandMark } from "@/components/brand/BrandMark";
import { Mascot } from "@/components/brand/Mascot";
import { KpiCard } from "@/components/ui-kit/KpiCard";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import {
  ArrowRight, Sparkles, Receipt, Wallet, Users, BarChart3,
  ShieldCheck, Clock, Zap, CheckCircle2, Star, FileText,
  Banknote, Landmark, Package, Quote, TrendingUp,
} from "lucide-react";
import { fmtTHB } from "@/lib/demo-data";
import { useAppData } from "@/lib/app-data";

const Landing = () => {
  const { t } = useTranslation();
  const { data } = useAppData();
  const { invoices } = data;
  const features = [
    { icon: Clock, title: t("landing.feature.timeT"), desc: t("landing.feature.timeD") },
    { icon: ShieldCheck, title: t("landing.feature.taxT"), desc: t("landing.feature.taxD") },
    { icon: Zap, title: t("landing.feature.payT"), desc: t("landing.feature.payD") },
    { icon: BarChart3, title: t("landing.feature.visT"), desc: t("landing.feature.visD") },
    { icon: Users, title: t("landing.feature.teamT"), desc: t("landing.feature.teamD") },
    { icon: Sparkles, title: t("landing.feature.aiT"), desc: t("landing.feature.aiD") },
  ];
  const modules = [
    { icon: Receipt, t: t("landing.mod.sales.t"), d: t("landing.mod.sales.d") },
    { icon: Wallet, t: t("landing.mod.purchases.t"), d: t("landing.mod.purchases.d") },
    { icon: Users, t: t("landing.mod.contacts.t"), d: t("landing.mod.contacts.d") },
    { icon: Package, t: t("landing.mod.products.t"), d: t("landing.mod.products.d") },
    { icon: Landmark, t: t("landing.mod.finance.t"), d: t("landing.mod.finance.d") },
    { icon: BarChart3, t: t("landing.mod.reports.t"), d: t("landing.mod.reports.d") },
  ];
  const salesBullets = t("landing.salesBullets", { returnObjects: true }) as string[];

  return (
    <PublicLayout>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-mesh opacity-70" />
        <div className="relative max-w-7xl mx-auto px-4 lg:px-8 pt-20 pb-24 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary mb-5"
            >
              <Sparkles className="h-3 w-3" /> {t("landing.badge")}
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.05 } }}
              className="text-4xl lg:text-6xl font-display font-extrabold tracking-tight text-balance leading-[1.05]"
            >
              <Trans i18nKey="landing.headline" components={[<span className="gradient-brand-text" />]} />
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }}
              className="mt-5 text-lg text-muted-foreground leading-relaxed max-w-xl"
            >
              {t("landing.sub")}
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.15 } }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Link to="/auth/register">
                <Button size="lg" className="h-12 px-6 bg-gradient-brand text-primary-foreground border-0 shadow-brand hover:opacity-95 gap-2 font-semibold">
                  {t("common.startFreeTrial")} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button size="lg" variant="outline" className="h-12 px-6 font-semibold">{t("landing.seePricing")}</Button>
              </Link>
            </motion.div>
            <div className="mt-6 flex items-center gap-5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /> {t("landing.trial14")}</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /> {t("landing.noCard")}</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /> {t("landing.setup5")}</span>
            </div>
          </div>

          {/* Right: dashboard preview mock */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1, transition: { delay: 0.2 } }}
            className="relative"
          >
            <div className="absolute -inset-6 bg-gradient-brand opacity-20 blur-3xl rounded-full" />
            <div className="relative rounded-3xl border border-border bg-card shadow-premium overflow-hidden">
              <div className="bg-secondary/60 px-4 py-3 flex items-center gap-2 border-b border-border">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
                </div>
                <span className="text-xs text-muted-foreground ml-2 font-mono">app.matteracc.co.th/dashboard</span>
              </div>
              <div className="p-5 space-y-4 bg-gradient-card">
                <div className="flex items-center justify-between">
                  <BrandMark size="sm" />
                  <span className="text-xs text-muted-foreground">Apr 2026</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <KpiCard label={t("dashboard.kpi.revenue")} value="฿1.68M" delta={{ value: "+12.8%", positive: true }} accent="primary" />
                  <KpiCard label={t("dashboard.kpi.netProfit")} value="฿732K" delta={{ value: "+18.4%", positive: true }} accent="success" />
                  <KpiCard label={t("dashboard.kpi.receivables")} value="฿246K" hint={t("dashboard.kpi.hintInv", { n: 14 })} accent="info" />
                </div>
                <div className="rounded-xl border border-border bg-card p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">{t("dashboard.pendingDocs")}</p>
                  <div className="space-y-1.5">
                    {invoices.slice(0, 3).map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between py-1.5 text-xs">
                        <span className="font-mono font-semibold text-primary">{inv.id}</span>
                        <span className="flex-1 truncate mx-3 text-muted-foreground">{inv.customer}</span>
                        <span className="font-semibold tabular-nums mr-2">{fmtTHB(inv.amount)}</span>
                        <StatusBadge status={inv.status} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="border-y border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
          <p className="text-xs uppercase tracking-widest text-muted-foreground text-center mb-5">
            {t("landing.trustedBy")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 opacity-60 grayscale">
            {["SIAM TECH", "BANGKOK FOODS", "PHUKET RESORT", "CM CRAFTS", "NORTHERN LOG.", "PATTAYA HOTELS"].map((n) => (
              <span key={n} className="text-sm font-display font-bold tracking-wider">{n}</span>
            ))}
          </div>
        </div>
      </section>

      {/* WHY */}
      <section id="features" className="max-w-7xl mx-auto px-4 lg:px-8 py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">{t("landing.why")}</p>
          <h2 className="text-3xl lg:text-4xl font-display font-bold tracking-tight text-balance">
            {t("landing.whyTitle")}
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            {t("landing.whyBody")}
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <Card key={i} className="card-premium p-6 hover:shadow-premium transition-all hover:-translate-y-1">
                <div className="h-11 w-11 rounded-xl bg-gradient-brand text-primary-foreground flex items-center justify-center shadow-brand mb-4">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-display font-bold text-lg mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </Card>
            );
          })}
        </div>
      </section>

      {/* MODULES */}
      <section className="bg-gradient-brand-soft border-y border-border">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-20">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">{t("landing.modulesEyebrow")}</p>
            <h2 className="text-3xl lg:text-4xl font-display font-bold tracking-tight">
              {t("landing.modulesTitle")}
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map((m, i) => {
              const Icon = m.icon;
              return (
                <div key={i} className="bg-card rounded-2xl border border-border p-5 flex items-start gap-4 hover:border-primary/30 transition">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold">{m.t}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{m.d}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SHOWCASE: Sales/Invoicing */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-20 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">{t("landing.salesEyebrow")}</p>
          <h2 className="text-3xl lg:text-4xl font-display font-bold tracking-tight mb-4">
            {t("landing.salesTitle")}
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed mb-6">
            {t("landing.salesBody")}
          </p>
          <ul className="space-y-3">
            {salesBullets.map((b) => (
              <li key={b} className="flex items-start gap-3"><CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" /><span className="text-sm font-medium">{b}</span></li>
            ))}
          </ul>
        </div>
        <Card className="card-premium p-6 bg-gradient-card">
          <div className="flex items-center justify-between mb-4">
            <BrandMark size="sm" />
            <StatusBadge status="paid" />
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("nav.invoices")}</p>
          <p className="font-mono font-bold text-lg">INV-2026-0142</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div><p className="text-muted-foreground">{t("modal.receipt.relatedInvoice")}</p><p className="font-semibold">Bangkok Foods Co., Ltd.</p></div>
            <div><p className="text-muted-foreground">{t("modal.invoice.dueDate")}</p><p className="font-semibold">26 Apr 2026</p></div>
          </div>
          <div className="mt-4 pt-4 border-t border-border space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">{t("modal.quotation.subtotal")}</span><span className="tabular-nums">฿133,458.88</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("modal.quotation.vat")} 7%</span><span className="tabular-nums">฿9,341.12</span></div>
            <div className="flex justify-between font-bold pt-2 border-t border-border text-lg"><span>{t("modal.quotation.grandTotal")}</span><span className="gradient-brand-text">฿142,800.00</span></div>
          </div>
        </Card>
      </section>

      {/* SHOWCASE: Reports */}
      <section className="bg-secondary/30 border-y border-border">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-20 grid lg:grid-cols-2 gap-12 items-center">
          <Card className="card-premium p-6 lg:order-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold">{t("dashboard.cashFlow")} · 6</h3>
              <span className="flex items-center gap-1 text-xs font-semibold text-success"><TrendingUp className="h-3 w-3" /> +24%</span>
            </div>
            <div className="grid grid-cols-6 gap-2 h-40 items-end">
              {[60, 80, 70, 95, 105, 120].map((h, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <div className="w-full rounded-t-md bg-gradient-brand" style={{ height: `${h}%` }} />
                  <span className="text-[10px] text-muted-foreground">{["N", "D", "J", "F", "M", "A"][i]}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-3 text-center">
              <div><p className="text-xs text-muted-foreground">{t("dashboard.kpi.revenue").replace(/\s*\(.*\)/, "")}</p><p className="font-bold tabular-nums">฿1.68M</p></div>
              <div><p className="text-xs text-muted-foreground">{t("dashboard.kpi.expenses").replace(/\s*\(.*\)/, "")}</p><p className="font-bold tabular-nums">฿952K</p></div>
              <div><p className="text-xs text-muted-foreground">{t("dashboard.kpi.netProfit")}</p><p className="font-bold tabular-nums text-success">฿732K</p></div>
            </div>
          </Card>
          <div className="lg:order-1">
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">{t("landing.reportsEyebrow")}</p>
            <h2 className="text-3xl lg:text-4xl font-display font-bold tracking-tight mb-4">
              {t("landing.reportsTitle")}
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed mb-6">
              {t("landing.reportsBody")}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: FileText, label: "P&L" },
                { icon: Banknote, label: t("dashboard.cashFlow") },
                { icon: BarChart3, label: t("nav.statements") },
                { icon: Receipt, label: "VAT P.P.30" },
              ].map((r) => {
                const Icon = r.icon;
                return (
                  <div key={r.label} className="flex items-center gap-2.5 p-3 bg-card rounded-xl border border-border">
                    <Icon className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">{r.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">{t("landing.testimonialsEyebrow")}</p>
          <h2 className="text-3xl lg:text-4xl font-display font-bold tracking-tight">{t("landing.testimonialsTitle")}</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { q: "We closed our books 4 days faster every month. Our accountant actually thanked us.", n: "Khun Anchalee", r: "CFO · Bangkok Foods", c: "BF" },
            { q: "QR PromptPay on invoices alone paid for the subscription in week one. No exaggeration.", n: "Khun Pichai", r: "Founder · Siam Digital", c: "PD" },
            { q: "Finally an accounting tool that doesn't feel like punishment to open every morning.", n: "Khun Mali", r: "Owner · CM Crafts", c: "MC" },
          ].map((tm, i) => (
            <Card key={i} className="card-premium p-6 relative">
              <Quote className="absolute top-4 right-4 h-8 w-8 text-primary/15" />
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: 5 }).map((_, j) => <Star key={j} className="h-4 w-4 fill-warning text-warning" />)}
              </div>
              <p className="text-sm leading-relaxed mb-5 text-foreground">"{tm.q}"</p>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-brand text-primary-foreground flex items-center justify-center text-xs font-bold shadow-brand">{tm.c}</div>
                <div>
                  <p className="font-semibold text-sm">{tm.n}</p>
                  <p className="text-xs text-muted-foreground">{tm.r}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-brand p-10 lg:p-14 text-primary-foreground shadow-brand">
          <div className="absolute inset-0 gradient-mesh opacity-50 mix-blend-overlay" />
          <div className="relative grid lg:grid-cols-[1fr_auto] items-center gap-8">
            <div>
              <Mascot size="md" className="mb-4" />
              <h2 className="text-3xl lg:text-4xl font-display font-bold tracking-tight mb-3 text-balance">
                {t("landing.ctaTitle")}
              </h2>
              <p className="text-white/85 text-lg max-w-xl leading-relaxed">
                {t("landing.ctaBody")}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/auth/register">
                <Button size="lg" className="h-12 px-6 bg-white text-primary hover:bg-white/95 font-semibold gap-2 w-full sm:w-auto">
                  {t("common.tryFree")} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/contact">
                <Button size="lg" variant="ghost" className="h-12 px-6 text-white hover:bg-white/15 font-semibold w-full sm:w-auto">
                  {t("common.talkToSales")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};

export default Landing;

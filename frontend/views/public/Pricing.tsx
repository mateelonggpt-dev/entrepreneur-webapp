import { useState } from "react";
import { Link } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, X, ArrowRight, Sparkles, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Cycle = "monthly" | "yearly";

const Pricing = () => {
  const { t } = useTranslation();
  const [cycle, setCycle] = useState<Cycle>("yearly");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const PLANS = [
    {
      id: "starter",
      name: t("pricing.plans.starterName"),
      desc: t("pricing.plans.starterDesc"),
      monthly: 290, yearly: 232,
      cta: t("common.startFreeTrial"),
      features: [
        t("pricing.feat.s1", "Up to 30 invoices / month"),
        t("pricing.feat.s2", "Unlimited customers"),
        t("pricing.feat.s3", "VAT P.P.30 reports"),
        t("pricing.feat.s4", "QR PromptPay"),
        t("pricing.feat.s5", "Email support"),
        t("pricing.feat.s6", "1 user"),
      ],
      highlighted: false,
    },
    {
      id: "growth",
      name: t("pricing.plans.growthName"),
      desc: t("pricing.plans.growthDesc"),
      monthly: 790, yearly: 632,
      cta: t("common.startFreeTrial"),
      features: [
        t("pricing.feat.g1", "Unlimited invoices & expenses"),
        t("pricing.feat.g2", "Withholding Tax (P.N.D.3/53)"),
        t("pricing.feat.g3", "Bank reconciliation"),
        t("pricing.feat.g4", "Inventory & stock movements"),
        t("pricing.feat.g5", "Recurring invoices & reminders"),
        t("pricing.feat.g6", "Up to 5 users"),
        t("pricing.feat.g7", "Priority email + chat support"),
      ],
      highlighted: true,
      badge: t("pricing.mostPopular"),
    },
    {
      id: "pro",
      name: t("pricing.plans.proName"),
      desc: t("pricing.plans.proDesc"),
      monthly: 1990, yearly: 1592,
      cta: t("common.startFreeTrial"),
      features: [
        t("pricing.feat.p1", "Everything in Growth"),
        t("pricing.feat.p2", "Multi-company (up to 5)"),
        t("pricing.feat.p3", "Advanced roles & approvals"),
        t("pricing.feat.p4", "Custom report builder"),
        t("pricing.feat.p5", "API & webhooks"),
        t("pricing.feat.p6", "Audit trail & SOC 2 export"),
        t("pricing.feat.p7", "Unlimited users"),
        t("pricing.feat.p8", "Dedicated success manager"),
      ],
      highlighted: false,
    },
  ];

  const COMPARE = [
    { f: t("pricing.cmp.invMo", "Invoices / month"), s: "30", g: t("pricing.unlimited", "Unlimited"), p: t("pricing.unlimited", "Unlimited") },
    { f: t("pricing.cmp.users", "Users"), s: "1", g: "5", p: t("pricing.unlimited", "Unlimited") },
    { f: "VAT P.P.30", s: true, g: true, p: true },
    { f: t("nav.wht"), s: false, g: true, p: true },
    { f: t("pricing.cmp.bank", "Bank reconciliation"), s: false, g: true, p: true },
    { f: t("nav.inventory"), s: false, g: true, p: true },
    { f: t("pricing.cmp.multi", "Multi-company"), s: false, g: false, p: t("pricing.cmp.upTo5", "Up to 5") },
  ];

  const FAQ = [
    { q: t("pricing.faq.q1", "Is there really a free trial?"), a: t("pricing.faq.a1", "Yes — 14 days, full access, no credit card. We'll remind you 3 days before it ends.") },
    { q: t("pricing.faq.q2", "Can I switch or cancel any time?"), a: t("pricing.faq.a2", "Anytime. Upgrade, downgrade, or cancel from Settings → Billing.") },
    { q: t("pricing.faq.q3", "Is Matter Acc. compliant with Thai tax law?"), a: t("pricing.faq.a3", "Yes — VAT (P.P.30), Withholding Tax (P.N.D.3/53), e-Tax invoice and tax-id validation are all built in.") },
    { q: t("pricing.faq.q4", "Where is my data stored?"), a: t("pricing.faq.a4", "All data is stored in Singapore on SOC 2 / ISO 27001 certified infrastructure.") },
  ];

  return (
    <PublicLayout>
      <section className="max-w-7xl mx-auto px-4 lg:px-8 pt-16 pb-10 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">{t("pricing.eyebrow")}</p>
        <h1 className="text-4xl lg:text-5xl font-display font-extrabold tracking-tight text-balance">
          <Trans i18nKey="pricing.title" components={[<span className="gradient-brand-text" />]} />
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">{t("pricing.sub")}</p>

        <div className="mt-8 inline-flex items-center gap-1 p-1 rounded-full bg-secondary border border-border">
          {(["monthly", "yearly"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              className={cn(
                "h-9 px-5 rounded-full text-sm font-semibold transition",
                cycle === c ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {c === "monthly" ? t("pricing.monthly") : t("pricing.yearly")}
              {c === "yearly" && (
                <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-success/10 text-success">{t("pricing.save20")}</span>
              )}
            </button>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 lg:px-8 pb-16">
        <div className="grid md:grid-cols-3 gap-5">
          {PLANS.map((p) => (
            <Card
              key={p.id}
              className={cn(
                "relative p-7 transition-all",
                p.highlighted
                  ? "card-premium ring-2 ring-primary shadow-premium scale-[1.02] bg-gradient-to-b from-primary/5 to-card"
                  : "card-premium hover:shadow-premium"
              )}
            >
              {p.highlighted && p.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-brand text-primary-foreground text-xs font-bold shadow-brand flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> {p.badge}
                </div>
              )}
              <h3 className="font-display font-bold text-xl">{p.name}</h3>
              <p className="text-sm text-muted-foreground mt-1 min-h-[40px]">{p.desc}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-display font-extrabold tabular-nums">฿{(cycle === "monthly" ? p.monthly : p.yearly).toLocaleString()}</span>
                <span className="text-muted-foreground text-sm">{t("pricing.perUserMo")}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {cycle === "yearly" ? t("pricing.billedYearly") : t("pricing.billedMonthly")}
              </p>
              <Link to="/auth/register" className="block mt-6">
                <Button
                  className={cn(
                    "w-full h-11 font-semibold",
                    p.highlighted ? "bg-gradient-brand text-primary-foreground border-0 shadow-brand hover:opacity-95" : ""
                  )}
                  variant={p.highlighted ? "default" : "outline"}
                >
                  {p.cta} <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
              <ul className="mt-6 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-16">
        <h2 className="text-2xl lg:text-3xl font-display font-bold text-center mb-10">{t("pricing.compare")}</h2>
        <Card className="card-premium overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60">
                <tr>
                  <th className="text-left px-5 py-4 font-semibold">{t("pricing.feature")}</th>
                  <th className="text-center px-5 py-4 font-display font-bold">{t("pricing.plans.starterName")}</th>
                  <th className="text-center px-5 py-4 font-display font-bold text-primary">{t("pricing.plans.growthName")}</th>
                  <th className="text-center px-5 py-4 font-display font-bold">{t("pricing.plans.proName")}</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row, i) => (
                  <tr key={i} className="border-t border-border/50">
                    <td className="px-5 py-3.5 font-medium">{row.f}</td>
                    {[row.s, row.g, row.p].map((v, j) => (
                      <td key={j} className={cn("px-5 py-3.5 text-center", j === 1 && "bg-primary/5")}>
                        {typeof v === "boolean" ? (
                          v ? <CheckCircle2 className="h-4 w-4 text-success inline" /> : <X className="h-4 w-4 text-muted-foreground/40 inline" />
                        ) : (
                          <span className="text-sm font-medium">{v}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section className="max-w-3xl mx-auto px-4 lg:px-8 py-16">
        <h2 className="text-2xl lg:text-3xl font-display font-bold text-center mb-10">{t("pricing.faq")}</h2>
        <div className="space-y-3">
          {FAQ.map((f, i) => (
            <Card key={i} className="card-premium overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full px-5 py-4 flex items-center justify-between text-left"
              >
                <span className="font-semibold">{f.q}</span>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", openFaq === i && "rotate-180")} />
              </button>
              {openFaq === i && (
                <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed border-t border-border pt-4">
                  {f.a}
                </div>
              )}
            </Card>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 lg:px-8 pb-20 text-center">
        <Card className="card-premium p-10 bg-gradient-brand-soft border-primary/20">
          <h3 className="text-2xl font-display font-bold mb-2">{t("pricing.stillDeciding")}</h3>
          <p className="text-muted-foreground mb-6">{t("pricing.stillDecidingBody")}</p>
          <div className="flex justify-center gap-3 flex-wrap">
            <Link to="/auth/register">
              <Button size="lg" className="bg-gradient-brand text-primary-foreground border-0 shadow-brand gap-2 font-semibold">
                {t("common.startFreeTrial")} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/contact"><Button size="lg" variant="outline" className="font-semibold">{t("common.talkToSales")}</Button></Link>
          </div>
        </Card>
      </section>
    </PublicLayout>
  );
};

export default Pricing;

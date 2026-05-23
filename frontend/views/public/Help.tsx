import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Rocket,
  Receipt,
  Wallet,
  Users,
  BarChart3,
  Settings,
  Banknote,
  ArrowRight,
  MessageCircle,
  Mail,
  Phone,
  BookOpen,
} from "lucide-react";
import { Mascot } from "@/components/brand/Mascot";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const categories = [
  { key: "getting_started", icon: Rocket, title: "Getting started", desc: "Set up your company, taxes, and first invoice.", count: 12 },
  { key: "sales", icon: Receipt, title: "Sales & invoicing", desc: "Quotations, invoices, receipts, payment links.", count: 28 },
  { key: "purchases", icon: Wallet, title: "Purchases & expenses", desc: "Bills, expense capture, vendor payments, WHT.", count: 19 },
  { key: "contacts", icon: Users, title: "Contacts", desc: "Customers, vendors, statements, and aging.", count: 9 },
  { key: "banks", icon: Banknote, title: "Banks & reconciliation", desc: "Connect banks, reconcile, manage cash.", count: 14 },
  { key: "reports", icon: BarChart3, title: "Reports & accounting", desc: "P&L, balance sheet, VAT, custom reports.", count: 21 },
  { key: "settings", icon: Settings, title: "Settings & admin", desc: "Company profile, users, document branding, and currency.", count: 16 },
  { key: "tax", icon: BookOpen, title: "Thai tax compliance", desc: "P.P.30, P.N.D.3/53, and e-Tax invoice guides.", count: 11 },
] as const;

const articles = [
  {
    id: "first-invoice",
    category: "sales",
    title: "How do I send my first invoice?",
    body:
      "Open Sales > Invoices, create the document, review VAT and payment terms, then use Send or PDF export. If you want faster setup, use the invoice modal from dashboard quick actions.",
  },
  {
    id: "vat-wht",
    category: "tax",
    title: "Setting up VAT and Withholding Tax",
    body:
      "Use the Tax module to review VAT and withholding workflows. WHT documents can be created from vendor payments and exported from the purchases WHT page.",
  },
  {
    id: "bank-reconcile",
    category: "banks",
    title: "Connecting Bangkok Bank for auto-reconciliation",
    body:
      "Manage financial channels from Payment > Banking. Bank import automation remains staged, but movement tracking is available now.",
  },
  {
    id: "pp30",
    category: "tax",
    title: "How to export P.P.30 for monthly filing",
    body:
      "Use Reports or Purchases > WHT to download tax-ready shell exports. VAT summary and filing shells now share the central tax overview and filing store.",
  },
  {
    id: "invite-accountant",
    category: "settings",
    title: "Inviting your accountant as a user",
    body:
      "Go to Settings > Users, add a teammate through the existing invite modal, and assign the Accountant role. The role shell keeps permission notes visible without inventing enterprise RBAC.",
  },
  {
    id: "etax",
    category: "tax",
    title: "Issuing an e-Tax invoice",
    body:
      "Use the Tax > e-Tax area for e-Tax delivery workflows when enabled. Document delivery and future e-tax expansion can reuse backend connector configuration.",
  },
];

const popularTopics = ["P.P.30", "QR PromptPay", "Inventory", "WHT certificate"];

const Help = () => {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [selectedArticleId, setSelectedArticleId] = useState<string>(articles[0].id);

  const filteredArticles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles.filter((article) => {
      const matchesCategory = activeCategory === "all" || article.category === activeCategory;
      const matchesQuery =
        !q ||
        article.title.toLowerCase().includes(q) ||
        article.body.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, query]);

  const selectedArticle =
    filteredArticles.find((article) => article.id === selectedArticleId) ??
    filteredArticles[0] ??
    null;

  return (
    <PublicLayout>
      <section className="relative overflow-hidden border-b border-border bg-gradient-brand-soft">
        <div className="absolute inset-0 gradient-mesh opacity-60" />
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center lg:px-8">
          <Mascot size="md" className="mx-auto mb-4" />
          <h1 className="text-4xl font-display font-extrabold tracking-tight lg:text-5xl">
            How can we help?
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Search the help center or browse by category.
          </p>

          <div className="relative mx-auto mt-7 max-w-xl">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search articles, guides, or error codes..."
              className="h-14 rounded-2xl border-border bg-card pl-12 pr-4 text-base shadow-md"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
            <span className="text-muted-foreground">Popular:</span>
            {popularTopics.map((topic) => (
              <button
                key={topic}
                className="rounded-full border border-border bg-card px-2.5 py-0.5 text-muted-foreground hover:border-primary/30 hover:text-primary"
                onClick={() => setQuery(topic)}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
        <h2 className="mb-2 text-2xl font-display font-bold">Browse by category</h2>
        <p className="mb-8 text-muted-foreground">Find guides, walkthroughs, and best practices.</p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => {
            const Icon = category.icon;
            const active = activeCategory === category.key;
            return (
              <button
                key={category.key}
                className="text-left"
                onClick={() => {
                  setActiveCategory(category.key);
                  const match = articles.find((article) => article.category === category.key);
                  if (match) {
                    setSelectedArticleId(match.id);
                  }
                }}
              >
                <Card
                  className={`card-premium group p-5 transition-all hover:-translate-y-1 hover:shadow-premium ${
                    active ? "border-primary/30 bg-primary/5" : ""
                  }`}
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand text-primary-foreground shadow-brand">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-1 font-display font-bold">{category.title}</h3>
                  <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{category.desc}</p>
                  <p className="flex items-center gap-1 text-xs font-semibold text-primary">
                    {category.count} articles{" "}
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                  </p>
                </Card>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-4 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <Card className="card-premium p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Most read articles</h2>
            <Button variant="ghost" size="sm" onClick={() => setActiveCategory("all")}>
              View all
            </Button>
          </div>
          <div className="divide-y divide-border">
            {filteredArticles.map((article, index) => (
              <button
                key={article.id}
                className="group flex w-full items-center justify-between py-3.5 text-left hover:text-primary"
                onClick={() => setSelectedArticleId(article.id)}
              >
                <span className="flex items-center gap-3 text-sm font-medium">
                  <span className="w-6 text-xs font-mono text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {article.title}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-primary" />
              </button>
            ))}
            {filteredArticles.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">No articles match this search yet.</p>
            ) : null}
          </div>
        </Card>

        <Card className="card-premium p-6">
          {selectedArticle ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                {categories.find((category) => category.key === selectedArticle.category)?.title || "Guide"}
              </p>
              <h2 className="mt-3 text-2xl font-display font-bold">{selectedArticle.title}</h2>
              <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {selectedArticle.body}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/contact">
                  <Button className="border-0 bg-gradient-brand text-primary-foreground shadow-brand">
                    Contact support
                  </Button>
                </Link>
                <Link to="/landing#features">
                  <Button variant="outline">Explore features</Button>
                </Link>
              </div>
            </>
          ) : (
            <div className="py-10 text-sm text-muted-foreground">Choose an article to read.</div>
          )}
        </Card>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: MessageCircle, title: "Live chat", desc: "Mon-Fri · 9:00-18:00 ICT", cta: "Start chat" },
            { icon: Mail, title: "Email support", desc: "support@matteracc.co.th · 24h reply", cta: "Send email" },
            { icon: Phone, title: "Phone (Pro plan)", desc: "+66 2 123 4567 · priority queue", cta: "Call us" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} className="card-premium p-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="font-display font-bold">{item.title}</h3>
                <p className="mb-4 mt-1 text-xs text-muted-foreground">{item.desc}</p>
                <Link to="/contact">
                  <Button variant="outline" size="sm" className="w-full font-semibold">
                    {item.cta}
                  </Button>
                </Link>
              </Card>
            );
          })}
        </div>
      </section>
    </PublicLayout>
  );
};

export default Help;

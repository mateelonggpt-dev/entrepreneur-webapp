import { Link } from "react-router-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const ApiDocs = () => (
  <PublicLayout>
    <section className="mx-auto max-w-5xl px-4 py-16 lg:px-8">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Developers</p>
      <h1 className="mt-3 text-4xl font-display font-extrabold tracking-tight">API Connector Shell</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
        This workspace includes a lightweight API connector shell for imports, e-tax delivery setup,
        and future marketplace synchronization. It is intentionally scoped for safe configuration in
        this local product build.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          {
            title: "Authentication",
            body: "Use server-side connector configuration for base URL and key labels when API integrations are enabled.",
          },
          {
            title: "Import Flows",
            body: "Marketplace and POS cards link into the shared import review flow for contacts, products, and sales documents.",
          },
          {
            title: "Future Webhooks",
            body: "Webhook and sync controls are modeled as configuration shells so backend integrations can be added later without redesigning settings.",
          },
        ].map((item) => (
          <Card key={item.title} className="card-premium p-6">
            <h2 className="font-display text-lg font-semibold">{item.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
          </Card>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/import">
          <Button className="border-0 bg-gradient-brand text-primary-foreground shadow-brand">Go to import center</Button>
        </Link>
      </div>
    </section>
  </PublicLayout>
);

export default ApiDocs;

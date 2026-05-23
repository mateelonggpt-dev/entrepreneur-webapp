import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";

const systems = [
  { name: "Frontend workspace", status: "active" as const, note: "Navigation, modals, and exports are available." },
  { name: "Flask API", status: "active" as const, note: "Document creation, settings, and file handlers are responding." },
  { name: "Marketplace sync connectors", status: "pending" as const, note: "Configuration shells are available while external sync remains staged." },
  { name: "Google sign-in", status: "inactive" as const, note: "Explicitly disabled in this build until a supported auth provider is wired." },
];

const StatusPage = () => (
  <PublicLayout>
    <section className="mx-auto max-w-4xl px-4 py-16 lg:px-8">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Status</p>
      <h1 className="mt-3 text-4xl font-display font-extrabold tracking-tight">System Status</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
        Current status for the local Matter Acc. workspace and the main service shells included in this build.
      </p>

      <div className="mt-8 space-y-4">
        {systems.map((system) => (
          <Card key={system.name} className="card-premium flex items-start justify-between gap-4 p-5">
            <div>
              <h2 className="font-display text-lg font-semibold">{system.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{system.note}</p>
            </div>
            <StatusBadge status={system.status} />
          </Card>
        ))}
      </div>
    </section>
  </PublicLayout>
);

export default StatusPage;

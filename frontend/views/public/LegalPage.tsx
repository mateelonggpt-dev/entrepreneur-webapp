import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card } from "@/components/ui/card";

interface Props {
  title: string;
  description: string;
  sections: Array<{ heading: string; body: string }>;
}

const LegalPage = ({ title, description, sections }: Props) => (
  <PublicLayout>
    <section className="mx-auto max-w-4xl px-4 py-16 lg:px-8">
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Legal</p>
        <h1 className="mt-3 text-4xl font-display font-extrabold tracking-tight">{title}</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{description}</p>
      </div>

      <div className="space-y-4">
        {sections.map((section) => (
          <Card key={section.heading} className="card-premium p-6">
            <h2 className="font-display text-lg font-semibold">{section.heading}</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {section.body}
            </p>
          </Card>
        ))}
      </div>
    </section>
  </PublicLayout>
);

export default LegalPage;

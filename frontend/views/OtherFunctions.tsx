import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  BookOpen,
  Boxes,
  BriefcaseBusiness,
  ClipboardList,
  Coins,
  FileBarChart,
  Landmark,
  Percent,
  Upload,
} from "lucide-react";

const otherFunctionLinks = [
  {
    title: "Pending Tasks",
    description: "Review operational tasks and reminders.",
    to: "/tasks",
    icon: ClipboardList,
  },
  {
    title: "Alerts",
    description: "Track overdue, tax, and stock alerts.",
    to: "/alerts",
    icon: AlertTriangle,
  },
  {
    title: "Inventory",
    description: "Manage stock levels and movements.",
    to: "/inventory",
    icon: Boxes,
  },
  {
    title: "Import Data",
    description: "Upload contacts, products, or document batches.",
    to: "/import",
    icon: Upload,
  },
  {
    title: "Bank Accounts",
    description: "Maintain bank and financial accounts.",
    to: "/finance/banks",
    icon: Landmark,
  },
  {
    title: "Cash / Cheques",
    description: "Track cash, cheque, and clearing workflows.",
    to: "/finance/cash",
    icon: Coins,
  },
  {
    title: "Journal Entries",
    description: "Post and review accounting journals.",
    to: "/finance/journal",
    icon: BookOpen,
  },
  {
    title: "Financial Statements",
    description: "Open P&L, balance sheet, and cash flow views.",
    to: "/finance/statements",
    icon: FileBarChart,
  },
  {
    title: "Payroll Foundations",
    description: "Prepare payroll runs and payroll settings.",
    to: "/finance/payroll",
    icon: BriefcaseBusiness,
  },
  {
    title: "Reports",
    description: "Generate management and tax reports.",
    to: "/reports",
    icon: BarChart3,
  },
  {
    title: "Withholding Tax",
    description: "Prepare WHT documents and filing support.",
    to: "/purchases/wht",
    icon: Percent,
  },
  {
    title: "Pricing & Billing Plan",
    description: "Review subscription and plan details.",
    to: "/pricing",
    icon: Banknote,
  },
];

const OtherFunctions = () => {
  const nav = useNavigate();

  return (
    <AppShell>
      <PageHeader
        title="Other Functions"
        description="Finance, import, inventory, reporting, and operational pages that sit outside the main Sale, Purchase, Contact, and Product sections."
        breadcrumbs={[{ label: "Other Functions" }]}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {otherFunctionLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.to} className="card-premium p-5 transition hover:shadow-premium">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-brand text-primary-foreground shadow-brand">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="font-display text-base font-semibold">{item.title}</h2>
              <p className="mt-1 min-h-10 text-sm text-muted-foreground">{item.description}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => nav(item.to)}>
                Open
              </Button>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
};

export default OtherFunctions;

import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import Dashboard from "@/views/Dashboard";
import NotFound from "@/views/NotFound";
import RootRedirect from "@/views/RootRedirect";
import { ModulePage } from "@/views/ModulePage";
import OtherFunctions from "@/views/OtherFunctions";
import SaleCreate from "@/views/sales/SaleCreate";
import SaleDocuments from "@/views/sales/SaleDocuments";
import InvoiceDetail from "@/views/sales/InvoiceDetail";
import PurchaseCreate from "@/views/purchases/PurchaseCreate";
import PurchaseDocuments from "@/views/purchases/PurchaseDocuments";
import RemainingTasks from "@/views/RemainingTasks";
import ExpenseDetail from "@/views/purchases/ExpenseDetail";
import WithholdingTax from "@/views/purchases/WithholdingTax";
import Customers from "@/views/contacts/Customers";
import Vendors from "@/views/contacts/Vendors";
import Products from "@/views/products/Products";
import Inventory from "@/views/inventory/Inventory";
import ImportData from "@/views/import/ImportData";
import Finance from "@/views/finance/Finance";
import CashCheques from "@/views/finance/CashCheques";
import PaymentTransactions from "@/views/payment/PaymentTransactions";
import Journal from "@/views/finance/Journal";
import Statements from "@/views/finance/Statements";
import Payroll from "@/views/finance/Payroll";
import Reports from "@/views/reports/Reports";
import Settings from "@/views/settings/Settings";
import Login from "@/views/auth/Login";
import Register from "@/views/auth/Register";
import ForgotPassword from "@/views/auth/ForgotPassword";
import ResetPassword from "@/views/auth/ResetPassword";
import EmailVerified from "@/views/auth/EmailVerified";
import SessionExpired from "@/views/auth/SessionExpired";
import LogoutConfirm from "@/views/auth/LogoutConfirm";
import Landing from "@/views/public/Landing";
import Pricing from "@/views/public/Pricing";
import Help from "@/views/public/Help";
import Contact from "@/views/public/Contact";
import ApiDocs from "@/views/public/ApiDocs";
import LegalPage from "@/views/public/LegalPage";
import StatusPage from "@/views/public/StatusPage";
import Onboarding from "@/views/onboarding/Onboarding";
import Showcase from "@/views/Showcase";

type RouteParams = Record<string, string | undefined>;

interface ResolvedRoute {
  element: ReactElement;
  params: RouteParams;
}

interface RouteDefinition {
  pattern: string;
  render: (params: RouteParams) => ReactElement;
}

const redirect = (to: string) => <Navigate to={to} replace />;

const splitPath = (path: string) => {
  const normalized = path !== "/" && path.endsWith("/") ? path.slice(0, -1) : path;
  return normalized.split("/").filter(Boolean);
};

const matchPattern = (pattern: string, pathname: string): RouteParams | null => {
  const patternSegments = splitPath(pattern);
  const pathSegments = splitPath(pathname);

  if (patternSegments.length !== pathSegments.length) {
    return null;
  }

  const params: RouteParams = {};

  for (let index = 0; index < patternSegments.length; index += 1) {
    const patternSegment = patternSegments[index];
    const pathSegment = pathSegments[index];

    if (patternSegment.startsWith(":")) {
      params[patternSegment.slice(1)] = decodeURIComponent(pathSegment);
      continue;
    }

    if (patternSegment !== pathSegment) {
      return null;
    }
  }

  return params;
};

const routes: RouteDefinition[] = [
  { pattern: "/", render: () => <RootRedirect /> },
  { pattern: "/landing", render: () => <Landing /> },
  { pattern: "/pricing", render: () => <Pricing /> },
  { pattern: "/help", render: () => <Help /> },
  { pattern: "/contact", render: () => <Contact /> },
  { pattern: "/developers/api", render: () => <ApiDocs /> },
  { pattern: "/status", render: () => <StatusPage /> },
  {
    pattern: "/legal/terms",
    render: () => (
      <LegalPage
        title="Terms of Service"
        description="Usage terms for the local Matter Acc. workspace shell and its demo accounting flows."
        sections={[
          {
            heading: "Workspace scope",
            body:
              "This build is intended for local product validation and internal accounting workflow testing. It provides realistic document, settings, tax, and payroll shells without claiming production hosting guarantees.",
          },
          {
            heading: "User responsibility",
            body:
              "You are responsible for reviewing exported files, tax outputs, and accounting treatment before using them in a live filing or customer-facing process.",
          },
          {
            heading: "Service availability",
            body:
              "Some integrations are configuration shells or marked coming soon. Unsupported actions are either disabled or shown as explicit shells rather than silent no-op controls.",
          },
        ]}
      />
    ),
  },
  {
    pattern: "/legal/privacy",
    render: () => (
      <LegalPage
        title="Privacy Policy"
        description="How this local workspace handles saved records, uploads, and support request shells."
        sections={[
          {
            heading: "Stored data",
            body:
              "Company settings, accounting records, attachments, support messages, tax filing shells, and payroll setup data are stored in the configured local backend storage for this project.",
          },
          {
            heading: "Uploads and exports",
            body:
              "Uploaded evidence, branding assets, and generated exports are stored through the backend storage service in local project storage paths.",
          },
          {
            heading: "Third-party services",
            body:
              "Marketplace, POS, e-tax, and Google sign-in integrations are not fully live in this build unless explicitly marked connected and configured in settings.",
          },
        ]}
      />
    ),
  },
  {
    pattern: "/legal/cookies",
    render: () => (
      <LegalPage
        title="Cookie Policy"
        description="Browser-side storage used by this local workspace shell."
        sections={[
          {
            heading: "Language and UI preferences",
            body:
              "The app stores lightweight browser preferences such as the selected language and other session-level UI settings to keep the experience consistent after refresh. Workspace setup drafts are stored through the backend.",
          },
          {
            heading: "Authentication shell",
            body:
              "The current authentication flow is a local shell. Unsupported providers are explicitly disabled rather than performing silent background requests.",
          },
          {
            heading: "Clearing local state",
            body:
              "Clearing browser storage may reset remembered UI preferences for this workspace, but accounting records and onboarding setup drafts are kept in backend storage.",
          },
        ]}
      />
    ),
  },
  { pattern: "/onboarding", render: () => <Onboarding /> },
  { pattern: "/app", render: () => <Dashboard /> },
  { pattern: "/dashboard", render: () => <Dashboard /> },
  { pattern: "/remaining-tasks", render: () => <RemainingTasks /> },
  { pattern: "/sale", render: () => redirect("/income/create") },
  { pattern: "/sale/create", render: () => redirect("/income/create") },
  { pattern: "/sale/documents", render: () => redirect("/income/documents") },
  { pattern: "/income", render: () => <SaleCreate /> },
  { pattern: "/income/create", render: () => <SaleCreate /> },
  { pattern: "/income/documents", render: () => <SaleDocuments /> },
  { pattern: "/income/documents/:id", render: ({ id }) => <InvoiceDetail id={id} /> },
  { pattern: "/income/reports", render: () => <Reports /> },
  { pattern: "/sales", render: () => redirect("/income/create") },
  { pattern: "/purchase", render: () => <PurchaseCreate /> },
  { pattern: "/purchase/create", render: () => <PurchaseCreate /> },
  { pattern: "/purchase/documents", render: () => <PurchaseDocuments /> },
  { pattern: "/expense", render: () => <PurchaseCreate /> },
  { pattern: "/expense/create", render: () => <PurchaseCreate /> },
  { pattern: "/expense/documents", render: () => <PurchaseDocuments /> },
  { pattern: "/expense/payments", render: () => redirect("/payment/transactions?type=supplier_payment") },
  { pattern: "/expense/reports", render: () => <Reports /> },
  { pattern: "/purchases", render: () => redirect("/expense/create") },
  { pattern: "/contacts", render: () => <Customers /> },
  { pattern: "/other-functions", render: () => <OtherFunctions /> },
  { pattern: "/showcase", render: () => <Showcase /> },
  {
    pattern: "/tasks",
    render: () => <RemainingTasks />,
  },
  {
    pattern: "/alerts",
    render: () => (
      <ModulePage groupKey="nav.overview" titleKey="nav.alerts" modalKind="none" />
    ),
  },
  {
    pattern: "/sales/quotations",
    render: () => redirect("/income/documents?type=quotation"),
  },
  { pattern: "/sales/invoices", render: () => redirect("/income/documents?type=invoice") },
  { pattern: "/sales/invoices/new", render: () => redirect("/income/create?documentTypes=invoice") },
  { pattern: "/sales/invoices/:id", render: ({ id }) => redirect(`/income/documents/${encodeURIComponent(id ?? "")}?type=invoice`) },
  { pattern: "/sales/receipts", render: () => redirect("/income/documents?type=receipt") },
  { pattern: "/sales/billing", render: () => redirect("/income/documents?type=billing_note") },
  { pattern: "/sales/credit-notes", render: () => redirect("/income/documents?type=credit_note") },
  { pattern: "/sales/debit-notes", render: () => redirect("/income/documents?type=debit_note") },
  {
    pattern: "/purchases/orders",
    render: () => redirect("/expense/documents?type=purchase_order"),
  },
  {
    pattern: "/purchases/received",
    render: () => redirect("/expense/documents?type=receive"),
  },
  { pattern: "/purchases/expenses", render: () => redirect("/expense/documents?type=expense") },
  { pattern: "/purchases/expenses/:id", render: () => <ExpenseDetail /> },
  {
    pattern: "/purchases/payments",
    render: () => redirect("/payment/transactions?type=supplier_payment"),
  },
  {
    pattern: "/purchases/wht",
    render: () => redirect("/tax/withholding-tax"),
  },
  { pattern: "/contacts/customers", render: () => <Customers /> },
  { pattern: "/contacts/vendors", render: () => <Vendors /> },
  { pattern: "/products", render: () => <Products /> },
  { pattern: "/inventory", render: () => <Inventory /> },
  { pattern: "/inventory/products", render: () => <Products /> },
  { pattern: "/inventory/stock-movement", render: () => <Inventory /> },
  { pattern: "/inventory/stock-adjustment", render: () => <Inventory /> },
  { pattern: "/import", render: () => <ImportData /> },
  { pattern: "/import/data", render: () => <ImportData /> },
  { pattern: "/import/ocr", render: () => <ImportData /> },
  { pattern: "/import/history", render: () => <ImportData /> },
  { pattern: "/payment", render: () => redirect("/payment/overview") },
  { pattern: "/payment/overview", render: () => <Finance /> },
  { pattern: "/payment/transactions", render: () => <PaymentTransactions /> },
  { pattern: "/payment/accounts", render: () => <Finance /> },
  { pattern: "/payment/banking", render: () => redirect("/payment/accounts") },
  { pattern: "/payment/cheques", render: () => <CashCheques /> },
  { pattern: "/payment/petty-cash", render: () => <CashCheques /> },
  { pattern: "/payment/reports", render: () => <Reports /> },
  { pattern: "/finance/banks", render: () => redirect("/payment/accounts") },
  { pattern: "/finance/cash", render: () => redirect("/payment/petty-cash") },
  { pattern: "/finance/journal", render: () => redirect("/accounting/journal-entries") },
  { pattern: "/finance/statements", render: () => redirect("/accounting/reports") },
  { pattern: "/finance/payroll", render: () => redirect("/payroll/runs") },
  { pattern: "/payroll/employees", render: () => <Payroll /> },
  { pattern: "/payroll/runs", render: () => <Payroll /> },
  { pattern: "/payroll/payslips", render: () => <Payroll /> },
  { pattern: "/tax/vat", render: () => <Reports /> },
  { pattern: "/tax/withholding-tax", render: () => <WithholdingTax /> },
  { pattern: "/tax/e-tax", render: () => <Settings /> },
  { pattern: "/tax/filing-export", render: () => <Reports /> },
  { pattern: "/integration/connections", render: () => <Settings /> },
  { pattern: "/integration/sync-history", render: () => <Settings /> },
  { pattern: "/accounting/journal-entries", render: () => <Journal /> },
  { pattern: "/accounting/reports", render: () => <Reports /> },
  { pattern: "/reports", render: () => <Reports /> },
  { pattern: "/settings", render: () => redirect("/settings/company") },
  { pattern: "/settings/company", render: () => <Settings /> },
  { pattern: "/settings/users", render: () => <Settings /> },
  { pattern: "/settings/documents", render: () => <Settings /> },
  { pattern: "/settings/document-settings", render: () => <Settings /> },
  { pattern: "/settings/taxes", render: () => redirect("/settings/company") },
  { pattern: "/settings/audit-log", render: () => <Settings /> },
  { pattern: "/settings/branding", render: () => redirect("/settings/documents") },
  { pattern: "/settings/numbering", render: () => redirect("/settings/company") },
  { pattern: "/settings/currency", render: () => <Settings /> },
  { pattern: "/settings/integrations", render: () => redirect("/settings/company") },
  { pattern: "/auth/login", render: () => <Login /> },
  { pattern: "/auth/register", render: () => <Register /> },
  { pattern: "/auth/forgot", render: () => <ForgotPassword /> },
  { pattern: "/auth/reset", render: () => <ResetPassword /> },
  { pattern: "/auth/verify-email", render: () => <EmailVerified /> },
  { pattern: "/auth/session-expired", render: () => <SessionExpired /> },
  { pattern: "/auth/logout", render: () => <LogoutConfirm /> },
];

export const resolveAppRoute = (pathname: string): ResolvedRoute => {
  for (const route of routes) {
    const params = matchPattern(route.pattern, pathname);

    if (params) {
      return {
        element: route.render(params),
        params,
      };
    }
  }

  return {
    element: <NotFound />,
    params: {},
  };
};

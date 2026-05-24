"use client";

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useAppData } from "@/lib/app-data";

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
}

const quickRoutes = [
  { labelKey: "searchDialog.routes.dashboard", route: "/app", keywords: "overview kpi summary" },
  { labelKey: "searchDialog.routes.invoices", route: "/sales/invoices", keywords: "sales tax invoice documents" },
  { labelKey: "searchDialog.routes.receipts", route: "/sales/receipts", keywords: "sales receipts payments" },
  { labelKey: "searchDialog.routes.quotations", route: "/sales/quotations", keywords: "sales quote quotation" },
  { labelKey: "searchDialog.routes.expenses", route: "/purchases/expenses", keywords: "purchase expense bills" },
  { labelKey: "searchDialog.routes.paymentTransactions", route: "/payment/transactions", keywords: "payables vendor customer payment banking cheque petty cash" },
  { labelKey: "searchDialog.routes.inventory", route: "/inventory", keywords: "stock warehouse products" },
  { labelKey: "searchDialog.routes.reports", route: "/reports", keywords: "financial reports tax" },
  { labelKey: "searchDialog.routes.settings", route: "/settings", keywords: "company users document settings branding currency" },
  { labelKey: "searchDialog.routes.payrollFoundations", route: "/finance/payroll", keywords: "salary employees payroll" },
];

export const GlobalSearchDialog = ({ open, onOpenChange }: Props) => {
  const nav = useNavigate();
  const { t } = useTranslation();
  const { data } = useAppData();

  const invoiceItems = useMemo(
    () =>
      data.invoices.slice(0, 8).map((invoice) => ({
        id: invoice.id,
        label: `${invoice.id} - ${invoice.customer}`,
        route: `/sales/invoices/${encodeURIComponent(invoice.id)}`,
      })),
    [data.invoices]
  );

  const customerItems = useMemo(
    () =>
      data.customers.slice(0, 8).map((customer) => ({
        id: customer.id,
        label: `${customer.name} - ${customer.contact || customer.email || t("searchDialog.customers")}`,
        route: "/contacts/customers",
      })),
    [data.customers, t]
  );

  const vendorItems = useMemo(
    () =>
      data.vendors.slice(0, 8).map((vendor) => ({
        id: vendor.id,
        label: `${vendor.name} - ${vendor.contact || vendor.email || t("searchDialog.vendors")}`,
        route: "/contacts/vendors",
      })),
    [data.vendors, t]
  );

  const projectItems = useMemo(
    () =>
      data.projects.slice(0, 8).map((project) => ({
        id: project.id,
        label: `${project.name} - ${project.customer || project.code || project.id}`,
        route: "/reports",
      })),
    [data.projects]
  );

  const handleSelect = (route: string) => {
    onOpenChange(false);
    nav(route);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={t("searchDialog.placeholder")} />
      <CommandList>
        <CommandEmpty>{t("searchDialog.empty")}</CommandEmpty>

        <CommandGroup heading={t("searchDialog.goTo")}>
          {quickRoutes.map((item) => (
            <CommandItem
              key={item.route}
              value={`${t(item.labelKey)} ${item.keywords}`}
              onSelect={() => handleSelect(item.route)}
            >
              {t(item.labelKey)}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading={t("searchDialog.invoices")}>
          {invoiceItems.map((item) => (
            <CommandItem key={item.id} value={item.label} onSelect={() => handleSelect(item.route)}>
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading={t("searchDialog.customers")}>
          {customerItems.map((item) => (
            <CommandItem key={item.id} value={item.label} onSelect={() => handleSelect(item.route)}>
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading={t("searchDialog.vendors")}>
          {vendorItems.map((item) => (
            <CommandItem key={item.id} value={item.label} onSelect={() => handleSelect(item.route)}>
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading={t("searchDialog.projects")}>
          {projectItems.map((item) => (
            <CommandItem key={item.id} value={item.label} onSelect={() => handleSelect(item.route)}>
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};

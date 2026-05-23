"use client";

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
  { label: "Dashboard", route: "/app", keywords: "overview kpi summary" },
  { label: "Invoices", route: "/sales/invoices", keywords: "sales tax invoice documents" },
  { label: "Receipts", route: "/sales/receipts", keywords: "sales receipts payments" },
  { label: "Quotations", route: "/sales/quotations", keywords: "sales quote quotation" },
  { label: "Expenses", route: "/purchases/expenses", keywords: "purchase expense bills" },
  { label: "Payment Transactions", route: "/payment/transactions", keywords: "payables vendor customer payment banking cheque petty cash" },
  { label: "Inventory", route: "/inventory", keywords: "stock warehouse products" },
  { label: "Reports", route: "/reports", keywords: "financial reports tax" },
  { label: "Settings", route: "/settings", keywords: "company users document settings branding currency" },
  { label: "Payroll Foundations", route: "/finance/payroll", keywords: "salary employees payroll" },
];

export const GlobalSearchDialog = ({ open, onOpenChange }: Props) => {
  const nav = useNavigate();
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
        label: `${customer.name} - ${customer.contact || customer.email || "Customer"}`,
        route: "/contacts/customers",
      })),
    [data.customers]
  );

  const vendorItems = useMemo(
    () =>
      data.vendors.slice(0, 8).map((vendor) => ({
        id: vendor.id,
        label: `${vendor.name} - ${vendor.contact || vendor.email || "Vendor"}`,
        route: "/contacts/vendors",
      })),
    [data.vendors]
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
      <CommandInput placeholder="Search routes, invoices, contacts, vendors, or reports..." />
      <CommandList>
        <CommandEmpty>No matching results.</CommandEmpty>

        <CommandGroup heading="Go To">
          {quickRoutes.map((item) => (
            <CommandItem
              key={item.route}
              value={`${item.label} ${item.keywords}`}
              onSelect={() => handleSelect(item.route)}
            >
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Invoices">
          {invoiceItems.map((item) => (
            <CommandItem key={item.id} value={item.label} onSelect={() => handleSelect(item.route)}>
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Customers">
          {customerItems.map((item) => (
            <CommandItem key={item.id} value={item.label} onSelect={() => handleSelect(item.route)}>
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Vendors">
          {vendorItems.map((item) => (
            <CommandItem key={item.id} value={item.label} onSelect={() => handleSelect(item.route)}>
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Projects">
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

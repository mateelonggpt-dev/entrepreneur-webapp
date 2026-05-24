import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BadgeDollarSign,
  BookOpen,
  Building,
  ChevronDown,
  ChevronsLeft,
  ChevronsUpDown,
  CreditCard,
  Grid2X2,
  LayoutDashboard,
  LogOut,
  Package,
  ReceiptText,
  ShoppingCart,
  Upload,
  UserCog,
  Users,
} from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type NavItem = {
  labelKey: string;
  to: string;
  icon: any;
  tourId?: string;
  activePrefixes?: string[];
  end?: boolean;
  children?: Array<{ labelKey: string; to: string }>;
};

const navItems: NavItem[] = [
  { labelKey: "nav.overview", to: "/app", icon: LayoutDashboard, tourId: "nav-overview", end: true, activePrefixes: ["/app", "/dashboard"] },
  {
    labelKey: "common.income",
    to: "/income/create",
    icon: BadgeDollarSign,
    tourId: "nav-income",
    activePrefixes: ["/income", "/sale", "/sales"],
    children: [
      { labelKey: "common.create", to: "/income/create" },
      { labelKey: "common.documents", to: "/income/documents" }
    ],
  },
  {
    labelKey: "common.expense",
    to: "/expense/create",
    icon: ShoppingCart,
    tourId: "nav-expense",
    activePrefixes: ["/expense", "/purchase", "/purchases"],
    children: [
      { labelKey: "common.create", to: "/expense/create" },
      { labelKey: "common.documents", to: "/expense/documents" }
    ],
  },
  {
    labelKey: "nav.inventory",
    to: "/inventory/products",
    icon: Package,
    activePrefixes: ["/inventory", "/products"]
  },
  {
    labelKey: "nav.settings",
    to: "/settings/company",
    icon: Building,
    activePrefixes: ["/settings"],
    children: [
      { labelKey: "nav.company", to: "/settings/company" },
      { labelKey: "nav.users", to: "/settings/users" },
      { labelKey: "nav.documents", to: "/settings/documents" },
      { labelKey: "nav.currency", to: "/settings/currency" },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
  const location = useLocation();
  const { t } = useTranslation();
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const isItemActive = (item: NavItem) => {
    if (item.end) return location.pathname === item.to;
    const prefixes = item.activePrefixes ?? [item.to];
    return prefixes.some((prefix) => location.pathname === prefix || location.pathname.startsWith(`${prefix}/`));
  };

  const isRouteActive = (to: string) => location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <aside
      data-tour="sidebar"
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-sidebar-border bg-gradient-sidebar text-sidebar-foreground transition-[width] duration-300 ease-out",
        collapsed ? "w-[76px]" : "w-[272px]"
      )}
    >
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-sidebar-border/60 px-4">
        <div className="flex min-w-0 items-center">
          {collapsed ? <BrandMark variant="icon" size="sm" inverted /> : <BrandMark variant="full" size="sm" inverted />}
        </div>
        <button
          onClick={onToggle}
          className={cn(
            "shrink-0 rounded-lg p-1.5 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
            collapsed && "absolute -right-3 top-5 rounded-full border border-sidebar-border bg-sidebar p-1 shadow-md"
          )}
          aria-label={t("sidebar.toggleSidebar")}
        >
          <ChevronsLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </button>
      </div>

      <nav className="sidebar-scroll flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isItemActive(item);
          const itemLabel = t(item.labelKey);
          const isExpanded = !collapsed && Boolean(item.children?.length) && (active || expandedItems[item.labelKey]);

          return (
            <div key={item.to} className="space-y-0.5" {...(item.tourId ? { "data-tour": item.tourId } : {})}>
              <div className="relative">
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                    collapsed && "justify-center px-0",
                    item.children?.length && !collapsed && "pr-9",
                    active
                      ? "bg-sidebar-accent text-sidebar-primary shadow-sm"
                      : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                  title={collapsed ? itemLabel : undefined}
                >
                  {active && !collapsed ? (
                    <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-primary-glow to-primary" />
                  ) : null}
                  <Icon className={cn("h-4 w-4 shrink-0", active && "text-sidebar-primary")} />
                  {!collapsed ? <span className="flex-1 truncate">{itemLabel}</span> : null}
                </NavLink>
                {item.children?.length && !collapsed ? (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-sidebar-foreground/50 transition hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    onClick={() =>
                      setExpandedItems((previous) => ({
                        ...previous,
                        [item.labelKey]: !isExpanded,
                      }))
                    }
                    aria-label={t("sidebar.toggleSubmenu", { label: itemLabel })}
                    aria-expanded={isExpanded}
                  >
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !isExpanded && "-rotate-90")} />
                  </button>
                ) : null}
              </div>

              {isExpanded ? (
                <div className="ml-4 border-l border-sidebar-border/70 pl-3">
                  {item.children?.map((child) => {
                    const childActive = isRouteActive(child.to);
                    return (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        className={cn(
                          "relative mt-1 flex items-center rounded-lg px-3 py-2 text-xs font-semibold transition-all",
                          childActive
                            ? "bg-sidebar-primary/15 text-sidebar-primary shadow-sm"
                            : "text-sidebar-foreground/60 hover:bg-sidebar-accent/45 hover:text-sidebar-foreground"
                        )}
                      >
                        {childActive ? (
                          <span className="absolute -left-[13px] top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-sidebar-primary" />
                        ) : null}
                        <span className="truncate">{t(child.labelKey)}</span>
                      </NavLink>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border/60 p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-sidebar-accent/60",
                collapsed && "justify-center"
              )}
            >
              <Avatar className="h-9 w-9 shrink-0 ring-2 ring-sidebar-primary/30">
                <AvatarFallback className="bg-gradient-brand text-xs font-bold text-primary-foreground">
                  SB
                </AvatarFallback>
              </Avatar>
              {!collapsed ? (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-sidebar-foreground">Somchai B.</p>
                    <p className="truncate text-[11px] text-sidebar-foreground/50">Siam Tech Co., Ltd.</p>
                  </div>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 text-sidebar-foreground/40" />
                </>
              ) : null}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="mb-2 w-64">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-semibold">Somchai Bunnak</span>
                <span className="text-xs font-normal text-muted-foreground">somchai@siamtech.co.th</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <NavLink to="/settings/company"><Building className="mr-2 h-4 w-4" /> {t("nav.company")}</NavLink>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <NavLink to="/settings/users"><UserCog className="mr-2 h-4 w-4" /> {t("nav.users")}</NavLink>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" asChild>
              <NavLink to="/auth/logout"><LogOut className="mr-2 h-4 w-4" /> {t("account.signOut")}</NavLink>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
};

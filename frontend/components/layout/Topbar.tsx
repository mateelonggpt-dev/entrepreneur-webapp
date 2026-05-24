import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Bell, HelpCircle, ChevronDown, Building2, Check, Settings as SettingsIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LangSwitch } from "@/components/brand/LangSwitch";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { GlobalSearchDialog } from "@/components/search/GlobalSearchDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const companies = [
  { id: "1", name: "Siam Tech Co., Ltd.", tax: "0105561234567" },
  { id: "2", name: "Bangkok Trading Group", tax: "0105562345678" },
  { id: "3", name: "Chiang Mai Crafts Ltd.", tax: "0505563456789" },
];

const notifications = [
  {
    titleKey: "topbar.notifications.invoicePaid.title",
    summaryKey: "topbar.notifications.invoicePaid.summary",
    time: "2m",
    to: "/sales/invoices/INV-2026-0142",
  },
  {
    titleKey: "topbar.notifications.vendorDue.title",
    summaryKey: "topbar.notifications.vendorDue.summary",
    time: "1h",
    to: "/purchases/expenses",
  },
  {
    titleKey: "topbar.notifications.vatReminder.title",
    summaryKey: "topbar.notifications.vatReminder.summary",
    time: "3h",
    to: "/reports",
  },
];

export const Topbar = ({ sidebarCollapsed }: { sidebarCollapsed: boolean }) => {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [activeCompanyId, setActiveCompanyId] = useState(companies[0].id);
  const [searchOpen, setSearchOpen] = useState(false);

  const activeCompany = useMemo(
    () => companies.find((company) => company.id === activeCompanyId) ?? companies[0],
    [activeCompanyId]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleCompanySwitch = (companyId: string) => {
    const nextCompany = companies.find((company) => company.id === companyId);
    if (!nextCompany) {
      return;
    }

    setActiveCompanyId(companyId);
    toast.success(t("common.switchedCompany", { name: nextCompany.name }));
  };

  return (
    <>
      <header
        className={cn(
          "fixed top-0 right-0 z-30 h-16 border-b border-border bg-card/80 backdrop-blur-xl transition-[left] duration-300",
          sidebarCollapsed ? "left-[76px]" : "left-[272px]"
        )}
      >
        <div className="flex h-full items-center px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-10 gap-2 px-3 hover:bg-secondary">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-brand">
                    <Building2 className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="hidden flex-col items-start leading-tight md:flex">
                    <span className="text-sm font-semibold">{activeCompany.name}</span>
                    <span className="text-[10px] text-muted-foreground">VAT {activeCompany.tax}</span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                <DropdownMenuLabel>{t("common.switchCompany")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {companies.map((company) => (
                  <DropdownMenuItem
                    key={company.id}
                    className="py-2.5"
                    onSelect={() => handleCompanySwitch(company.id)}
                  >
                    <div className="mr-2 flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{company.name}</p>
                      <p className="text-xs text-muted-foreground">VAT {company.tax}</p>
                    </div>
                    {company.id === activeCompanyId ? <Check className="h-4 w-4 text-primary" /> : null}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-primary" onSelect={() => nav("/settings/company")}>
                  <Plus className="mr-2 h-4 w-4" /> {t("common.addCompany")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="mx-2 max-w-xl flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  readOnly
                  role="button"
                  aria-label={t("common.searchShort")}
                  placeholder={t("common.search")}
                  className="h-10 cursor-pointer border-transparent bg-secondary/50 pl-9 focus-visible:border-input focus-visible:bg-card"
                  onClick={() => setSearchOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSearchOpen(true);
                    }
                  }}
                />
              </div>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <LangSwitch variant="subtle" />

            <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => nav("/help")}>
              <HelpCircle className="h-5 w-5 text-muted-foreground" />
            </Button>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => nav("/settings")}
                    data-tour="nav-settings"
                    aria-label={t("nav.settings")}
                    title={t("nav.settings")}
                  >
                    <SettingsIcon className="h-5 w-5 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("nav.settings")}</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-10 w-10">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive ring-2 ring-card" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between">
                  {t("common.notifications")}
                  <Badge variant="secondary" className="text-[10px]">
                    {t("common.newCount", { count: 3 })}
                  </Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications.map((notification) => (
                  <DropdownMenuItem
                    key={notification.titleKey}
                    className="flex-col items-start gap-0.5 py-3"
                    onSelect={() => nav(notification.to)}
                  >
                    <span className="text-sm font-medium">{t(notification.titleKey)}</span>
                    <span className="text-xs text-muted-foreground">
                      {t(notification.summaryKey)} · {notification.time}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full p-0"
              onClick={() => nav("/settings/users")}
            >
              <Avatar className="h-9 w-9 ring-2 ring-primary/20">
                <AvatarFallback className="bg-gradient-brand text-xs font-bold text-primary-foreground">
                  SB
                </AvatarFallback>
              </Avatar>
            </Button>
          </div>
        </div>
      </header>

      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
};

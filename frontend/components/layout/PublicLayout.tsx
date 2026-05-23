import { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BrandMark } from "@/components/brand/BrandMark";
import { LangSwitch } from "@/components/brand/LangSwitch";
import { Button } from "@/components/ui/button";
import { Twitter, Linkedin, Facebook, Mail, MapPin, Phone, ArrowRight } from "lucide-react";

export const PublicLayout = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  const navItems = [
    { label: t("common.features"), to: "/landing#features" },
    { label: t("common.pricing"), to: "/pricing" },
    { label: t("common.helpCenter"), to: "/help" },
    { label: t("common.contact"), to: "/contact" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 lg:px-8">
          <Link to="/" className="shrink-0">
            <BrandMark size="sm" />
          </Link>

          <nav className="ml-4 hidden items-center gap-1 lg:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-primary/5 text-primary"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <LangSwitch />
            <Link to="/auth/login" className="hidden sm:block">
              <Button variant="ghost" size="sm" className="font-semibold">
                {t("common.signIn")}
              </Button>
            </Link>
            <Link to="/auth/register">
              <Button
                size="sm"
                className="gap-1.5 border-0 bg-gradient-brand font-semibold text-primary-foreground shadow-brand hover:opacity-95"
              >
                {t("common.freeTrial")} <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-20 border-t border-border bg-secondary/30">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-14 lg:grid-cols-5 lg:px-8">
          <div className="col-span-2">
            <BrandMark size="md" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {t("publicLayout.footerDescription", {
                defaultValue:
                  "Premium accounting for Thai SMEs. Invoicing, expenses, VAT and reporting all in one workspace.",
              })}
            </p>
            <div className="mt-5 flex items-center gap-2">
              {[
                { icon: Twitter, to: "/contact" },
                { icon: Linkedin, to: "/contact" },
                { icon: Facebook, to: "/contact" },
              ].map(({ icon: Icon, to }, index) => (
                <Link
                  key={`${to}-${index}`}
                  to={to}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:border-primary/40 hover:text-primary"
                >
                  <Icon className="h-4 w-4" />
                </Link>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-display font-semibold">
              {t("publicLayout.product", { defaultValue: "Product" })}
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/landing#features" className="hover:text-foreground">
                  {t("common.features")}
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="hover:text-foreground">
                  {t("common.pricing")}
                </Link>
              </li>
              <li>
                <Link to="/auth/register" className="hover:text-foreground">
                  {t("common.freeTrial")}
                </Link>
              </li>
              <li>
                <Link to="/auth/login" className="hover:text-foreground">
                  {t("common.signIn")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="mb-3 text-sm font-display font-semibold">
              {t("publicLayout.resources", { defaultValue: "Resources" })}
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/help" className="hover:text-foreground">
                  {t("common.helpCenter")}
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-foreground">
                  {t("common.contact")}
                </Link>
              </li>
              <li>
                <Link to="/developers/api" className="hover:text-foreground">
                  {t("publicLayout.apiDocs", { defaultValue: "API docs" })}
                </Link>
              </li>
              <li>
                <Link to="/status" className="hover:text-foreground">
                  {t("publicLayout.status", { defaultValue: "Status" })}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="mb-3 text-sm font-display font-semibold">{t("common.contact")}</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0" /> hello@matteracc.co.th
              </li>
              <li className="flex items-start gap-2">
                <Phone className="mt-0.5 h-4 w-4 shrink-0" /> +66 2 123 4567
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" /> Sukhumvit Rd., Bangkok
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row lg:px-8">
            <span>
              {t("publicLayout.copyright", {
                defaultValue: "© 2026 Matter Acc. Co., Ltd. All rights reserved.",
              })}
            </span>
            <div className="flex items-center gap-4">
              <Link to="/legal/terms" className="hover:text-foreground">
                {t("publicLayout.terms", { defaultValue: "Terms" })}
              </Link>
              <Link to="/legal/privacy" className="hover:text-foreground">
                {t("publicLayout.privacy", { defaultValue: "Privacy" })}
              </Link>
              <Link to="/legal/cookies" className="hover:text-foreground">
                {t("publicLayout.cookies", { defaultValue: "Cookies" })}
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

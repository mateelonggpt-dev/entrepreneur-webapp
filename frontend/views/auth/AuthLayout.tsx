import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Shield, Zap } from "lucide-react";
import { Mascot } from "@/components/brand/Mascot";
import { BrandMark } from "@/components/brand/BrandMark";
import { LangSwitch } from "@/components/brand/LangSwitch";

export const AuthLayout = ({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
}) => {
  return (
    <div className="grid min-h-screen w-full grid-cols-1 bg-background lg:grid-cols-2">
      <div className="flex flex-col p-8 lg:p-12">
        <div className="flex items-center justify-between">
          <Link to="/">
            <BrandMark size="md" />
          </Link>
          <LangSwitch />
        </div>

        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-md">
            <h1 className="mb-2 text-3xl font-display font-bold tracking-tight">{title}</h1>
            {subtitle ? <p className="mb-8 text-sm text-muted-foreground">{subtitle}</p> : null}
            {children}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          © 2026 Matter Acc. ·{" "}
          <Link to="/legal/terms" className="hover:text-foreground">
            Terms
          </Link>{" "}
          ·{" "}
          <Link to="/legal/privacy" className="hover:text-foreground">
            Privacy
          </Link>
        </p>
      </div>

      <div className="relative hidden items-center justify-center overflow-hidden bg-gradient-brand lg:flex">
        <div className="absolute inset-0 gradient-mesh opacity-50 mix-blend-overlay" />

        <div className="absolute left-12 top-12 flex items-center gap-2 rounded-2xl bg-white/15 px-3 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur animate-float">
          <Shield className="h-3.5 w-3.5" /> SOC 2 · ISO 27001
        </div>
        <div className="absolute right-10 top-10 flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
          <Sparkles className="h-3 w-3" /> AI-powered accounting
        </div>
        <div
          className="absolute bottom-12 right-12 flex items-center gap-2 rounded-2xl bg-white/15 px-3 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur"
          style={{ animationDelay: "1s" }}
        >
          <Zap className="h-3.5 w-3.5" /> Setup in 5 minutes
        </div>

        <div className="relative z-10 max-w-lg px-12 text-center text-white">
          <Mascot size="xl" className="mx-auto mb-6 drop-shadow-2xl" />
          <h2 className="mb-4 text-3xl font-display font-bold leading-tight text-balance">
            Accounting that actually feels easy.
          </h2>
          <p className="leading-relaxed text-white/80">
            Matter Acc. helps Thai SMEs run invoicing, expenses, VAT and reporting all in one premium workspace.
          </p>
          <div className="mt-8 flex items-center justify-center gap-6 text-xs text-white/70">
            <div>
              <span className="block text-2xl font-display font-bold text-white">10K+</span>
              businesses
            </div>
            <div className="h-8 w-px bg-white/20" />
            <div>
              <span className="block text-2xl font-display font-bold text-white">THB 2.4B</span>
              processed
            </div>
            <div className="h-8 w-px bg-white/20" />
            <div>
              <span className="block text-2xl font-display font-bold text-white">99.9%</span>
              uptime
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AuthLayout } from "./AuthLayout";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const Login = () => {
  const nav = useNavigate();
  const { signIn } = useAuth();
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);

  return (
    <AuthLayout title={t("auth.welcomeBack")} subtitle={t("auth.welcomeBackSub")}>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const email = String(formData.get("email") || "somchai@siamtech.co.th").trim();

          try {
            setSubmitting(true);
            await signIn(email);
            nav("/app");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to sign in right now.");
          } finally {
            setSubmitting(false);
          }
        }}
        className="space-y-4"
      >
        <div>
          <Label htmlFor="email">{t("auth.email")}</Label>
          <div className="relative mt-1.5">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@company.co.th"
              className="h-11 pl-9"
              defaultValue="somchai@siamtech.co.th"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Link to="/auth/forgot" className="text-xs font-medium text-primary hover:underline">
              {t("auth.forgot")}
            </Link>
          </div>
          <div className="relative mt-1.5">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              placeholder="password"
              className="h-11 pl-9"
              defaultValue="password"
            />
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox defaultChecked /> <span>{t("auth.keepSignedIn")}</span>
        </label>

        <Button
          type="submit"
          disabled={submitting}
          className="h-11 w-full gap-1.5 border-0 bg-gradient-brand text-primary-foreground shadow-brand hover:opacity-95"
        >
          {t("auth.signInBtn")} <ArrowRight className="h-4 w-4" />
        </Button>

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-wider">
            <span className="bg-background px-2 text-muted-foreground">{t("common.or")}</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          disabled
          onClick={() => toast.info("Google sign-in is not enabled in this local build yet.")}
        >
          {t("auth.continueGoogle")}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Google sign-in is intentionally disabled until a supported auth provider is wired.
        </p>

        <p className="text-center text-sm text-muted-foreground">
          {t("auth.newHere")}{" "}
          <Link to="/auth/register" className="font-semibold text-primary hover:underline">
            {t("auth.createAccount")}
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
};

export default Login;

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, Loader2 } from "lucide-react";
import { AuthLayout } from "./AuthLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { requestPasswordReset } from "@/lib/api";
import { toast } from "sonner";

const ForgotPassword = () => {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await requestPasswordReset({ email });
      setToken(response.resetToken ?? "");
      toast.success("Reset shell created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create reset request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Forgot your password?" subtitle="Enter your email and we&apos;ll create a reset shell for this local workspace.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email">Email address</Label>
          <div className="relative mt-1.5">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="you@company.co.th"
              className="h-11 pl-9"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
        </div>

        <Button className="h-11 w-full border-0 bg-gradient-brand text-primary-foreground shadow-brand" disabled={submitting}>
          {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          Send reset link
        </Button>

        {token ? (
          <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 text-sm">
            <p className="font-semibold">Local reset token created</p>
            <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{token}</p>
            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full"
              onClick={() => nav(`/auth/reset?token=${encodeURIComponent(token)}`)}
            >
              Continue to reset password
            </Button>
          </div>
        ) : null}

        <Link to="/auth/login" className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
      </form>
    </AuthLayout>
  );
};

export default ForgotPassword;

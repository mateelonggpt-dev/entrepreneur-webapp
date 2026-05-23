import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Lock, Loader2 } from "lucide-react";
import { AuthLayout } from "./AuthLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { resetPasswordRequest } from "@/lib/api";
import { toast } from "sonner";

const ResetPassword = () => {
  const location = useLocation();
  const nav = useNavigate();
  const tokenFromQuery = useMemo(() => new URLSearchParams(location.search).get("token") ?? "", [location.search]);
  const [token, setToken] = useState(tokenFromQuery);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      toast.error("Reset token is required.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await resetPasswordRequest({ token, password });
      setCompleted(true);
      toast.success("Password updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to reset password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Set a new password" subtitle="Use the reset token from the forgot-password step to complete the local auth shell.">
      {completed ? (
        <div className="space-y-4">
          <p className="rounded-xl border border-success/20 bg-success/10 p-4 text-sm text-success">
            Password updated in the local auth shell.
          </p>
          <Button className="h-11 w-full border-0 bg-gradient-brand text-primary-foreground shadow-brand" onClick={() => nav("/auth/login")}>
            Back to sign in
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Reset token</Label>
            <Input
              className="mt-1.5 h-11 font-mono"
              placeholder="reset-xxxxxxxxxx"
              value={token}
              onChange={(event) => setToken(event.target.value)}
            />
          </div>
          <div>
            <Label>New password</Label>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                className="h-11 pl-9"
                placeholder="Min 8 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Confirm new password</Label>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                className="h-11 pl-9"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
          </div>

          <Button type="submit" className="h-11 w-full border-0 bg-gradient-brand text-primary-foreground shadow-brand" disabled={submitting}>
            {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Update password
          </Button>

          <Link to="/auth/forgot" className="block text-center text-sm text-muted-foreground hover:text-foreground">
            Need a token? Create a reset request first.
          </Link>
        </form>
      )}
    </AuthLayout>
  );
};

export default ResetPassword;

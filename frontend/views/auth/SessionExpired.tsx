import { AuthLayout } from "./AuthLayout";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Clock, RotateCw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

const SessionExpired = () => {
  const nav = useNavigate();
  const { signIn } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  return (
    <AuthLayout title="Session expired" subtitle="For your security, please sign in again to continue.">
      <div className="text-center py-4">
        <div className="relative inline-block mb-6">
          <div className="absolute inset-0 bg-warning/20 blur-2xl rounded-full" />
          <div className="relative h-20 w-20 mx-auto rounded-full bg-gradient-to-br from-warning to-destructive flex items-center justify-center shadow-lg">
            <Clock className="h-10 w-10 text-white" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-8 max-w-sm mx-auto">
          You've been signed out after 30 minutes of inactivity. Your work is safe — sign back in to pick up where you left off.
        </p>
        <Button
          disabled={submitting}
          onClick={async () => {
            try {
              setSubmitting(true);
              await signIn();
              nav("/app");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Unable to restore your session.");
            } finally {
              setSubmitting(false);
            }
          }}
          className="w-full h-11 bg-gradient-brand text-primary-foreground border-0 shadow-brand hover:opacity-95 gap-1.5"
        >
          <RotateCw className="h-4 w-4" /> Sign in again
        </Button>
        <Link to="/" className="text-xs text-muted-foreground hover:text-foreground mt-4 inline-block">
          Back to homepage
        </Link>
      </div>
    </AuthLayout>
  );
};

export default SessionExpired;

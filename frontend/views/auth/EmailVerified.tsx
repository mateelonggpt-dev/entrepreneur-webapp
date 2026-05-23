import { AuthLayout } from "./AuthLayout";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { CheckCircle2, MailCheck, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

const EmailVerified = () => {
  const nav = useNavigate();
  const { signIn } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  return (
    <AuthLayout title="Email verified 🎉" subtitle="Your Matter Acc. workspace is ready to go.">
      <div className="text-center py-4">
        <div className="relative inline-block mb-6">
          <div className="absolute inset-0 bg-success/20 blur-2xl rounded-full" />
          <div className="relative h-20 w-20 mx-auto rounded-full bg-gradient-to-br from-success to-primary flex items-center justify-center shadow-brand">
            <CheckCircle2 className="h-10 w-10 text-white" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-1 flex items-center justify-center gap-1.5">
          <MailCheck className="h-4 w-4" /> somchai@siamtech.co.th confirmed
        </p>
        <p className="text-base font-medium mb-8 max-w-sm mx-auto">
          Let's set up your company in 2 minutes.
        </p>
        <Button
          disabled={submitting}
          onClick={async () => {
            try {
              setSubmitting(true);
              await signIn();
              nav("/onboarding");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Unable to continue to onboarding.");
            } finally {
              setSubmitting(false);
            }
          }}
          className="w-full h-11 bg-gradient-brand text-primary-foreground border-0 shadow-brand hover:opacity-95 gap-1.5"
        >
          Start onboarding <ArrowRight className="h-4 w-4" />
        </Button>
        <Link to="/app" className="text-xs text-muted-foreground hover:text-foreground mt-4 inline-block">
          Skip — go to dashboard
        </Link>
      </div>
    </AuthLayout>
  );
};

export default EmailVerified;

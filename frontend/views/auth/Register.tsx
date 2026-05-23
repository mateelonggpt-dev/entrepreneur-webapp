import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { AuthLayout } from "./AuthLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const Register = () => {
  const nav = useNavigate();

  return (
    <AuthLayout title="Create your workspace" subtitle="Start free - no credit card required.">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          nav("/auth/verify-email");
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>First name</Label>
            <Input className="mt-1.5 h-11" placeholder="Somchai" />
          </div>
          <div>
            <Label>Last name</Label>
            <Input className="mt-1.5 h-11" placeholder="Bunnak" />
          </div>
        </div>

        <div>
          <Label>Work email</Label>
          <Input type="email" className="mt-1.5 h-11" placeholder="you@company.co.th" />
        </div>

        <div>
          <Label>Company name</Label>
          <Input className="mt-1.5 h-11" placeholder="Your company" />
        </div>

        <div>
          <Label>Password</Label>
          <Input type="password" className="mt-1.5 h-11" placeholder="Min 8 characters" />
          <p className="mt-1.5 text-xs text-muted-foreground">At least 8 characters with one number.</p>
        </div>

        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <Checkbox defaultChecked className="mt-0.5" />
          <span className="text-muted-foreground">
            I agree to Matter Acc.&apos;s{" "}
            <Link to="/legal/terms" className="text-primary hover:underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link to="/legal/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        <Button
          type="submit"
          className="h-11 w-full gap-1.5 border-0 bg-gradient-brand text-primary-foreground shadow-brand hover:opacity-95"
        >
          Create account <ArrowRight className="h-4 w-4" />
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/auth/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
};

export default Register;

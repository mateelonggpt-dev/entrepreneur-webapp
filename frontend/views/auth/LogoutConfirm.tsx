import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import matterMascot from "@/assets/matter-mascot.png";
import matterLogo from "@/assets/matter-logo.png";
import { LogIn, Home, Hand } from "lucide-react";

/**
 * Post-logout goodbye page. Friendly farewell with the single mascot
 * (waving) and routes back to login or landing.
 */
const LogoutConfirm = () => {
  const { signOut } = useAuth();
  const nav = useNavigate();

  // Make sure session is cleared when this page mounts
  useEffect(() => {
    void signOut().catch((error) => {
      console.error("Unable to finish logout cleanup.", error);
    });
  }, [signOut]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background gradient-mesh px-6 py-12 relative overflow-hidden">
      {/* Soft brand glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-[420px] w-[420px] rounded-full bg-gradient-brand opacity-20 blur-3xl" />
      </div>

      {/* Top brand */}
      <Link to="/landing" className="absolute top-6 left-6 inline-flex items-center gap-2">
        <img src={matterLogo.src} alt="Matter Acc." className="h-7 w-auto" />
      </Link>

      <div className="relative w-full max-w-md text-center">
        {/* Mascot waving */}
        <div className="relative mx-auto mb-6 w-44 h-44 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-gradient-brand opacity-15 blur-2xl" />
          <img
            src={matterMascot.src}
            alt="Matter Acc. mascot waving goodbye"
            className="relative w-full h-full object-contain animate-float drop-shadow-[0_12px_32px_hsl(174_62%_45%/0.35)]"
            draggable={false}
          />
          {/* Waving hand badge */}
          <span className="absolute -top-1 right-2 h-11 w-11 rounded-full bg-card ring-2 ring-border shadow-premium flex items-center justify-center">
            <Hand className="h-5 w-5 text-primary" style={{ animation: "wave 1.4s ease-in-out infinite" }} />
          </span>
        </div>

        <h1 className="font-display font-extrabold text-3xl tracking-tight">
          See you again soon
        </h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
          You've been logged out successfully. Thanks for using{" "}
          <span className="font-semibold text-foreground">Matter Acc.</span> — come back anytime.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            onClick={() => nav("/auth/login")}
            size="lg"
            className="gap-2 bg-gradient-brand text-primary-foreground border-0 shadow-brand hover:opacity-90 w-full sm:w-auto"
          >
            <LogIn className="h-4 w-4" /> Back to Login
          </Button>
          <Button
            onClick={() => nav("/landing")}
            variant="outline"
            size="lg"
            className="gap-2 w-full sm:w-auto"
          >
            <Home className="h-4 w-4" /> Go to Homepage
          </Button>
        </div>

        <p className="mt-10 text-[11px] text-muted-foreground">
          Need help?{" "}
          <Link to="/contact" className="text-primary hover:underline font-medium">
            Contact support
          </Link>
        </p>
      </div>

      <style>{`
        @keyframes wave {
          0%, 100% { transform: rotate(-12deg); }
          50% { transform: rotate(18deg); }
        }
      `}</style>
    </main>
  );
};

export default LogoutConfirm;

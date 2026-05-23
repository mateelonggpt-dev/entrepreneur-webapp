import { MascotAnimated } from "./MascotAnimated";
import { Progress } from "@/components/ui/progress";
import matterLogo from "@/assets/matter-logo.png";
import { cn } from "@/lib/utils";

type Variant = "ring" | "bar" | "none";

interface MascotLoaderProps {
  size?: number;
  progress?: number; // 0-100, undefined = indeterminate
  variant?: Variant;
  className?: string;
}

/**
 * Mascot inside a circular ring OR with a horizontal progress bar.
 * The atomic loader piece — composed by full-page / modal / inline variants.
 */
export const MascotLoader = ({
  size = 120,
  progress,
  variant = "ring",
  className,
}: MascotLoaderProps) => {
  const ringSize = size + 28;
  const indeterminate = progress === undefined;
  const pct = Math.max(0, Math.min(100, progress ?? 0));

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div className="relative" style={{ width: ringSize, height: ringSize }}>
        {variant === "ring" && (
          <>
            {/* Track */}
            <svg
              className="absolute inset-0"
              viewBox="0 0 100 100"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="50"
                cy="50"
                r="46"
                stroke="hsl(var(--border))"
                strokeWidth="3"
              />
              {indeterminate ? (
                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  stroke="url(#loaderGrad)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="60 220"
                  className="origin-center animate-spin"
                  style={{ animationDuration: "1.4s" }}
                />
              ) : (
                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  stroke="url(#loaderGrad)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${(pct / 100) * 289} 289`}
                  transform="rotate(-90 50 50)"
                  className="transition-all duration-500"
                />
              )}
              <defs>
                <linearGradient id="loaderGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" />
                  <stop offset="100%" stopColor="hsl(var(--accent))" />
                </linearGradient>
              </defs>
            </svg>
          </>
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <MascotAnimated size={size} />
        </div>
      </div>

      {variant === "bar" && (
        <div className="w-56 space-y-1.5">
          {indeterminate ? (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full w-1/3 rounded-full bg-gradient-brand"
                style={{
                  animation: "loader-slide 1.4s ease-in-out infinite",
                }}
              />
            </div>
          ) : (
            <Progress value={pct} className="h-1.5" />
          )}
          {!indeterminate && (
            <p className="text-[10px] font-mono text-muted-foreground text-right tabular-nums">
              {Math.round(pct)}%
            </p>
          )}
        </div>
      )}

      <style>{`
        @keyframes loader-slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
};

interface FullPageLoaderProps {
  title?: string;
  message?: string;
  progress?: number;
  variant?: Variant;
  showLogo?: boolean;
}

export const FullPageLoader = ({
  title = "Loading your workspace…",
  message = "Just a moment while we get things ready.",
  progress,
  variant = "ring",
  showLogo = true,
}: FullPageLoaderProps) => (
  <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background gradient-mesh">
    {showLogo && (
      <img
        src={matterLogo.src}
        alt="Matter Acc."
        className="h-10 w-auto mb-12 opacity-90"
        draggable={false}
      />
    )}
    <MascotLoader size={140} progress={progress} variant={variant} />
    <div className="mt-8 text-center max-w-sm px-6">
      <h2 className="font-display font-bold text-xl text-foreground">{title}</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">{message}</p>
    </div>
  </div>
);

interface ProcessingCardProps {
  title?: string;
  message?: string;
  progress?: number;
  variant?: Variant;
  className?: string;
}

export const ProcessingCard = ({
  title = "Processing your request…",
  message = "This usually takes just a few seconds.",
  progress,
  variant = "bar",
  className,
}: ProcessingCardProps) => (
  <div
    className={cn(
      "card-premium p-8 flex flex-col items-center text-center max-w-md mx-auto",
      className
    )}
  >
    <MascotLoader size={96} progress={progress} variant={variant} />
    <h3 className="mt-6 font-display font-bold text-lg">{title}</h3>
    <p className="mt-1 text-sm text-muted-foreground">{message}</p>
  </div>
);

interface InlineLoaderProps {
  label?: string;
  className?: string;
  size?: number;
}

export const InlineLoader = ({
  label = "Loading…",
  className,
  size = 28,
}: InlineLoaderProps) => (
  <div className={cn("inline-flex items-center gap-2 text-sm text-muted-foreground", className)}>
    <MascotAnimated size={size} speed={160} />
    <span>{label}</span>
  </div>
);

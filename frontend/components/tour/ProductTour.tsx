import { useEffect, useLayoutEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, X } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";

const SEEN_KEY = "matteracc:tour:seen";
const SKIP_KEY = "matteracc:tour:skip";

type Step = {
  selector: string;
  titleKey: string;
  bodyKey: string;
  placement?: "right" | "bottom" | "left" | "top";
};

const STEPS: Step[] = [
  { selector: '[data-tour="sidebar"]', titleKey: "tour.steps.sidebar.title", bodyKey: "tour.steps.sidebar.body", placement: "right" },
  { selector: '[data-tour="dashboard"]', titleKey: "tour.steps.dashboard.title", bodyKey: "tour.steps.dashboard.body", placement: "bottom" },
  { selector: '[data-tour="create-new"]', titleKey: "tour.steps.createNew.title", bodyKey: "tour.steps.createNew.body", placement: "bottom" },
  { selector: '[data-tour="nav-sales"]', titleKey: "tour.steps.sales.title", bodyKey: "tour.steps.sales.body", placement: "right" },
  { selector: '[data-tour="nav-purchases"]', titleKey: "tour.steps.purchases.title", bodyKey: "tour.steps.purchases.body", placement: "right" },
  { selector: '[data-tour="nav-contacts"]', titleKey: "tour.steps.contacts.title", bodyKey: "tour.steps.contacts.body", placement: "right" },
  { selector: '[data-tour="nav-finance"]', titleKey: "tour.steps.reports.title", bodyKey: "tour.steps.reports.body", placement: "right" },
  { selector: '[data-tour="nav-settings"]', titleKey: "tour.steps.settings.title", bodyKey: "tour.steps.settings.body", placement: "bottom" },
  { selector: '[data-tour="assistant"]', titleKey: "tour.steps.assistant.title", bodyKey: "tour.steps.assistant.body", placement: "left" },
];

function useElementRect(selector: string | null) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }
    const el = document.querySelector(selector) as HTMLElement | null;
    if (!el) {
      setRect(null);
      return;
    }
    const update = () => setRect(el.getBoundingClientRect());
    update();
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [selector]);
  return rect;
}

interface ProductTourProps {
  /** force open (e.g. from a "Replay tour" button) */
  forceOpen?: boolean;
  onClose?: () => void;
}

export const ProductTour = ({ forceOpen, onClose }: ProductTourProps) => {
  const { t } = useTranslation();
  const [showWelcome, setShowWelcome] = useState(false);
  const [running, setRunning] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [dontShow, setDontShow] = useState(false);

  // Decide whether to show welcome popup on mount
  useEffect(() => {
    if (forceOpen) {
      setShowWelcome(true);
      return;
    }
    const seen = localStorage.getItem(SEEN_KEY);
    const skipped = localStorage.getItem(SKIP_KEY);
    if (!seen && !skipped) {
      const t = setTimeout(() => setShowWelcome(true), 600);
      return () => clearTimeout(t);
    }
  }, [forceOpen]);

  const finish = useCallback(() => {
    localStorage.setItem(SEEN_KEY, "1");
    setRunning(false);
    setShowWelcome(false);
    setStepIdx(0);
    onClose?.();
  }, [onClose]);

  const skip = useCallback(() => {
    if (dontShow) localStorage.setItem(SKIP_KEY, "1");
    localStorage.setItem(SEEN_KEY, "1");
    setShowWelcome(false);
    setRunning(false);
    onClose?.();
  }, [dontShow, onClose]);

  const start = () => {
    setShowWelcome(false);
    setStepIdx(0);
    setRunning(true);
  };

  const current = running ? STEPS[stepIdx] : null;
  const rect = useElementRect(current?.selector ?? null);

  return (
    <>
      <Dialog open={showWelcome} onOpenChange={(o) => !o && skip()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 h-12 w-12 rounded-2xl bg-gradient-brand flex items-center justify-center shadow-brand">
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </div>
            <DialogTitle className="text-center">{t("tour.welcomeTitle")}</DialogTitle>
            <DialogDescription className="text-center pt-1">
              {t("tour.welcomeBody")}
            </DialogDescription>
          </DialogHeader>
          <label className="flex items-center justify-center gap-2 text-xs text-muted-foreground select-none">
            <Checkbox checked={dontShow} onCheckedChange={(v) => setDontShow(!!v)} />
            {t("tour.dontShowAgain")}
          </label>
          <DialogFooter className="sm:justify-center gap-2">
            <Button variant="ghost" onClick={skip}>{t("tour.skipForNow")}</Button>
            <Button onClick={start} className="bg-gradient-brand text-primary-foreground border-0 shadow-brand">
              {t("tour.startTour")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {running && createPortal(
        <TourOverlay
          rect={rect}
          step={current!}
          stepIdx={stepIdx}
          total={STEPS.length}
          onNext={() => (stepIdx < STEPS.length - 1 ? setStepIdx(stepIdx + 1) : finish())}
          onBack={() => stepIdx > 0 && setStepIdx(stepIdx - 1)}
          onSkip={finish}
        />,
        document.body
      )}
    </>
  );
};

interface OverlayProps {
  rect: DOMRect | null;
  step: Step;
  stepIdx: number;
  total: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

const TourOverlay = ({ rect, step, stepIdx, total, onNext, onBack, onSkip }: OverlayProps) => {
  const { t } = useTranslation();
  const pad = 8;

  // Spotlight box
  const spot = rect
    ? {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null;

  // Tooltip placement
  const tooltipStyle: React.CSSProperties = (() => {
    if (!rect) return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    const margin = 16;
    const tw = 320;
    const placement = step.placement ?? "bottom";
    switch (placement) {
      case "right":
        return { top: rect.top + rect.height / 2, left: rect.right + margin, transform: "translateY(-50%)" };
      case "left":
        return { top: rect.top + rect.height / 2, left: Math.max(margin, rect.left - margin - tw), transform: "translateY(-50%)" };
      case "top":
        return { top: Math.max(margin, rect.top - margin), left: rect.left + rect.width / 2, transform: "translate(-50%, -100%)" };
      case "bottom":
      default:
        return { top: rect.bottom + margin, left: rect.left + rect.width / 2, transform: "translateX(-50%)" };
    }
  })();

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Dim layer with spotlight cutout via SVG mask */}
      <svg className="absolute inset-0 w-full h-full pointer-events-auto" onClick={onSkip}>
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {spot && (
              <rect
                x={spot.left}
                y={spot.top}
                width={spot.width}
                height={spot.height}
                rx={12}
                ry={12}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="hsl(var(--foreground) / 0.55)" mask="url(#tour-mask)" />
      </svg>

      {/* Spotlight outline */}
      {spot && (
        <div
          className="absolute rounded-xl ring-2 ring-primary/80 shadow-[0_0_0_4px_hsl(var(--primary)/0.25)] pointer-events-none animate-pulse"
          style={spot}
        />
      )}

      {/* Tooltip card */}
      <div
        className="absolute w-[320px] rounded-2xl bg-card border border-border shadow-2xl p-4 pointer-events-auto"
        style={tooltipStyle}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <BrandMark variant="icon" size="sm" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {stepIdx + 1} {t("common.of")} {total}
            </span>
          </div>
          <button onClick={onSkip} className="text-muted-foreground hover:text-foreground" aria-label="Skip">
            <X className="h-4 w-4" />
          </button>
        </div>
        <h4 className="text-base font-semibold mb-1">{t(step.titleKey)}</h4>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">{t(step.bodyKey)}</p>

        {/* Progress bar */}
        <div className="h-1 w-full bg-secondary rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-brand transition-all"
            style={{ width: `${((stepIdx + 1) / total) * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onSkip}>{t("common.skip")}</Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onBack} disabled={stepIdx === 0}>
              {t("common.back")}
            </Button>
            <Button
              size="sm"
              onClick={onNext}
              className="bg-gradient-brand text-primary-foreground border-0 shadow-brand"
            >
              {stepIdx === total - 1 ? t("common.finish") : t("common.next")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface LangSwitchProps {
  variant?: "default" | "subtle" | "inverted";
  className?: string;
}

/**
 * Premium segmented EN | TH switch — visual translation toggle.
 * Persists via i18next LanguageDetector (localStorage).
 */
export const LangSwitch = ({ variant = "default", className }: LangSwitchProps) => {
  const { i18n } = useTranslation();
  const current = (i18n.language || "en").startsWith("th") ? "th" : "en";

  const setLang = (lng: "en" | "th") => i18n.changeLanguage(lng);

  const base =
    variant === "inverted"
      ? "bg-white/10 border-white/20"
      : variant === "subtle"
      ? "bg-secondary/60 border-transparent"
      : "bg-card border-border";

  const activeCls =
    variant === "inverted"
      ? "bg-white text-primary shadow-sm"
      : "bg-gradient-brand text-primary-foreground shadow-sm";

  const inactiveCls =
    variant === "inverted" ? "text-white/70 hover:text-white" : "text-muted-foreground hover:text-foreground";

  return (
    <div
      role="group"
      aria-label="Language"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border p-0.5 backdrop-blur",
        base,
        className
      )}
    >
      {(["en", "th"] as const).map((lng) => {
        const isActive = current === lng;
        return (
          <button
            key={lng}
            type="button"
            onClick={() => setLang(lng)}
            aria-pressed={isActive}
            className={cn(
              "px-3 h-7 text-[11px] font-bold uppercase tracking-wider rounded-full transition-all",
              isActive ? activeCls : inactiveCls
            )}
          >
            {lng}
          </button>
        );
      })}
    </div>
  );
};

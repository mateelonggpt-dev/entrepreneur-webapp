import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface LangSwitchProps {
  variant?: "default" | "subtle" | "inverted";
  className?: string;
}

const languageOptions = [
  { value: "th", label: "ไทย" },
  { value: "en", label: "EN" },
] as const;

export const LangSwitch = ({ variant = "default", className }: LangSwitchProps) => {
  const { i18n } = useTranslation();
  const current = (i18n.language || "th").startsWith("en") ? "en" : "th";

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
      {languageOptions.map((option) => {
        const isActive = current === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setLang(option.value)}
            aria-pressed={isActive}
            className={cn(
              "px-3 h-7 text-[11px] font-bold uppercase tracking-wider rounded-full transition-all",
              isActive ? activeCls : inactiveCls
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

import matterLogo from "@/assets/matter-logo.png";
import { cn } from "@/lib/utils";

interface BrandMarkProps {
  variant?: "full" | "icon";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  inverted?: boolean;
}

const sizes = {
  sm: "h-8",
  md: "h-10",
  lg: "h-14",
  xl: "h-20",
};

export const BrandMark = ({ variant = "full", size = "md", className, inverted }: BrandMarkProps) => {
  return (
    <div className={cn("flex items-center gap-3 select-none", className)}>
      <div className={cn("relative flex items-center justify-center", sizes[size])}>
        <img
          src={matterLogo.src}
          alt="Matter Acc."
          className={cn(
            "h-full w-auto object-contain",
            inverted && "brightness-0 invert"
          )}
          draggable={false}
        />
      </div>
      {variant === "full" && (
        <div className="flex flex-col leading-none">
          <span className={cn(
            "font-display font-extrabold text-lg tracking-tight",
            inverted ? "text-white" : "text-foreground"
          )}>
            Matter <span className="gradient-brand-text">Acc.</span>
          </span>
          <span className={cn(
            "text-[10px] uppercase tracking-[0.18em] mt-0.5",
            inverted ? "text-white/50" : "text-muted-foreground"
          )}>
            Accounting Suite
          </span>
        </div>
      )}
    </div>
  );
};

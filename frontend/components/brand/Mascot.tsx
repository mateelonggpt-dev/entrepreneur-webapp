import matterMascot from "@/assets/matter-mascot.png";
import { cn } from "@/lib/utils";

interface MascotProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  animate?: boolean;
}

const sizes = {
  xs: "w-12 h-12",
  sm: "w-20 h-20",
  md: "w-32 h-32",
  lg: "w-48 h-48",
  xl: "w-64 h-64",
};

export const Mascot = ({ size = "md", className, animate = true }: MascotProps) => {
  return (
    <img
      src={matterMascot.src}
      alt="Matter Acc. mascot"
      className={cn(
        "object-contain select-none drop-shadow-[0_8px_24px_hsl(174_62%_45%/0.25)]",
        sizes[size],
        animate && "animate-float",
        className
      )}
      draggable={false}
    />
  );
};

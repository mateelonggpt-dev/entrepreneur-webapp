import { useEffect, useState } from "react";
import frame1 from "@/assets/run1.png";
import frame2 from "@/assets/run2.png";
import { cn } from "@/lib/utils";

const FRAMES = [frame1.src, frame2.src];

interface MascotAnimatedProps {
  /** ms per frame — default 180ms (~5.5fps, subtle) */
  speed?: number;
  size?: number;
  className?: string;
  /** If false, locks to first frame (idle / static) */
  playing?: boolean;
}

/**
 * Lightweight frame-based mascot animation.
 * Cycles 3 PNG frames with same body anchor — only expression/paper/details change.
 * Performance-friendly: no canvas, no lottie, just <img> swap.
 */
export const MascotAnimated = ({
  speed = 180,
  size = 96,
  className,
  playing = true,
}: MascotAnimatedProps) => {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setI((p) => (p + 1) % FRAMES.length), speed);
    return () => clearInterval(t);
  }, [speed, playing]);

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {FRAMES.map((src, idx) => (
        <img
          key={idx}
          src={src}
          alt=""
          width={size}
          height={size}
          draggable={false}
          className={cn(
            "absolute inset-0 w-full h-full object-contain select-none transition-opacity",
            idx === i ? "opacity-100" : "opacity-0"
          )}
          style={{ transitionDuration: "60ms" }}
        />
      ))}
    </div>
  );
};

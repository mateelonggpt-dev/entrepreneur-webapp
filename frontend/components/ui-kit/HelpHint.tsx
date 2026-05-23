import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const HelpHint = ({
  content,
  label = "More information",
  className,
}: {
  content?: string;
  label?: string;
  className?: string;
}) => {
  if (!content) return null;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground outline-none transition hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
              className
            )}
            aria-label={label}
          >
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs leading-5" side="top">
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

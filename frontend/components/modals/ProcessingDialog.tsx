import { ProcessingCard } from "@/components/brand/MascotLoader";

interface Props {
  open: boolean;
  title?: string;
  message?: string;
  progress?: number;
  variant?: "ring" | "bar";
}

/**
 * Branded processing dialog using the 3-frame mascot animation.
 * Used after create-form submissions, document generation, exports, etc.
 */
export const ProcessingDialog = ({
  open,
  title,
  message,
  progress,
  variant = "ring",
}: Props) => {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 px-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-live="assertive"
    >
      <ProcessingCard
        title={title}
        message={message}
        progress={progress}
        variant={variant}
        className="bg-card"
      />
    </div>
  );
};

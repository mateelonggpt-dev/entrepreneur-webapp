import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

interface DocumentFormActionsProps {
  submitting: "draft" | "create" | null;
  cancelLabel: string;
  draftLabel: string;
  submitLabel: string;
  onCancel: () => void;
  onSaveDraft: () => void;
  onSubmit: () => void;
}

export const DocumentFormActions = ({
  submitting,
  cancelLabel,
  draftLabel,
  submitLabel,
  onCancel,
  onSaveDraft,
  onSubmit,
}: DocumentFormActionsProps) => (
  <>
    <Button type="button" variant="ghost" onClick={onCancel} disabled={Boolean(submitting)}>
      {cancelLabel}
    </Button>
    <Button type="button" variant="outline" onClick={onSaveDraft} disabled={Boolean(submitting)}>
      {submitting === "draft" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
      {draftLabel}
    </Button>
    <Button
      type="button"
      onClick={onSubmit}
      disabled={Boolean(submitting)}
      className="border-0 bg-gradient-brand text-primary-foreground shadow-brand"
    >
      {submitting === "create" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
      {submitLabel}
    </Button>
  </>
);

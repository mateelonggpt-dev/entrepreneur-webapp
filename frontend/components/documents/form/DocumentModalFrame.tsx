import type { FormEventHandler, ReactNode, RefObject } from "react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface DocumentModalFrameProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  formRef?: RefObject<HTMLFormElement>;
  formKey?: string;
  hiddenFields?: ReactNode;
  onSubmit?: FormEventHandler<HTMLFormElement>;
  contentClassName?: string;
  bodyClassName?: string;
}

export const DocumentModalFrame = ({
  open,
  onOpenChange,
  title,
  description,
  icon,
  children,
  footer,
  formRef,
  formKey,
  hiddenFields,
  onSubmit,
  contentClassName,
  bodyClassName,
}: DocumentModalFrameProps) => {
  const modalContent = (
    <>
      {hiddenFields}
      <header className="flex items-start justify-between gap-4 border-b border-border bg-card px-6 py-4">
        <div className="flex items-start gap-3">
          {icon ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-brand shadow-brand">
              {icon}
            </div>
          ) : null}
          <div>
            <h2 className="font-display text-lg font-bold leading-tight">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
      </header>

      <div className={cn("flex-1 space-y-4 overflow-y-auto bg-background p-6", bodyClassName)}>
        {children}
      </div>

      {footer ? (
        <footer className="flex items-center justify-end gap-2 border-t border-border bg-card px-6 py-3.5">
          {footer}
        </footer>
      ) : null}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex h-[88vh] w-[80vw] max-w-none flex-col gap-0 overflow-hidden p-0",
          contentClassName
        )}
      >
        {formRef || onSubmit || formKey ? (
          <form key={formKey} ref={formRef} onSubmit={onSubmit} className="flex h-full min-h-0 flex-col">
            {modalContent}
          </form>
        ) : (
          <div className="flex h-full min-h-0 flex-col">{modalContent}</div>
        )}
      </DialogContent>
    </Dialog>
  );
};

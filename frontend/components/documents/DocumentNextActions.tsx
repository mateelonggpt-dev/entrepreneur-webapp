import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fetchDocumentNextActions } from "@/lib/api";
import type { DocumentWorkflowAction, DocumentWorkflowNextActions } from "@/lib/types";

interface DocumentNextActionsProps {
  kind: string;
  documentId: string;
  onAction?: (action: DocumentWorkflowAction) => void;
}

const fallbackLabel = (value: string) =>
  value
    .replace(/^create_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const DocumentNextActions = ({ kind, documentId, onAction }: DocumentNextActionsProps) => {
  const { t } = useTranslation();
  const [payload, setPayload] = useState<DocumentWorkflowNextActions | null>(null);

  useEffect(() => {
    if (!kind || !documentId) {
      return;
    }

    let active = true;
    void fetchDocumentNextActions(kind, documentId)
      .then((nextPayload) => {
        if (active) setPayload(nextPayload);
      })
      .catch(() => {
        if (active) setPayload(null);
      });

    return () => {
      active = false;
    };
  }, [documentId, kind]);

  const actions = payload?.nextActions ?? [];
  if (!actions.length) {
    return null;
  }

  return (
    <Card className="card-premium p-4">
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="font-display text-sm font-semibold">{t("workflow.nextActions")}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{t("workflow.nextActionsDescription")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={`${action.type}-${action.targetKind}`}
              type="button"
              variant={action.recommended ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => onAction?.(action)}
            >
              <ArrowRight className="h-4 w-4" />
              {t(action.labelKey, { defaultValue: fallbackLabel(action.targetKind) })}
              {action.recommended ? (
                <span className="ml-1 rounded bg-background/20 px-1.5 py-0.5 text-[10px] font-semibold">
                  {t("workflow.recommended")}
                </span>
              ) : null}
            </Button>
          ))}
        </div>
        {actions.some((action) => action.warningKey) ? (
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
            <span>{t("taxWarnings.taxPointMayBeRequired")}</span>
          </p>
        ) : null}
      </div>
    </Card>
  );
};

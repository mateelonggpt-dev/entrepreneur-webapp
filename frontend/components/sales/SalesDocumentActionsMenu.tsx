import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getRemovalActionForDocument,
  getSalesDocumentActions,
  type SalesDocumentActionId,
} from "@/lib/sales-document-actions";
import type { DocumentSummary } from "@/lib/types";
import { MoreHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";

interface SalesDocumentActionsMenuProps {
  document: DocumentSummary;
  canApprove?: boolean;
  allowApprovedEdit?: boolean;
  variant?: "workflow" | "shared";
  canRemove?: boolean;
  onAction: (action: SalesDocumentActionId, document: DocumentSummary) => void;
}

export const SalesDocumentActionsMenu = ({
  document,
  canApprove,
  allowApprovedEdit,
  variant = "workflow",
  canRemove = true,
  onAction,
}: SalesDocumentActionsMenuProps) => {
  const { i18n } = useTranslation();
  const language = i18n.language?.startsWith("th") ? "th" : "en";
  const actions =
    variant === "shared"
      ? getSharedActions(document, language, canRemove)
      : getSalesDocumentActions(document, { canApprove, allowApprovedEdit });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${document.id}`}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[240px]">
        {actions.map((item, index) => {
          const previous = actions[index - 1];
          const needsSeparator = previous && previous.group !== item.group;
          return (
            <Fragment key={item.id}>
              {needsSeparator ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem
                className={item.group === "danger" ? "text-destructive focus:text-destructive" : undefined}
                onClick={() => onAction(item.id, document)}
              >
                {item.label}
              </DropdownMenuItem>
            </Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const sharedLabels = {
  en: {
    create_from_reference: "Create document from this reference",
    duplicate: "Duplicate document",
    attach_evidence: "Attach evidence",
    view_evidence: "View evidence",
    delete: "Delete document",
    cancel_void: "Void document",
    remove_document: "Remove from system",
  },
  th: {
    create_from_reference: "สร้างเอกสารจากเอกสารนี้",
    duplicate: "คัดลอกเอกสาร",
    attach_evidence: "แนบหลักฐาน",
    view_evidence: "ดูหลักฐานแนบ",
    delete: "ลบเอกสาร",
    cancel_void: "ยกเลิก/ทำให้เป็นโมฆะ",
    remove_document: "นำออกจากระบบ",
  },
} satisfies Record<"en" | "th", Partial<Record<SalesDocumentActionId, string>>>;

const getSharedActions = (document: DocumentSummary, language: "en" | "th", canRemove: boolean) => {
  const removalAction = getRemovalActionForDocument(document);
  return (
    [
      { id: "create_from_reference", group: "workflow" },
      { id: "duplicate", group: "open" },
      { id: "attach_evidence", group: "related" },
      { id: "view_evidence", group: "related" },
      ...(canRemove && removalAction ? [{ id: removalAction === "delete" ? "delete" : "cancel_void", group: "danger" }] : []),
    ] as Array<{ id: SalesDocumentActionId; group: "open" | "workflow" | "related" | "danger" }>
  ).map((item) => ({
    ...item,
    label: sharedLabels[language][item.id] ?? item.id,
  }));
};

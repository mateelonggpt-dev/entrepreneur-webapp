import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getSalesDocumentActions, type SalesDocumentActionId } from "@/lib/sales-document-actions";
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
  const actions = variant === "shared"
    ? getSharedActions(language, canRemove)
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
    remove_document: "Remove document",
  },
  th: {
    create_from_reference: "สร้างเอกสารจากเอกสารนี้",
    duplicate: "คัดลอกเอกสาร",
    attach_evidence: "แนบหลักฐาน",
    view_evidence: "ดูหลักฐานแนบ",
    remove_document: "ลบเอกสาร",
  },
} satisfies Record<"en" | "th", Partial<Record<SalesDocumentActionId, string>>>;

const getSharedActions = (language: "en" | "th", canRemove: boolean) =>
  ([
    { id: "create_from_reference", group: "workflow" },
    { id: "duplicate", group: "open" },
    { id: "attach_evidence", group: "related" },
    { id: "view_evidence", group: "related" },
    ...(canRemove ? [{ id: "remove_document", group: "danger" }] : []),
  ] as Array<{ id: SalesDocumentActionId; group: "open" | "workflow" | "related" | "danger" }>).map((item) => ({
    ...item,
    label: sharedLabels[language][item.id] ?? item.id,
  }));

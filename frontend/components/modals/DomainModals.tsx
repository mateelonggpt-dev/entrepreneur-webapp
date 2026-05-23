import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AccountModal } from "@/components/modals/AccountModal";
import { AttachEvidenceModal } from "@/components/modals/AttachEvidenceModal";
import { CombinedBillingModal } from "@/components/modals/CombinedBillingModal";
import { CombinedReceiptModal } from "@/components/modals/CombinedReceiptModal";
import { CreditNoteModal } from "@/components/modals/CreditNoteModal";
import { CustomerModal } from "@/components/modals/CustomerModal";
import { DebitNoteModal } from "@/components/modals/DebitNoteModal";
import { DepositDocumentModal } from "@/components/modals/DepositDocumentModal";
import { ExpenseModal } from "@/components/modals/ExpenseModal";
import { FinanceMovementModal } from "@/components/modals/FinanceMovementModal";
import { InstallmentModal } from "@/components/modals/InstallmentModal";
import { IntegrationConfigModal } from "@/components/modals/IntegrationConfigModal";
import { InvoiceModal } from "@/components/modals/InvoiceModal";
import { NewReceiveModal } from "@/components/modals/NewReceiveModal";
import { PaymentModal } from "@/components/modals/PaymentModal";
import { ProductModal } from "@/components/modals/ProductModal";
import { ProjectModal } from "@/components/modals/ProjectModal";
import { PurchaseOrderModal } from "@/components/modals/PurchaseOrderModal";
import { QuotationModal } from "@/components/modals/QuotationModal";
import { ReceiptModal } from "@/components/modals/ReceiptModal";
import { StockAdjustmentModal } from "@/components/modals/StockAdjustmentModal";
import { UserInviteModal } from "@/components/modals/UserInviteModal";
import { VendorModal } from "@/components/modals/VendorModal";
import { WithholdingTaxModal } from "@/components/modals/WithholdingTaxModal";
import type { Attachment, Customer, FinanceAccount, Project, Vendor } from "@/lib/types";

type BaseModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export type IncomeDocumentModalKind =
  | "quotation"
  | "invoice"
  | "receipt"
  | "combined_billing"
  | "combined_receipt"
  | "credit_note"
  | "debit_note"
  | "deposit"
  | "installment";

export type ExpenseDocumentModalKind = "expense" | "purchase_order" | "receive" | "withholding_tax";
export type PaymentActionModalKind = "vendor_payment" | "finance_movement";
export type MasterDataModalKind = "customer" | "vendor" | "product" | "project" | "financial_account";
export type InventoryActionModalKind = "stock_adjustment" | "receive";
export type IntegrationModalKind = "connection";
export type UserAccessModalKind = "invite_user";

type PassthroughProps = Record<string, unknown>;
const renderLegacyModal = (Component: any, props: Record<string, unknown>) => <Component {...props} />;

export const IncomeDocumentModal = ({
  kind,
  open,
  onOpenChange,
  ...props
}: BaseModalProps & { kind: IncomeDocumentModalKind } & PassthroughProps) => {
  switch (kind) {
    case "quotation":
      return renderLegacyModal(QuotationModal, { open, onOpenChange, ...props });
    case "invoice":
      return <InvoiceModal open={open} onOpenChange={onOpenChange} />;
    case "receipt":
      return <ReceiptModal open={open} onOpenChange={onOpenChange} />;
    case "combined_billing":
      return renderLegacyModal(CombinedBillingModal, { open, onOpenChange, ...props });
    case "combined_receipt":
      return renderLegacyModal(CombinedReceiptModal, { open, onOpenChange, ...props });
    case "credit_note":
      return renderLegacyModal(CreditNoteModal, { open, onOpenChange, ...props });
    case "debit_note":
      return renderLegacyModal(DebitNoteModal, { open, onOpenChange, ...props });
    case "deposit":
      return renderLegacyModal(DepositDocumentModal, { open, onOpenChange, ...props });
    case "installment":
      return renderLegacyModal(InstallmentModal, { open, onOpenChange, ...props });
    default:
      return null;
  }
};

export const ExpenseDocumentModal = ({
  kind,
  open,
  onOpenChange,
  ...props
}: BaseModalProps & { kind: ExpenseDocumentModalKind } & PassthroughProps) => {
  switch (kind) {
    case "expense":
      return renderLegacyModal(ExpenseModal, { open, onOpenChange, ...props });
    case "purchase_order":
      return renderLegacyModal(PurchaseOrderModal, { open, onOpenChange, ...props });
    case "receive":
      return renderLegacyModal(NewReceiveModal, { open, onOpenChange, ...props });
    case "withholding_tax":
      return renderLegacyModal(WithholdingTaxModal, { open, onOpenChange, ...props });
    default:
      return null;
  }
};

export const PaymentActionModal = ({
  kind,
  open,
  onOpenChange,
  ...props
}: BaseModalProps & { kind: PaymentActionModalKind } & PassthroughProps) => {
  if (kind === "finance_movement") {
    return renderLegacyModal(FinanceMovementModal, { open, onOpenChange, ...props });
  }
  return renderLegacyModal(PaymentModal, { open, onOpenChange, ...props });
};

export const MasterDataModal = ({
  kind,
  open,
  onOpenChange,
  ...props
}: BaseModalProps & { kind: MasterDataModalKind } & {
  customer?: Customer | null;
  vendor?: Vendor | null;
  project?: Project | null;
  account?: FinanceAccount | null;
} & PassthroughProps) => {
  switch (kind) {
    case "customer":
      return renderLegacyModal(CustomerModal, { open, onOpenChange, ...props });
    case "vendor":
      return renderLegacyModal(VendorModal, { open, onOpenChange, ...props });
    case "product":
      return renderLegacyModal(ProductModal, { open, onOpenChange, ...props });
    case "project":
      return renderLegacyModal(ProjectModal, { open, onOpenChange, ...props });
    case "financial_account":
      return renderLegacyModal(AccountModal, { open, onOpenChange, ...props });
    default:
      return null;
  }
};

export const InventoryActionModal = ({
  kind,
  open,
  onOpenChange,
  ...props
}: BaseModalProps & { kind: InventoryActionModalKind } & PassthroughProps) => {
  if (kind === "receive") {
    return renderLegacyModal(NewReceiveModal, { open, onOpenChange, ...props });
  }
  return renderLegacyModal(StockAdjustmentModal, { open, onOpenChange, ...props });
};

export const IntegrationModal = ({
  kind,
  open,
  onOpenChange,
  ...props
}: BaseModalProps & { kind: IntegrationModalKind } & PassthroughProps) => {
  if (kind === "connection") {
    return renderLegacyModal(IntegrationConfigModal, { open, onOpenChange, ...props });
  }
  return null;
};

export const UserAccessModal = ({
  kind,
  open,
  onOpenChange,
  ...props
}: BaseModalProps & { kind: UserAccessModalKind } & PassthroughProps) => {
  if (kind === "invite_user") {
    return renderLegacyModal(UserInviteModal, { open, onOpenChange, ...props });
  }
  return null;
};

export const EvidenceAttachmentModal = ({
  open,
  onOpenChange,
  onSaved,
  ...props
}: BaseModalProps & {
  onSaved?: (attachments: Attachment[]) => void;
} & PassthroughProps) => (
  <AttachEvidenceModal open={open} onOpenChange={onOpenChange} onSaved={onSaved} {...props} />
);

export const ConfigurableActionModal = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel = "Continue",
  onConfirm,
}: BaseModalProps & {
  title: string;
  description?: string;
  children?: ReactNode;
  confirmLabel?: string;
  onConfirm?: () => void | Promise<void>;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      {children}
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button onClick={() => void onConfirm?.()}>{confirmLabel}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export const ConfigurableActionDrawer = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel = "Continue",
  onConfirm,
}: BaseModalProps & {
  title: string;
  description?: string;
  children?: ReactNode;
  confirmLabel?: string;
  onConfirm?: () => void | Promise<void>;
}) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent>
      <SheetHeader>
        <SheetTitle>{title}</SheetTitle>
        {description ? <SheetDescription>{description}</SheetDescription> : null}
      </SheetHeader>
      <div className="mt-6">{children}</div>
      <SheetFooter className="mt-6">
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button onClick={() => void onConfirm?.()}>{confirmLabel}</Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
);

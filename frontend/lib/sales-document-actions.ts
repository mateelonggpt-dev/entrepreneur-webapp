import { inferSalesDocumentTypes } from "@/lib/document-sections";
import type { DocumentKind, DocumentSummary } from "@/lib/types";

export type SalesDocumentActionId =
  | "create_from_reference"
  | "view"
  | "edit"
  | "download_pdf"
  | "duplicate"
  | "duplicate_recreate"
  | "submit_for_approval"
  | "delete"
  | "cancel_request"
  | "approve"
  | "reject"
  | "cancel_void"
  | "create_revision"
  | "create_invoice"
  | "create_deposit_invoice"
  | "create_installment"
  | "create_delivery_note"
  | "create_billing_note"
  | "create_tax_invoice"
  | "create_receipt"
  | "create_receipt_remaining"
  | "record_payment"
  | "create_credit_note"
  | "create_debit_note"
  | "view_related_documents"
  | "view_related_invoice"
  | "view_related_invoices"
  | "view_receipt"
  | "view_payment_history"
  | "view_payment_details"
  | "attach_evidence"
  | "view_evidence"
  | "remove_document"
  | "apply_to_invoice"
  | "view_application_history";

export type SalesDocumentActionGroup = "open" | "workflow" | "approval" | "related" | "danger";

export interface SalesDocumentAction {
  id: SalesDocumentActionId;
  label: string;
  group: SalesDocumentActionGroup;
}

type SalesDocumentActionType =
  | "quotation"
  | "delivery_note"
  | "invoice"
  | "tax_invoice"
  | "billing_note"
  | "receipt"
  | "credit_note"
  | "debit_note"
  | "deposit";

type SalesDocumentStatusGroup =
  | "draft"
  | "pending"
  | "approved"
  | "partial"
  | "paid"
  | "completed"
  | "cancelled"
  | "applied";

const LABELS: Partial<Record<SalesDocumentActionId, string>> = {
  view: "View / ดูเอกสาร",
  edit: "Edit / แก้ไข",
  download_pdf: "Download PDF / ดาวน์โหลด PDF",
  duplicate: "Duplicate / คัดลอกเอกสาร",
  duplicate_recreate: "Duplicate / Recreate / คัดลอกเอกสาร",
  submit_for_approval: "Submit for Approval / ส่งอนุมัติ",
  delete: "Delete / ลบ",
  cancel_request: "Cancel Request / ยกเลิกคำขอ",
  approve: "Approve / อนุมัติ",
  reject: "Reject / ปฏิเสธ",
  cancel_void: "Cancel / Void / ยกเลิก",
  create_revision: "Create Revision / สร้างฉบับแก้ไข",
  create_invoice: "Create Invoice / สร้างใบแจ้งหนี้",
  create_deposit_invoice: "Create Deposit Invoice / สร้างใบแจ้งหนี้เงินมัดจำ",
  create_installment: "Create Installment / สร้างการผ่อนชำระ",
  create_delivery_note: "Create Delivery Note / สร้างใบส่งของ",
  create_billing_note: "Create Billing Note / สร้างใบวางบิล",
  create_tax_invoice: "Create Tax Invoice / สร้างใบกำกับภาษี",
  create_receipt: "Create Receipt / สร้างใบเสร็จรับเงิน",
  create_receipt_remaining: "Create Receipt for Remaining Amount / สร้างใบเสร็จยอดคงเหลือ",
  record_payment: "Record Payment / บันทึกการชำระเงิน",
  create_credit_note: "Create Credit Note / สร้างใบลดหนี้",
  create_debit_note: "Create Debit Note / สร้างใบเพิ่มหนี้",
  view_related_documents: "View Related Documents / ดูเอกสารที่เกี่ยวข้อง",
  view_related_invoice: "View Related Invoice / ดูใบแจ้งหนี้ที่เกี่ยวข้อง",
  view_related_invoices: "View Related Invoices / ดูใบแจ้งหนี้ที่เกี่ยวข้อง",
  view_receipt: "View Receipt / ดูใบเสร็จรับเงิน",
  view_payment_history: "View Payment History / ดูประวัติการชำระเงิน",
  view_payment_details: "View Payment Details / ดูรายละเอียดการชำระเงิน",
  apply_to_invoice: "Apply to Invoice / นำไปใช้กับใบแจ้งหนี้",
  view_application_history: "View Application History / ดูประวัติการใช้งาน",
};

const GROUPS: Partial<Record<SalesDocumentActionId, SalesDocumentActionGroup>> = {
  view: "open",
  edit: "open",
  download_pdf: "open",
  duplicate: "open",
  duplicate_recreate: "open",
  submit_for_approval: "approval",
  delete: "danger",
  cancel_request: "approval",
  approve: "approval",
  reject: "approval",
  cancel_void: "danger",
  create_revision: "workflow",
  create_invoice: "workflow",
  create_deposit_invoice: "workflow",
  create_installment: "workflow",
  create_delivery_note: "workflow",
  create_billing_note: "workflow",
  create_tax_invoice: "workflow",
  create_receipt: "workflow",
  create_receipt_remaining: "workflow",
  record_payment: "workflow",
  create_credit_note: "workflow",
  create_debit_note: "workflow",
  view_related_documents: "related",
  view_related_invoice: "related",
  view_related_invoices: "related",
  view_receipt: "related",
  view_payment_history: "related",
  view_payment_details: "related",
  apply_to_invoice: "workflow",
  view_application_history: "related",
};

const action = (id: SalesDocumentActionId): SalesDocumentAction => ({
  id,
  label: LABELS[id] ?? id.replace(/_/g, " "),
  group: GROUPS[id] ?? "open",
});

const baseOpenActions = (includeEdit: boolean) =>
  [
    "view",
    includeEdit ? "edit" : "create_revision",
    "download_pdf",
    "duplicate",
  ].map((id) => action(id as SalesDocumentActionId));

const normalizeStatus = (status: string): SalesDocumentStatusGroup => {
  const value = status.toLowerCase().replace(/[\s-]+/g, "_");
  if (["cancelled", "canceled", "void", "inactive", "rejected"].includes(value)) return "cancelled";
  if (["draft"].includes(value)) return "draft";
  if (["pending", "pending_approval"].includes(value)) return "pending";
  if (["partial", "partially_paid"].includes(value)) return "partial";
  if (["paid"].includes(value)) return "paid";
  if (["completed", "converted", "billed", "invoiced"].includes(value)) return "completed";
  if (["applied"].includes(value)) return "applied";
  return "approved";
};

export const getSalesDocumentActionType = (document: DocumentSummary): SalesDocumentActionType => {
  const explicitTypes = document.documentTypes ?? [];
  const types = explicitTypes.length ? explicitTypes : inferSalesDocumentTypes(document);
  if (types.includes("delivery_note")) return "delivery_note";
  if (types.includes("billing_note")) return "billing_note";
  if (types.includes("quotation")) return "quotation";
  if (types.includes("receipt")) return "receipt";
  if (types.includes("credit_note")) return "credit_note";
  if (types.includes("debit_note")) return "debit_note";
  if (document.kind === "invoice" && !explicitTypes.length) return "invoice";
  if (types.includes("tax_invoice") && !types.includes("invoice")) return "tax_invoice";
  if (types.includes("invoice")) return "invoice";
  if (document.kind === "billing") return "billing_note";
  return document.kind as SalesDocumentActionType;
};

export const getActionSourceKind = (document: DocumentSummary): DocumentKind => {
  if (document.kind === "billing") return "billing";
  return document.kind;
};

export const getSalesDocumentActions = (
  document: DocumentSummary,
  options: { canApprove?: boolean; allowApprovedEdit?: boolean } = {}
) => {
  const type = getSalesDocumentActionType(document);
  const status = normalizeStatus(document.status);
  const canApprove = options.canApprove ?? true;
  const allowApprovedEdit = options.allowApprovedEdit ?? true;

  if (status === "draft") {
    return [
      action("view"),
      action("edit"),
      action("download_pdf"),
      action("duplicate"),
      action("submit_for_approval"),
      action("delete"),
    ];
  }

  if (status === "pending") {
    return [
      action("view"),
      action("download_pdf"),
      action("duplicate"),
      action("cancel_request"),
      ...(canApprove ? [action("approve"), action("reject")] : []),
    ];
  }

  if (status === "cancelled") {
    return [action("view"), action("download_pdf"), action("duplicate_recreate")];
  }

  if (status === "partial") {
    if (["invoice", "tax_invoice"].includes(type)) {
      return [
        action("view"),
        action("download_pdf"),
        action("duplicate"),
        action("create_receipt_remaining"),
        action("record_payment"),
        action("create_credit_note"),
        action("create_debit_note"),
        action("view_payment_history"),
      ];
    }
    if (type === "billing_note") {
      return [
        action("view"),
        action("download_pdf"),
        action("duplicate"),
        action("create_receipt_remaining"),
        action("record_payment"),
        action("view_payment_history"),
      ];
    }
  }

  if (status === "paid" || status === "completed" || status === "applied") {
    if (type === "quotation") {
      return [
        action("view"),
        action("download_pdf"),
        action("duplicate"),
        action("view_related_documents"),
      ];
    }
    if (type === "delivery_note") {
      return [
        action("view"),
        action("download_pdf"),
        action("duplicate"),
        action("view_related_documents"),
      ];
    }
    if (["invoice", "tax_invoice"].includes(type)) {
      return [
        action("view"),
        action("download_pdf"),
        action("duplicate"),
        action("view_receipt"),
        action("view_payment_history"),
        action("create_credit_note"),
        action("create_debit_note"),
      ];
    }
    if (type === "billing_note") {
      return [
        action("view"),
        action("download_pdf"),
        action("duplicate"),
        action("view_receipt"),
        action("view_payment_history"),
      ];
    }
    if (type === "receipt") {
      return [
        action("view"),
        action("download_pdf"),
        action("duplicate"),
        action("view_related_invoice"),
        action("view_payment_details"),
      ];
    }
    if (["credit_note", "debit_note"].includes(type)) {
      return [
        action("view"),
        action("download_pdf"),
        action("duplicate"),
        action("view_related_invoice"),
        action("view_application_history"),
      ];
    }
  }

  if (type === "quotation") {
    return [
      ...baseOpenActions(allowApprovedEdit),
      action("create_invoice"),
      action("create_deposit_invoice"),
      action("create_installment"),
      action("create_delivery_note"),
      action("create_billing_note"),
      action("cancel_void"),
    ];
  }

  if (type === "delivery_note") {
    return [
      ...baseOpenActions(allowApprovedEdit),
      action("create_invoice"),
      action("create_tax_invoice"),
      action("create_receipt"),
      action("cancel_void"),
    ];
  }

  if (["invoice", "tax_invoice", "deposit"].includes(type)) {
    return [
      ...baseOpenActions(allowApprovedEdit),
      action("create_receipt"),
      action("record_payment"),
      ...(type === "invoice" ? [action("create_tax_invoice")] : []),
      action("create_credit_note"),
      action("create_debit_note"),
      action("cancel_void"),
    ];
  }

  if (type === "billing_note") {
    return [
      ...baseOpenActions(allowApprovedEdit),
      action("create_receipt"),
      action("record_payment"),
      action("view_related_invoices"),
      action("cancel_void"),
    ];
  }

  if (type === "receipt") {
    return [
      action("view"),
      action("download_pdf"),
      action("duplicate"),
      action("view_related_invoice"),
      action("cancel_void"),
    ];
  }

  return [
    action("view"),
    action("download_pdf"),
    action("duplicate"),
    action("apply_to_invoice"),
    action("view_related_invoice"),
    ...(type === "debit_note" ? [action("create_receipt"), action("record_payment")] : []),
    action("cancel_void"),
  ];
};

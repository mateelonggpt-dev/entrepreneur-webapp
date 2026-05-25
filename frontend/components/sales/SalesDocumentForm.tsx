import { useEffect, useMemo, useRef, useState, type ElementType, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Building2,
  Calendar,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  FileText,
  Image,
  Languages,
  Link2,
  Loader2,
  PackageSearch,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  Search,
  Send,
  Signature,
  Download,
  StickyNote,
  Trash2,
  UserPlus,
  UserRoundSearch,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SalesDocumentTemplate } from "@/components/documents/SalesDocumentTemplate";
import { HelpHint } from "@/components/ui-kit/HelpHint";
import { PoAttachmentBox } from "@/components/sales/PoAttachmentBox";
import { useAppData } from "@/lib/app-data";
import {
  buildApiUrl,
  createCustomer,
  createDocument,
  createProject,
  createProduct,
  createVendor,
  downloadPreviewImagesPdf,
  fetchDocument,
  fetchCompanySettings,
  fetchSettingsSection,
  saveCompanySettings,
  saveSettingsSection,
  updateCustomer,
  updateVendor,
  uploadAttachments,
} from "@/lib/api";
import { formatMoney, getEnabledCurrencies, resolveExchangeRate } from "@/lib/currency";
import { createClientId } from "@/lib/document-utils";
import { cn } from "@/lib/utils";
import {
  buildSalesDocumentTitle,
  getPrimarySalesDocumentType,
  getRealDocumentTypes,
  getSalesDocumentNumberPrefix,
  type DocumentLanguage,
} from "@/lib/document-sections";
import type { BrandingSettings, CompanySettings, Customer, DocumentKind, DocumentSettings, Product, SalesDocumentRecord, TeamMember, UsersSettings, Vendor } from "@/lib/types";

type SalesDocumentMode = "draft" | "create" | "edit";
type CopyGeneration = "both" | "original" | "copy";
type CustomerMode = "existing" | "new";
type SaveScope = "document" | "profile";
type PaymentMethodChoice = "Bank Transfer" | "Cash" | "Credit Card" | "Cheque" | "PromptPay" | "Other";
type DiscountType = "percent" | "amount";
type InvoicePaymentMode = "full_payment" | "partial_payment" | "deposit";
type PaymentScheduleRow = {
  id: string;
  label: string;
  type: DiscountType;
  value: number;
  percent?: number;
  amount: number;
  dueDate?: string;
};
type RemarkTemplate = {
  id: string;
  name: string;
  content: string;
  language: "th" | "en" | "both";
  documentTypes: string[];
  isDefault?: boolean;
};
type FieldErrors = Record<string, string>;
type ReferenceImportAction = "link" | "replace" | "merge";

type ReferenceOption = {
  id: string;
  kind: DocumentKind;
  documentTypes?: string[];
  party: string;
  date: string;
  amount: number;
  status: string;
  suggested: boolean;
};

type PaymentDetails = {
  selectedBankAccountId: string;
  bankAccount: string;
  accountName: string;
  accountNumber: string;
  transferReference: string;
  chequeNumber: string;
  chequeBankName: string;
  chequeDate: string;
  cardType: string;
  approvalCode: string;
  promptPayId: string;
  otherNote: string;
};

type CompanyBankAccount = NonNullable<CompanySettings["bankAccounts"]>[number];

type Line = {
  id: string;
  sku: string;
  inventoryId?: string;
  originalInventoryCode?: string;
  desc: string;
  details: string;
  qty: number;
  unit: string;
  price: number;
  discountType?: DiscountType;
  discountValue?: number;
  discountAmount?: number;
  discount: number;
  tax: number;
  vatRate?: number;
  vatAmount?: number;
  withholdingRate?: number;
  withholdingAmount?: number;
  sourceDocumentId?: string;
  sourceDocumentType?: string;
  sourceLineId?: string;
  productType?: string;
  availableStock?: number | null;
  addAsProduct?: boolean;
  stockOverrideAcknowledged?: boolean;
};

type TaxRateGroup = {
  rate: number;
  taxableBase: number;
  taxAmount: number;
};

type DocumentTaxMode = NonNullable<DocumentSettings["taxMode"]>;

const defaultDocumentSettingsSnapshot: DocumentSettings = {
  headerTitle: "",
  quotationHeaderTitle: "",
  receiptHeaderTitle: "",
  footerNote: "",
  defaultTerms: "",
  taxMode: "exclusive",
  showSignatureLine: true,
  perLineVat: false,
  perLineDiscount: true,
  showWhtFooter: false,
  perLineWithholdingTax: false,
  receiptAdjustmentFooter: false,
  accountantExpenseCategory: true,
  compactReceiptMode: false,
};

type PartyInfo = {
  code: string;
  name: string;
  address: string;
  taxId: string;
  branch: string;
  contactPerson: string;
  phone: string;
  email: string;
  website?: string;
  note?: string;
  businessType?: "corporation" | "individual";
  contactTypes?: Array<"client" | "supplier">;
  location?: "thailand" | "foreign";
  creditDays?: number;
  zipCode?: string;
  branchType?: "head_office" | "branch";
  branchCode?: string;
  branchName?: string;
  mobile?: string;
  position?: string;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankBranchCode?: string;
  bankBranchName?: string;
  bankAccountType?: "savings" | "current";
  qrPaymentUrl?: string;
  hasForeignBankInfo?: boolean;
  swiftCode?: string;
  bankAddress?: string;
  iban?: string;
  bankCountry?: string;
  lineId?: string;
  tags?: string;
  internalRemark?: string;
  defaultCurrency?: string;
  defaultPaymentTerms?: string;
  defaultWithholdingTax?: string;
};

interface SalesDocumentFormProps {
  selectedDocumentTypes?: string[];
  selectedTypes?: string[];
  documentTitle?: string;
  language?: DocumentLanguage;
  mode?: SalesDocumentMode;
  initialSourceDocumentId?: string;
  initialSourceDocumentType?: DocumentKind;
  initialDuplicateDocumentId?: string;
  initialDuplicateDocumentType?: DocumentKind;
  initialTaxInvoice?: boolean;
  initialInvoicePaymentMode?: InvoicePaymentMode;
}

const defaultSeller: PartyInfo = {
  code: "",
  name: "",
  address: "",
  taxId: "",
  branch: "",
  contactPerson: "",
  phone: "",
  email: "",
  website: "",
  businessType: "corporation",
  contactTypes: ["client"],
  location: "thailand",
  creditDays: 0,
  branchType: "head_office",
  branchCode: "",
  branchName: "Head Office",
  bankAccountType: "savings",
  hasForeignBankInfo: false,
};

const blankCustomer: PartyInfo = {
  code: "",
  name: "",
  address: "",
  taxId: "",
  branch: "Head Office",
  contactPerson: "",
  phone: "",
  email: "",
  note: "",
  businessType: "corporation",
  contactTypes: ["client"],
  location: "thailand",
  creditDays: 0,
  branchType: "head_office",
  branchCode: "",
  branchName: "Head Office",
  bankAccountType: "savings",
  hasForeignBankInfo: false,
};

const paymentMethodOptions: PaymentMethodChoice[] = [
  "Bank Transfer",
  "Cash",
  "Credit Card",
  "Cheque",
  "PromptPay",
  "Other",
];
const whtRateOptions = [0, 1, 2, 3, 5];
const vatRateOptions = [
  { value: "7", label: "7%" },
  { value: "0", label: "0%" },
  { value: "exempt", label: "Exempt / ยกเว้น" },
];
const standardCreditTerms = ["0", "7", "15", "30", "45", "60"];
const defaultRemarkTemplates: RemarkTemplate[] = [
  {
    id: "default-payment",
    name: "Payment terms",
    content: "Please follow the payment terms shown on this document.",
    language: "en",
    documentTypes: ["all"],
    isDefault: true,
  },
  {
    id: "default-transfer",
    name: "Bank transfer",
    content: "Please transfer payment to the bank account shown above.",
    language: "en",
    documentTypes: ["invoice", "tax_invoice", "billing_note", "receipt"],
  },
  {
    id: "default-delivery",
    name: "Goods received",
    content: "Goods received in good condition.",
    language: "en",
    documentTypes: ["delivery_note"],
  },
  {
    id: "default-quotation",
    name: "Quotation validity",
    content: "This quotation is valid for 30 days.",
    language: "en",
    documentTypes: ["quotation"],
  },
  {
    id: "default-warranty",
    name: "Warranty",
    content: "Warranty terms follow company policy.",
    language: "en",
    documentTypes: ["all"],
  },
  {
    id: "default-th-payment",
    name: "เงื่อนไขการชำระเงิน",
    content: "กรุณาชำระเงินตามเงื่อนไขที่ระบุในเอกสารนี้",
    language: "th",
    documentTypes: ["all"],
  },
];

const copyOptions: Array<{ value: CopyGeneration; en: string; th: string }> = [
  { value: "both", en: "Original + Copy", th: "ต้นฉบับ + สำเนา" },
  { value: "original", en: "Original only", th: "ต้นฉบับเท่านั้น" },
  { value: "copy", en: "Copy only", th: "สำเนาเท่านั้น" },
];

const docLabels = {
  en: {
    required: "Required",
    seller: "Seller",
    customer: "Customer",
    loadedFromSettings: "Loaded from Company Settings",
    companyIncomplete: "Company profile is incomplete.",
    settings: "Settings",
    createNew: "Create new",
    searchCustomer: "Search/select customer",
    expandCustomer: "Expand for address, tax ID, branch, contact, phone, and email.",
    documentDetails: "Document Details",
    invoiceType: "Invoice type",
    normalInvoice: "Normal invoice",
    taxInvoice: "Tax invoice",
    paymentMode: "Payment mode",
    fullPayment: "Full payment",
    partialPayment: "Partial payment",
    deposit: "Deposit",
    depositAmount: "Deposit amount",
    depositPercent: "Deposit percent",
    paymentSchedule: "Payment schedule",
    addPaymentRow: "Add payment row",
    installment: "Installment",
    percent: "Percent",
    amount: "Amount",
    dueDateLabel: "Due date",
    remainingBalance: "Remaining balance",
    deductDeposit: "Deduct deposit",
    deductPaidAmount: "Deduct paid amount",
    paymentScheduleTotalError: "Payment schedule cannot exceed remaining balance",
    originalTotal: "Original total",
    alreadyPaid: "Already paid",
    paidPercent: "Paid percent",
    paidAmount: "Paid amount",
    thisPayment: "This payment",
    currentPaymentPercent: "Current payment percent",
    currentPaymentAmount: "Current payment amount",
    remainingPercent: "Remaining percent",
    setupPaymentSchedule: "Set up payment schedule",
    applyDepositLine: "Apply deposit line",
    issueDate: "Issue date",
    dueDate: "Due date",
    creditTerm: "Credit term",
    customDays: "Custom days",
    reference: "Reference",
    internalReferenceDocument: "Internal reference document",
    customerReference: "Customer PO / Reference No.",
    searchReferenceDocuments: "Search reference documents",
    addReference: "Add reference",
    relatedDocument: "Related document",
    referenceDocuments: "Reference documents",
    addReferenceDocument: "Add reference document",
    removeReference: "Remove reference",
    selectReferenceDocument: "Select reference document",
    incompatibleDocumentType: "Incompatible document type",
    notCompatible: "Not compatible",
    sourceDocument: "Source document",
    relatedDocuments: "Related documents",
    referencedInvoices: "Referenced invoices",
    referencedQuotations: "Referenced quotations",
    documentContact: "Seller",
    currency: "Currency",
    code: "Code",
    descriptionDetail: "Description / Detail",
    description: "Description",
    detail: "Detail / extra description",
    quantity: "Qty",
    unit: "Unit",
    unitPrice: "Unit price",
    discount: "Discount",
    vat: "VAT",
    wht: "WHT",
    whtAmount: "WHT amount",
    totalWithholdingTax: "Total withholding tax",
    amountAfterWithholding: "Amount after withholding",
    vatDisabledMessage: "VAT options are disabled because this company is not VAT registered.",
    total: "Total",
    addLine: "Add line",
    payment: "Payment",
    paymentMethod: "Payment method",
    paymentNote: "Payment note/reference",
    companyBankAccount: "Company bank account",
    bankScope: "Adding a bank account here updates Company Settings for future documents.",
    addBank: "Add new bank account",
    noBank: "No bank account registered. Add one to show payment details on this document.",
    paymentTerms: "Payment terms / instruction",
    notes: "Notes",
    customerNote: "Customer note / remark",
    internalNote: "Internal note",
    summary: "Summary",
    withholding: "Withholding tax %",
    amountPaid: "Amount already paid",
    amountWords: "Amount in words",
    customerAck: "Customer acknowledgement",
    customerAcceptance: "Customer acceptance",
    issuer: "Issuer / prepared by",
    approver: "Approver / authorized signature",
    preview: "Preview Document",
    editedCustomer: "You edited this customer's details. Apply changes only to this document or update the customer profile?",
    editedSeller: "You edited seller details. Apply changes only to this document or update the company profile?",
    docOnly: "Use for this document only",
    updateCustomerProfile: "Update customer profile",
    updateCompanyProfile: "Update company profile",
    editCustomer: "Edit customer",
    editSeller: "Edit seller",
    createCustomer: "Create customer",
    project: "Project",
    createProject: "Create project",
    projectName: "Project name",
    projectCode: "Project code",
    startDate: "Start date",
    endDate: "End date",
    status: "Status",
    chooseRemark: "Choose saved remark",
    saveRemarkTemplate: "Save as template",
    customerFacingNote: "Appears on the document",
    internalOnlyNote: "Internal only, not shown on customer PDF",
    missingRequired: "required fields missing",
    approved: "Approved",
    draft: "Draft",
    pendingApproval: "Pending approval",
    paid: "Paid",
    partiallyPaid: "Partially paid",
    cancelled: "Cancelled",
  },
  th: {
    required: "จำเป็น",
    seller: "ผู้ขาย",
    customer: "ลูกค้า",
    loadedFromSettings: "โหลดจากการตั้งค่าบริษัท",
    companyIncomplete: "ข้อมูลบริษัทไม่ครบถ้วน",
    settings: "ตั้งค่า",
    createNew: "สร้างใหม่",
    searchCustomer: "ค้นหา/เลือกลูกค้า",
    expandCustomer: "ขยายเพื่อดูที่อยู่ เลขภาษี สาขา ผู้ติดต่อ โทรศัพท์ และอีเมล",
    documentDetails: "ข้อมูลเอกสาร",
    invoiceType: "ประเภทใบแจ้งหนี้",
    normalInvoice: "ใบวางบิล/ใบแจ้งหนี้",
    taxInvoice: "ใบกำกับภาษี",
    paymentMode: "รูปแบบการชำระเงิน",
    fullPayment: "จ่ายเต็มจำนวน",
    partialPayment: "แบ่งจ่าย",
    deposit: "มัดจำ",
    depositAmount: "ยอดมัดจำ",
    depositPercent: "เปอร์เซ็นต์มัดจำ",
    paymentSchedule: "ตารางชำระ",
    addPaymentRow: "เพิ่มงวดชำระ",
    installment: "งวดที่",
    percent: "เปอร์เซ็นต์",
    amount: "จำนวนเงิน",
    dueDateLabel: "วันที่ครบกำหนด",
    remainingBalance: "ยอดคงเหลือ",
    deductDeposit: "หักเงินมัดจำ",
    deductPaidAmount: "หักยอดที่ชำระแล้ว",
    paymentScheduleTotalError: "ยอดรวมงวดต้องไม่เกินยอดคงเหลือ",
    originalTotal: "ยอดเต็ม",
    alreadyPaid: "ชำระแล้ว",
    paidPercent: "เปอร์เซ็นต์ที่ชำระแล้ว",
    paidAmount: "ยอดที่ชำระแล้ว",
    thisPayment: "งวดนี้",
    currentPaymentPercent: "เปอร์เซ็นต์งวดนี้",
    currentPaymentAmount: "ยอดชำระงวดนี้",
    remainingPercent: "เปอร์เซ็นต์คงเหลือ",
    setupPaymentSchedule: "ตั้งค่าตารางชำระ",
    applyDepositLine: "ใช้รายการมัดจำ",
    issueDate: "วันที่ออก",
    dueDate: "วันครบกำหนด",
    creditTerm: "เครดิต",
    customDays: "จำนวนวัน",
    reference: "เลขที่อ้างอิง",
    internalReferenceDocument: "เอกสารอ้างอิงในระบบ",
    customerReference: "เลขที่ PO ลูกค้า / เลขอ้างอิง",
    searchReferenceDocuments: "ค้นหาเอกสารอ้างอิง",
    addReference: "เพิ่มเอกสารอ้างอิง",
    relatedDocument: "เอกสารที่เกี่ยวข้อง",
    referenceDocuments: "เอกสารอ้างอิง",
    addReferenceDocument: "เพิ่มเอกสารอ้างอิง",
    removeReference: "ลบเอกสารอ้างอิง",
    selectReferenceDocument: "เลือกเอกสารอ้างอิง",
    incompatibleDocumentType: "ประเภทเอกสารไม่สามารถใช้อ้างอิงได้",
    notCompatible: "ไม่สามารถใช้อ้างอิงได้",
    sourceDocument: "เอกสารต้นทาง",
    relatedDocuments: "เอกสารที่เกี่ยวข้อง",
    referencedInvoices: "ใบแจ้งหนี้ที่อ้างอิง",
    referencedQuotations: "ใบเสนอราคาที่อ้างอิง",
    documentContact: "ผู้ขาย",
    currency: "สกุลเงิน",
    code: "รหัส",
    descriptionDetail: "คำอธิบาย / รายละเอียด",
    description: "คำอธิบาย",
    detail: "รายละเอียดเพิ่มเติม",
    quantity: "จำนวน",
    unit: "หน่วย",
    unitPrice: "ราคา",
    discount: "ส่วนลด",
    vat: "ภาษีมูลค่าเพิ่ม",
    wht: "หัก ณ ที่จ่าย",
    whtAmount: "ยอดหัก ณ ที่จ่าย",
    totalWithholdingTax: "รวมภาษีหัก ณ ที่จ่าย",
    amountAfterWithholding: "ยอดชำระหลังหัก ณ ที่จ่าย",
    vatDisabledMessage: "ปิดการตั้งค่า VAT เพราะบริษัทนี้ไม่ได้จดทะเบียนภาษีมูลค่าเพิ่ม",
    total: "รวม",
    addLine: "เพิ่มรายการ",
    payment: "การชำระเงิน",
    paymentMethod: "วิธีชำระเงิน",
    paymentNote: "หมายเหตุ/อ้างอิงการชำระเงิน",
    companyBankAccount: "บัญชีธนาคารบริษัท",
    bankScope: "การเพิ่มบัญชีธนาคารที่นี่จะอัปเดตการตั้งค่าบริษัทสำหรับเอกสารในอนาคต",
    addBank: "เพิ่มบัญชีธนาคาร",
    noBank: "ยังไม่มีบัญชีธนาคาร เพิ่มบัญชีเพื่อแสดงข้อมูลชำระเงินบนเอกสาร",
    paymentTerms: "เงื่อนไข/คำแนะนำการชำระเงิน",
    notes: "หมายเหตุ",
    customerNote: "หมายเหตุถึงลูกค้า",
    internalNote: "หมายเหตุภายใน",
    summary: "สรุปยอด",
    withholding: "ภาษีหัก ณ ที่จ่าย %",
    amountPaid: "ยอดที่ชำระแล้ว",
    amountWords: "จำนวนเงินตัวอักษร",
    customerAck: "การรับทราบของลูกค้า",
    customerAcceptance: "ลูกค้าลงนามรับทราบ",
    issuer: "ผู้ออกเอกสาร",
    approver: "ผู้อนุมัติ / ผู้มีอำนาจลงนาม",
    preview: "ดูตัวอย่างเอกสาร",
    editedCustomer: "คุณได้แก้ไขข้อมูลลูกค้า ต้องการใช้เฉพาะเอกสารนี้หรืออัปเดตข้อมูลลูกค้าในระบบ?",
    editedSeller: "คุณได้แก้ไขข้อมูลบริษัท ต้องการใช้เฉพาะเอกสารนี้หรืออัปเดตข้อมูลบริษัทในระบบ?",
    docOnly: "ใช้เฉพาะเอกสารนี้",
    updateCustomerProfile: "อัปเดตข้อมูลลูกค้าในระบบ",
    updateCompanyProfile: "อัปเดตข้อมูลบริษัทในระบบ",
    editCustomer: "แก้ไขลูกค้า",
    editSeller: "แก้ไขผู้ขาย",
    createCustomer: "สร้างลูกค้า",
    project: "โครงการ",
    createProject: "สร้างโครงการ",
    projectName: "ชื่อโครงการ",
    projectCode: "รหัสโครงการ",
    startDate: "วันที่เริ่ม",
    endDate: "วันที่สิ้นสุด",
    status: "สถานะ",
    chooseRemark: "เลือกเทมเพลต",
    saveRemarkTemplate: "บันทึกเป็นเทมเพลต",
    customerFacingNote: "แสดงบนเอกสาร",
    internalOnlyNote: "ใช้ภายในเท่านั้น ไม่แสดงบน PDF ลูกค้า",
    missingRequired: "ช่องจำเป็นยังไม่ครบ",
    approved: "อนุมัติแล้ว",
    draft: "แบบร่าง",
    pendingApproval: "รออนุมัติ",
    paid: "ชำระแล้ว",
    partiallyPaid: "ชำระบางส่วน",
    cancelled: "ยกเลิก",
  },
} as const;

const windows1252SpecialBytes: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

const repairMojibake = (value: string) => {
  if (!/[\u00e0\u00c2]/.test(value)) return value;
  try {
    const bytes = Array.from(value, (char) => {
      const code = char.charCodeAt(0);
      return code <= 0xff ? code : windows1252SpecialBytes[code] ?? 0x3f;
    });
    return new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(bytes));
  } catch {
    return value;
  }
};

const repairLabelObject = <T extends Record<string, string>>(labels: T): T =>
  Object.fromEntries(Object.entries(labels).map(([key, value]) => [key, repairMojibake(value)])) as T;

const localizedDocLabels = {
  en: docLabels.en,
  th: repairLabelObject(docLabels.th),
} as const;

const localizedCopyOptions = copyOptions.map((option) => ({
  ...option,
  th: repairMojibake(option.th),
}));

const emptyPaymentDetails: PaymentDetails = {
  selectedBankAccountId: "",
  bankAccount: "",
  accountName: "",
  accountNumber: "",
  transferReference: "",
  chequeNumber: "",
  chequeBankName: "",
  chequeDate: "",
  cardType: "",
  approvalCode: "",
  promptPayId: "",
  otherNote: "",
};

const todayText = () => new Date().toISOString().slice(0, 10);
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const formatNumber = (value: number) =>
  value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sanitizeWholePercent = (value: string | number | undefined | null) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(Math.max(Math.trunc(numeric), 0), 100);
};
const formatPercent = (value: number) => `${sanitizeWholePercent(value)}%`;
const clampNumericPercent = (value: string | number) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(Math.max(numeric, 0), 100);
};
const clampWholePercent = (value: string | number) => sanitizeWholePercent(value);
const sanitizeWhtRate = (value: string | number | undefined | null) => {
  const rate = sanitizeWholePercent(value);
  return whtRateOptions.includes(rate) ? rate : 0;
};

const resolveAssetUrl = (value = "") => (!value ? "" : value.startsWith("http") ? value : buildApiUrl(value));

const calculateVatSplit = (amount: number, ratePercent: number, _taxMode: DocumentTaxMode) => {
  const safeAmount = roundMoney(Math.max(Number(amount) || 0, 0));
  const rate = sanitizeWholePercent(ratePercent) / 100;
  const vatAmount = roundMoney(safeAmount * rate);
  return {
    amountBeforeVat: safeAmount,
    vatAmount,
    lineTotal: safeAmount,
    totalAmount: safeAmount,
  };
};

const lineAmounts = (
  line: Line,
  {
    vatEnabled = true,
    taxMode = "exclusive",
    perLineDiscount = true,
    defaultTaxRate = 7,
    withholdingRate = 0,
    withholdingEnabled = false,
    lineDiscountType,
  }: {
    vatEnabled?: boolean;
    taxMode?: DocumentTaxMode;
    perLineDiscount?: boolean;
    defaultTaxRate?: number;
    withholdingRate?: number;
    withholdingEnabled?: boolean;
    lineDiscountType?: DiscountType;
  } = {}
) => {
  const subtotal = roundMoney((Number(line.qty) || 0) * (Number(line.price) || 0));
  const effectiveLineDiscountType = lineDiscountType ?? line.discountType ?? "percent";
  const lineDiscountValue = Number(line.discountValue ?? line.discount) || 0;
  const rawDiscount =
    effectiveLineDiscountType === "amount" ? lineDiscountValue : roundMoney(subtotal * (lineDiscountValue / 100));
  const discountAmount = perLineDiscount ? roundMoney(Math.min(Math.max(rawDiscount, 0), subtotal)) : 0;
  const taxableInput = roundMoney(Math.max(subtotal - discountAmount, 0));
  const vatRate = vatEnabled ? sanitizeWholePercent(line.vatRate ?? line.tax ?? defaultTaxRate) : 0;
  const vat = vatEnabled ? calculateVatSplit(taxableInput, vatRate, taxMode) : calculateVatSplit(taxableInput, 0, taxMode);
  const lineWithholdingRate = withholdingEnabled ? sanitizeWhtRate(withholdingRate) : 0;
  return {
    subtotal,
    discountAmount,
    ...vat,
    vatRate,
    withholdingRate: lineWithholdingRate,
    withholdingAmount: roundMoney(vat.amountBeforeVat * (lineWithholdingRate / 100)),
  };
};

const addTaxGroup = (groups: Map<number, TaxRateGroup>, rate: number, taxableBase: number, taxAmount: number) => {
  const safeRate = sanitizeWholePercent(rate);
  const current = groups.get(safeRate) ?? { rate: safeRate, taxableBase: 0, taxAmount: 0 };
  groups.set(safeRate, {
    rate: safeRate,
    taxableBase: roundMoney(current.taxableBase + taxableBase),
    taxAmount: roundMoney(current.taxAmount + taxAmount),
  });
};

const sortedTaxGroups = (groups: Map<number, TaxRateGroup>, includeZero = false) =>
  Array.from(groups.values())
    .filter((group) => group.taxAmount > 0 || (includeZero && group.taxableBase > 0))
    .sort((left, right) => right.rate - left.rate);

const summarizeLines = (
  lines: Line[],
  {
    vatEnabled,
    discountType,
    discountValue,
    withholdingEnabled,
    withholdingRate,
    perLineWithholding,
    amountPaid,
    taxMode,
    perLineDiscount,
    defaultTaxRate,
    lineDiscountType,
  }: {
    vatEnabled: boolean;
    discountType: DiscountType;
    discountValue: number;
    withholdingEnabled: boolean;
    withholdingRate: number;
    perLineWithholding: boolean;
    amountPaid: number;
    taxMode: DocumentTaxMode;
    perLineDiscount: boolean;
    defaultTaxRate: number;
    lineDiscountType: DiscountType;
  }
) => {
  const subtotalBeforeDiscount = roundMoney(
    lines.reduce((current, line) => current + (Number(line.qty) || 0) * (Number(line.price) || 0), 0)
  );
  const lineDiscountTotal = perLineDiscount
    ? roundMoney(lines.reduce((current, line) => current + lineAmounts(line, { vatEnabled: false, perLineDiscount: true, lineDiscountType }).discountAmount, 0))
    : 0;
  const documentDiscount = roundMoney(
    discountType === "percent"
      ? subtotalBeforeDiscount * (Math.max(Number(discountValue) || 0, 0) / 100)
      : Math.min(Math.max(Number(discountValue) || 0, 0), subtotalBeforeDiscount)
  );
  const totalDiscount = perLineDiscount ? lineDiscountTotal : documentDiscount;
  const discountRatio = !perLineDiscount && subtotalBeforeDiscount > 0 ? documentDiscount / subtotalBeforeDiscount : 0;
  const summary = lines.reduce(
    (current, line) => {
      const lineSubtotal = roundMoney((Number(line.qty) || 0) * (Number(line.price) || 0));
      const lineDiscount = perLineDiscount
        ? lineAmounts(line, { vatEnabled: false, perLineDiscount: true, lineDiscountType }).discountAmount
        : roundMoney(lineSubtotal * discountRatio);
      const taxableInput = roundMoney(Math.max(lineSubtotal - lineDiscount, 0));
      const lineVatRate = vatEnabled ? sanitizeWholePercent(line.vatRate ?? line.tax ?? defaultTaxRate) : 0;
      const vat = vatEnabled ? calculateVatSplit(taxableInput, lineVatRate, taxMode) : calculateVatSplit(taxableInput, 0, taxMode);
      const lineWithholdingRate = withholdingEnabled
        ? sanitizeWhtRate(perLineWithholding ? line.withholdingRate : withholdingRate)
        : 0;
      addTaxGroup(current.vatGroups, lineVatRate, vat.amountBeforeVat, vat.vatAmount);
      addTaxGroup(
        current.withholdingGroups,
        lineWithholdingRate,
        vat.amountBeforeVat,
        lineWithholdingRate > 0 ? roundMoney(vat.amountBeforeVat * (lineWithholdingRate / 100)) : 0
      );
      return {
        vatGroups: current.vatGroups,
        withholdingGroups: current.withholdingGroups,
        amountBeforeVat: roundMoney(current.amountBeforeVat + vat.amountBeforeVat),
        vatAmount: roundMoney(current.vatAmount + vat.vatAmount),
      };
    },
    {
      amountBeforeVat: 0,
      vatAmount: 0,
      vatGroups: new Map<number, TaxRateGroup>(),
      withholdingGroups: new Map<number, TaxRateGroup>(),
    }
  );
  const grandTotal = roundMoney(summary.amountBeforeVat + summary.vatAmount);
  const vatGroups = sortedTaxGroups(summary.vatGroups, vatEnabled);
  const withholdingGroups = sortedTaxGroups(summary.withholdingGroups);
  const withholdingAmount = withholdingEnabled
    ? roundMoney(withholdingGroups.reduce((total, group) => total + group.taxAmount, 0))
    : 0;
  const remainingDue = roundMoney(Math.max(grandTotal - withholdingAmount - (Number(amountPaid) || 0), 0));
  return {
    subtotalBeforeDiscount,
    totalDiscount,
    amountBeforeVat: summary.amountBeforeVat,
    vatAmount: summary.vatAmount,
    vatGroups,
    grandTotal,
    withholdingGroups,
    totalWithholdingTax: withholdingAmount,
    withholdingAmount,
    amountPaid: Number(amountPaid) || 0,
    remainingDue,
  };
};

const thaiDigits = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const thaiPlaces = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

const thaiUnderMillion = (value: number): string => {
  if (value === 0) return "";
  return String(value)
    .split("")
    .map(Number)
    .map((digit, index, digits) => {
      if (digit === 0) return "";
      const place = digits.length - index - 1;
      if (place === 1 && digit === 1) return "สิบ";
      if (place === 1 && digit === 2) return "ยี่สิบ";
      if (place === 0 && digit === 1 && digits.length > 1) return "เอ็ด";
      return `${thaiDigits[digit]}${thaiPlaces[place]}`;
    })
    .join("");
};

const amountInThaiWords = (value: number) => {
  const safeValue = Math.max(roundMoney(value), 0);
  const baht = Math.floor(safeValue);
  const satang = Math.round((safeValue - baht) * 100);
  const million = Math.floor(baht / 1_000_000);
  const rest = baht % 1_000_000;
  const bahtText = `${million ? `${thaiUnderMillion(million)}ล้าน` : ""}${thaiUnderMillion(rest) || "ศูนย์"}บาท`;
  return satang ? `${bahtText}${thaiUnderMillion(satang)}สตางค์` : `${bahtText}ถ้วน`;
};

const amountInEnglishWords = (value: number, currency: string) => `${currency} ${formatNumber(value)} only`;

const fixedThaiDigits = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const fixedThaiPlaces = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

const thaiUnderMillionFixed = (value: number): string => {
  if (value === 0) return "";
  return String(value)
    .split("")
    .map(Number)
    .map((digit, index, digits) => {
      if (digit === 0) return "";
      const place = digits.length - index - 1;
      if (place === 1 && digit === 1) return "สิบ";
      if (place === 1 && digit === 2) return "ยี่สิบ";
      if (place === 0 && digit === 1 && digits.length > 1) return "เอ็ด";
      return `${fixedThaiDigits[digit]}${fixedThaiPlaces[place]}`;
    })
    .join("");
};

const amountInThaiWordsFixed = (value: number) => {
  const safeValue = Math.max(roundMoney(value), 0);
  const baht = Math.floor(safeValue);
  const satang = Math.round((safeValue - baht) * 100);
  const million = Math.floor(baht / 1_000_000);
  const rest = baht % 1_000_000;
  const bahtText = `${million ? `${thaiUnderMillionFixed(million)}ล้าน` : ""}${thaiUnderMillionFixed(rest) || "ศูนย์"}บาท`;
  return satang ? `${bahtText}${thaiUnderMillionFixed(satang)}สตางค์` : `${bahtText}ถ้วน`;
};

const englishSmallNumbers = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const englishTens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

const englishUnderThousand = (value: number): string => {
  if (value < 20) return englishSmallNumbers[value];
  if (value < 100) {
    const tens = Math.floor(value / 10);
    const rest = value % 10;
    return [englishTens[tens], rest ? englishSmallNumbers[rest] : ""].filter(Boolean).join("-");
  }
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  return `${englishSmallNumbers[hundreds]} hundred${rest ? ` ${englishUnderThousand(rest)}` : ""}`;
};

const amountInEnglishIntegerWords = (value: number): string => {
  if (value === 0) return "zero";
  const groups: Array<[number, string]> = [
    [1_000_000_000, "billion"],
    [1_000_000, "million"],
    [1_000, "thousand"],
  ];
  let rest = value;
  const parts: string[] = [];
  groups.forEach(([size, label]) => {
    const count = Math.floor(rest / size);
    if (count) {
      parts.push(`${amountInEnglishIntegerWords(count)} ${label}`);
      rest %= size;
    }
  });
  if (rest) parts.push(englishUnderThousand(rest));
  return parts.join(" ");
};

const amountInEnglishWordsFixed = (value: number, currency: string) => {
  const safeValue = Math.max(roundMoney(value), 0);
  const major = Math.floor(safeValue);
  const minor = Math.round((safeValue - major) * 100);
  const isThb = currency.toUpperCase() === "THB";
  const majorUnit = isThb ? "baht" : currency.toUpperCase();
  const minorUnit = isThb ? "satang" : "cents";
  const text = `${amountInEnglishIntegerWords(major)} ${majorUnit}${minor ? ` and ${amountInEnglishIntegerWords(minor)} ${minorUnit}` : ""} only`;
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const Section = ({
  icon: Icon,
  title,
  helper,
  children,
}: {
  icon: ElementType;
  title: string;
  helper?: string;
  children: ReactNode;
}) => (
  <Card className="card-premium overflow-hidden">
    <header className="flex items-center gap-2 border-b border-border/60 bg-secondary/40 px-5 py-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-brand text-primary-foreground shadow-brand">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h3 className="font-display text-sm font-semibold">{title}</h3>
        {helper ? <p className="mt-0.5 text-xs text-muted-foreground">{helper}</p> : null}
      </div>
    </header>
    <div className="space-y-4 p-5">{children}</div>
  </Card>
);

const TextField = ({
  label,
  value,
  onChange,
  className = "",
  type = "text",
  readOnly = false,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  className?: string;
  type?: string;
  readOnly?: boolean;
}) => (
  <div className="min-w-0">
    <Label>{label}</Label>
    <Input
      type={type}
      value={value}
      readOnly={readOnly}
      onChange={(event) => onChange(event.target.value)}
      className={`mt-1.5 ${readOnly ? "bg-secondary/40" : ""} ${className}`}
    />
  </div>
);

const ReadOnlyValue = ({ label, value, className = "" }: { label: string; value: string | number; className?: string }) => (
  <div className="min-w-0">
    <Label>{label}</Label>
    <div className={`mt-1.5 min-h-9 max-w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 [overflow-wrap:anywhere] ${className}`}>
      {value || "-"}
    </div>
  </div>
);

const PaperBlock = ({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) => (
  <section className={`min-w-0 rounded-lg border border-slate-200 bg-white p-4 ${className}`}>
    {title ? <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p> : null}
    {children}
  </section>
);

const RequiredMark = () => <span className="ml-0.5 text-destructive">*</span>;

const FieldError = ({ message }: { message?: string }) =>
  message ? <p className="mt-1 text-[11px] text-destructive">{message}</p> : null;

export const SalesDocumentForm = ({
  selectedDocumentTypes,
  selectedTypes,
  documentTitle,
  language = "th",
  mode = "create",
  initialSourceDocumentId,
  initialSourceDocumentType,
  initialDuplicateDocumentId,
  initialDuplicateDocumentType,
  initialTaxInvoice = false,
  initialInvoicePaymentMode = "full_payment",
}: SalesDocumentFormProps) => {
  const nav = useNavigate();
  const { t } = useTranslation();
  const { data, refresh } = useAppData();
  const realTypes = useMemo(
    () => getRealDocumentTypes(selectedDocumentTypes ?? selectedTypes ?? []),
    [selectedDocumentTypes, selectedTypes]
  );
  const [documentLanguage, setDocumentLanguage] = useState<DocumentLanguage>(language);
  const labels = localizedDocLabels[documentLanguage === "th" ? "th" : "en"];
  const primaryDocumentType = useMemo(() => getPrimarySalesDocumentType(realTypes), [realTypes]);
  const isTaxInvoiceDocument = primaryDocumentType === "tax_invoice" || realTypes.includes("tax_invoice");
  const isInvoiceDocument = isTaxInvoiceDocument || primaryDocumentType === "invoice" || realTypes.includes("invoice");
  const [invoiceTaxType, setInvoiceTaxType] = useState<"normal" | "tax">(initialTaxInvoice ? "tax" : "normal");
  const [invoicePaymentMode, setInvoicePaymentMode] = useState<InvoicePaymentMode>(initialInvoicePaymentMode);
  const isDepositPaymentDocument = isInvoiceDocument && invoicePaymentMode === "deposit";
  const titleDocumentTypes = useMemo(
    () =>
      realTypes.map((type) =>
        type === "invoice" && invoiceTaxType === "tax" ? "tax_invoice" : type
      ),
    [invoiceTaxType, realTypes]
  );
  const documentTitleTh = useMemo(
    () => documentTitle || buildSalesDocumentTitle(titleDocumentTypes, "th"),
    [documentTitle, titleDocumentTypes]
  );
  const documentTitleEn = useMemo(
    () => buildSalesDocumentTitle(titleDocumentTypes, "en"),
    [titleDocumentTypes]
  );
  const previewTitle = documentLanguage === "th" ? documentTitleTh : documentTitleEn;
  const previewTitleSizeClass =
    Array.from(previewTitle).length > 26
      ? "text-xl sm:text-[1.45rem] xl:text-[1.55rem]"
      : Array.from(previewTitle).length > 18
        ? "text-[1.35rem] sm:text-2xl"
        : "text-2xl";
  const kind = useMemo(() => resolveSalesDocumentKind(primaryDocumentType), [primaryDocumentType]);
  const numberPrefix = useMemo(() => resolveNumberPrefix(primaryDocumentType, data, realTypes), [data, primaryDocumentType, realTypes]);
  const [documentNumber, setDocumentNumber] = useState("");
  const [documentNumberEdited, setDocumentNumberEdited] = useState(false);
  const [copyGeneration, setCopyGeneration] = useState<CopyGeneration>("both");
  const [seller, setSeller] = useState<PartyInfo>(defaultSeller);
  const [sellerDraft, setSellerDraft] = useState<PartyInfo>(defaultSeller);
  const [brandingDraft, setBrandingDraft] = useState<Partial<BrandingSettings>>({});
  const [sellerEditOpen, setSellerEditOpen] = useState(false);
  const [sellerScope, setSellerScope] = useState<SaveScope>("document");
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [branding, setBranding] = useState<Partial<BrandingSettings>>({});
  const [companyLoaded, setCompanyLoaded] = useState(false);
  const [sellerExpanded, setSellerExpanded] = useState(false);
  const [customerMode, setCustomerMode] = useState<CustomerMode>("existing");
  const [customerExpanded, setCustomerExpanded] = useState(false);
  const [customerDraft, setCustomerDraft] = useState<PartyInfo>(blankCustomer);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [customerScope, setCustomerScope] = useState<SaveScope>("document");
  const [contactAdvancedOpen, setContactAdvancedOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customer, setCustomer] = useState<PartyInfo>(blankCustomer);
  const [issueDate, setIssueDate] = useState(todayText());
  const [dueDate, setDueDate] = useState(todayText());
  const [creditTerms, setCreditTerms] = useState("0");
  const creditTermSelectValue = standardCreditTerms.includes(creditTerms) ? creditTerms : "custom";
  const [dueDateEdited, setDueDateEdited] = useState(false);
  const [reference, setReference] = useState("");
  const [relatedDocument, setRelatedDocument] = useState("");
  const [sourceDocumentId, setSourceDocumentId] = useState("");
  const [sourceDocumentType, setSourceDocumentType] = useState<DocumentKind | "">("");
  const [referenceDocuments, setReferenceDocuments] = useState<ReferenceOption[]>([]);
  const [referenceSearchOpen, setReferenceSearchOpen] = useState(false);
  const [pendingReference, setPendingReference] = useState<ReferenceOption | null>(null);
  const [referenceConfirmOpen, setReferenceConfirmOpen] = useState(false);
  const [referenceImporting, setReferenceImporting] = useState(false);
  const [salesperson, setSalesperson] = useState("Matter Acc. Sales");
  const [sellerUserId, setSellerUserId] = useState("");
  const [documentContact, setDocumentContact] = useState("Finance Team");
  const [internalUsers, setInternalUsers] = useState<TeamMember[]>([]);
  const [currency, setCurrency] = useState("THB");
  const [projectId, setProjectId] = useState("");
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectDraft, setProjectDraft] = useState({
    code: "",
    name: "",
    customer: "",
    startDate: "",
    endDate: "",
    status: "active",
    notes: "",
  });
  const [paymentTerms, setPaymentTerms] = useState("Bank transfer within credit terms.");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodChoice>("Bank Transfer");
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails>(emptyPaymentDetails);
  const [showAddBankAccount, setShowAddBankAccount] = useState(false);
  const [newBankAccount, setNewBankAccount] = useState<CompanyBankAccount>({
    id: "",
    bankName: "",
    accountName: "",
    accountNumber: "",
    branch: "",
    promptPayId: "",
    swiftCode: "",
    isDefault: false,
  });
  const [vatEnabled, setVatEnabled] = useState(true);
  const [discountType] = useState<DiscountType>("percent");
  const [lineDiscountType, setLineDiscountType] = useState<DiscountType>("percent");
  const [discountValue, setDiscountValue] = useState(0);
  const [depositType, setDepositType] = useState<DiscountType>("amount");
  const [depositValue, setDepositValue] = useState(0);
  const [paymentScheduleOpen, setPaymentScheduleOpen] = useState(initialInvoicePaymentMode === "partial_payment");
  const [invoicePaymentSchedule, setInvoicePaymentSchedule] = useState<PaymentScheduleRow[]>([
    { id: createClientId(), label: "Installment 1", type: "percent", value: 100, amount: 0, dueDate: "" },
  ]);
  const [withholdingRate, setWithholdingRate] = useState(0);
  const [notes, setNotes] = useState("Please follow the payment terms shown on this document.");
  const [internalNote, setInternalNote] = useState("");
  const [remarkTemplateId, setRemarkTemplateId] = useState("none");
  const [remarkTemplates, setRemarkTemplates] = useState<RemarkTemplate[]>(defaultRemarkTemplates);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [customerAcknowledgement, setCustomerAcknowledgement] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState<"draft" | "create" | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [poAttachmentFiles, setPoAttachmentFiles] = useState<File[]>([]);
  const previewRef = useRef<HTMLDivElement>(null);
  const initialImportAppliedRef = useRef("");

  const currencyOptions = useMemo(() => getEnabledCurrencies(data.currencySettings), [data.currencySettings]);
  const selectedProject = data.projects.find((project) => project.id === projectId) ?? null;
  const hasRelatedDocument = relatedDocument.trim().length > 0;
  const currentDocumentSettings: DocumentSettings = {
    ...defaultDocumentSettingsSnapshot,
    ...(data.policySummary?.documents ?? {}),
  };
  const companyVatRegistered =
    companySettings?.vatRegistrationMode === "not_registered" ? false : data.policySummary?.vatRegistered !== false;
  const documentSettingsSnapshot: DocumentSettings = companyVatRegistered
    ? currentDocumentSettings
    : {
        ...currentDocumentSettings,
        taxMode: "exclusive",
        perLineVat: false,
      };
  const taxMode = companyVatRegistered ? documentSettingsSnapshot.taxMode ?? "exclusive" : "exclusive";
  const perLineVat = companyVatRegistered && Boolean(documentSettingsSnapshot.perLineVat);
  const perLineDiscount = Boolean(documentSettingsSnapshot.perLineDiscount);
  const showWhtFooter = Boolean(documentSettingsSnapshot.showWhtFooter);
  const perLineWithholdingTax = Boolean(documentSettingsSnapshot.perLineWithholdingTax);
  const showReceiptAdjustmentFooter = Boolean(documentSettingsSnapshot.receiptAdjustmentFooter);
  const effectiveVatEnabled = companyVatRegistered && vatEnabled;
  const documentVatRate = effectiveVatEnabled ? sanitizeWholePercent(companySettings?.taxDefaults?.vatRate ?? 7) : 0;
  const effectiveWithholdingRate = showWhtFooter && !perLineWithholdingTax ? sanitizeWhtRate(withholdingRate) : 0;
  const withholdingEnabled = perLineWithholdingTax || (showWhtFooter && effectiveWithholdingRate > 0);
  const transactionType = useMemo(
    () => (lines.length > 0 && lines.every((line) => (line.productType || line.unit).toLowerCase().includes("service")) ? "service" : "goods"),
    [lines]
  );
  const taxGuidanceMessages = useMemo(() => {
    const messages: string[] = [];
    if (!companyVatRegistered && (isTaxInvoiceDocument || invoiceTaxType === "tax")) {
      messages.push(t("taxGuidance.companyNotVatRegistered"));
    }
    if (effectiveVatEnabled && realTypes.includes("delivery_note")) {
      messages.push(t("taxGuidance.deliveryMayCreateTaxPoint"));
    }
    if (effectiveVatEnabled && (invoicePaymentMode === "deposit" || primaryDocumentType === "deposit" || realTypes.includes("receipt"))) {
      messages.push(t("taxGuidance.paymentBeforeDelivery"));
    }
    if (effectiveVatEnabled && (isTaxInvoiceDocument || invoiceTaxType === "tax")) {
      messages.push(t("taxGuidance.taxInvoiceRecommended"));
    }
    return Array.from(new Set(messages));
  }, [companyVatRegistered, effectiveVatEnabled, invoicePaymentMode, invoiceTaxType, isTaxInvoiceDocument, primaryDocumentType, realTypes, t]);
  const referenceOptions = useMemo(() => buildReferenceOptions(data, primaryDocumentType), [data, primaryDocumentType]);
  const allowsMultipleReferences = ["receipt", "combined_receipt", "billing_note", "combined_billing_note"].includes(primaryDocumentType);
  const selectedReference = referenceDocuments[0] ?? referenceOptions.find((item) => item.id === sourceDocumentId) ?? null;
  const priorInvoiceDeductions = useMemo(() => {
    if (!isInvoiceDocument || !selectedReference) {
      return [];
    }
    return data.invoices
      .filter((invoice) => invoice.id !== documentNumber)
      .filter((invoice) => {
        const linkedIds = new Set([
          invoice.sourceDocumentId,
          invoice.parentQuotationId,
          invoice.depositSourceDocumentId,
          ...(invoice.relatedDocumentIds ?? []),
          ...(invoice.linkedDocumentIds ?? []),
          ...(invoice.referenceDocuments ?? []).map((reference) => reference.id),
        ].filter(Boolean));
        return linkedIds.has(selectedReference.id);
      })
      .filter((invoice) => ["deposit", "partial_payment"].includes(invoice.invoicePaymentMode ?? ""))
      .filter((invoice) => !["draft", "void", "cancelled", "rejected"].includes(String(invoice.status ?? "").toLowerCase()))
      .map((invoice) => ({
        id: invoice.id,
        label: invoice.id,
        amount: roundMoney(Number(invoice.depositAmount ?? invoice.paymentSummary?.received ?? invoice.amount) || 0),
        type: invoice.invoicePaymentMode === "deposit" ? "deposit" as const : "paid" as const,
      }))
      .filter((deduction) => deduction.amount > 0);
  }, [data.invoices, documentNumber, isInvoiceDocument, selectedReference]);
  const amountPaid = invoicePaymentMode === "full_payment"
    ? roundMoney(priorInvoiceDeductions.reduce((sum, deduction) => sum + deduction.amount, 0))
    : 0;
  const totals = useMemo(
    () =>
      summarizeLines(lines, {
        vatEnabled: effectiveVatEnabled,
        discountType,
        discountValue,
        withholdingEnabled,
        withholdingRate: effectiveWithholdingRate,
        perLineWithholding: perLineWithholdingTax,
        amountPaid,
        taxMode,
        perLineDiscount,
        defaultTaxRate: documentVatRate,
        lineDiscountType,
      }),
    [amountPaid, discountType, discountValue, documentVatRate, effectiveVatEnabled, effectiveWithholdingRate, lineDiscountType, lines, perLineDiscount, perLineWithholdingTax, taxMode, withholdingEnabled]
  );
  const depositBaseAmount = selectedReference?.amount && selectedReference.amount > 0 ? selectedReference.amount : totals.grandTotal;
  const calculatedDepositAmount = roundMoney(
    depositType === "percent"
      ? Math.max(depositBaseAmount, 0) * (Math.max(Number(depositValue) || 0, 0) / 100)
      : Math.max(Number(depositValue) || 0, 0)
  );
  const safeDepositAmount = roundMoney(Math.min(calculatedDepositAmount, Math.max(depositBaseAmount, 0)));
  const depositPercent = depositBaseAmount > 0 ? roundMoney((safeDepositAmount / depositBaseAmount) * 100) : 0;
  const depositAmountValid = invoicePaymentMode !== "deposit" || (calculatedDepositAmount > 0 && calculatedDepositAmount <= Math.max(depositBaseAmount, 0));
  const partialBaseAmount = selectedReference?.amount && selectedReference.amount > 0 ? selectedReference.amount : totals.grandTotal;
  const priorPartialAmount = roundMoney(priorInvoiceDeductions.reduce((sum, deduction) => sum + deduction.amount, 0));
  const priorPartialPercent = partialBaseAmount > 0 ? roundMoney((priorPartialAmount / partialBaseAmount) * 100) : 0;
  const remainingPartialAmount = roundMoney(Math.max(partialBaseAmount - priorPartialAmount, 0));
  const remainingPartialPercent = roundMoney(Math.max(100 - priorPartialPercent, 0));
  const calculatedPaymentSchedule = useMemo(
    () =>
      invoicePaymentSchedule.map((row, index) => ({
        ...row,
        label: `${labels.installment} ${index + 1}`,
        percent: row.type === "percent"
          ? Number(row.value) || 0
          : partialBaseAmount > 0
            ? roundMoney(((Number(row.value) || 0) / partialBaseAmount) * 100)
            : 0,
        amount: roundMoney(row.type === "percent" ? partialBaseAmount * ((Number(row.value) || 0) / 100) : Number(row.value) || 0),
      })),
    [invoicePaymentSchedule, labels.installment, partialBaseAmount]
  );
  const paymentScheduleTotal = roundMoney(calculatedPaymentSchedule.reduce((sum, row) => sum + row.amount, 0));
  const paymentSchedulePercentTotal = roundMoney(calculatedPaymentSchedule.reduce((sum, row) => sum + (row.percent ?? 0), 0));
  const paymentScheduleValid =
    invoicePaymentMode !== "partial_payment" ||
    (calculatedPaymentSchedule.length > 0 &&
      calculatedPaymentSchedule.every((row) => row.amount > 0 && Number(row.value) > 0) &&
      paymentScheduleTotal <= remainingPartialAmount + 0.01 &&
      paymentSchedulePercentTotal <= remainingPartialPercent + 0.01);
  const amountWordsThai = useMemo(() => amountInThaiWordsFixed(totals.remainingDue), [totals.remainingDue]);
  const amountWordsEnglish = useMemo(() => amountInEnglishWordsFixed(totals.remainingDue, currency), [currency, totals.remainingDue]);

  useEffect(() => {
    setInvoiceTaxType(isTaxInvoiceDocument ? "tax" : "normal");
  }, [isTaxInvoiceDocument]);

  const companyWarnings = useMemo(() => {
    const missing = [
      ["company name", seller.name],
      ["tax ID", seller.taxId],
      ["address", seller.address],
      ["phone", seller.phone],
      ["email", seller.email],
    ].filter(([, value]) => !String(value ?? "").trim());
    return missing.map(([label]) => label);
  }, [seller]);

  const customerOptions = useMemo(() => data.customers.map(customerRecordToParty), [data.customers]);
  const productBySku = useMemo(
    () => new Map(data.products.map((product) => [String(product.sku).trim().toLowerCase(), product])),
    [data.products]
  );
  const productByName = useMemo(
    () => new Map(data.products.map((product) => [String(product.name).trim().toLowerCase(), product])),
    [data.products]
  );
  const availableRemarkTemplates = useMemo(
    () =>
      remarkTemplates
        .filter((template) => template.language === "both" || template.language === documentLanguage)
        .filter((template) => template.documentTypes.includes("all") || realTypes.some((type) => template.documentTypes.includes(type))),
    [documentLanguage, realTypes, remarkTemplates]
  );
  const companyBankAccounts = companySettings?.bankAccounts ?? [];
  const selectedBankAccount = companyBankAccounts.find((account) => account.id === paymentDetails.selectedBankAccountId) ?? null;
  const selectedSellerUser = internalUsers.find((user) => user.id === sellerUserId) ?? null;
  const showPoAttachmentBox = realTypes.some((type) =>
    ["invoice", "tax_invoice", "delivery_note", "billing_note"].includes(type)
  );
  const stockWarningCount = lines.filter(stockWarning).length;
  const validationErrors = useMemo(
    () =>
      validateSalesDocument({
        realTypes,
        seller,
        customer,
        documentNumber,
        issueDate,
        dueDate,
        creditTerms,
        currency,
        documentLanguage,
        copyGeneration,
        lines,
        paymentMethod,
        selectedBankAccount,
        paymentDetails,
        labels,
      }),
    [copyGeneration, creditTerms, currency, customer, documentLanguage, documentNumber, dueDate, issueDate, labels, lines, paymentDetails, paymentMethod, realTypes, selectedBankAccount, seller]
  );
  const missingRequiredCount = Object.keys(validationErrors).length;

  useEffect(() => setDocumentLanguage(language), [language]);

  useEffect(() => {
    if (!selectedCustomerId && customerOptions.length) {
      setSelectedCustomerId(customerOptions[0].code);
      setCustomer(customerOptions[0]);
    }
  }, [customerOptions, selectedCustomerId]);

  useEffect(() => {
    if (documentNumberEdited) return;
    setDocumentNumber(buildNextDocumentNumber({ kind, prefix: numberPrefix, issueDate, data }));
  }, [data, documentNumberEdited, issueDate, kind, numberPrefix]);

  useEffect(() => {
    let active = true;
    const loadSettings = async () => {
      try {
        const [company, brandingSettings, usersSettings] = await Promise.all([
          fetchCompanySettings(),
          fetchSettingsSection("branding"),
          fetchSettingsSection("users"),
        ]);
        if (!active) return;
        setCompanySettings(company);
        setSeller(companyToSeller(company));
        setSellerDraft(companyToSeller(company));
        setBranding(brandingSettings);
        setBrandingDraft(brandingSettings);
        const members = (usersSettings as UsersSettings).members ?? [];
        setInternalUsers(members);
        const currentUser = members.find((member) => member.status === "active") ?? members[0];
        if (currentUser) {
          setSellerUserId(currentUser.id);
          setSalesperson(currentUser.name);
          setDocumentContact(`${currentUser.name}${currentUser.email ? ` (${currentUser.email})` : ""}`);
        }
        const defaultBankAccount = resolveDefaultBankAccount(company.bankAccounts ?? []);
        if (defaultBankAccount) {
          setPaymentDetails((current) => ({
            ...current,
            selectedBankAccountId: defaultBankAccount.id,
            bankAccount: defaultBankAccount.bankName,
            accountName: defaultBankAccount.accountName,
            accountNumber: defaultBankAccount.accountNumber,
            promptPayId: defaultBankAccount.promptPayId ?? current.promptPayId,
          }));
        }
      } catch {
        setBranding({});
      } finally {
        if (active) setCompanyLoaded(true);
      }
    };

    void loadSettings();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (dueDateEdited) return;
    setDueDate(addDays(issueDate, Number(creditTerms) || 0));
  }, [creditTerms, dueDateEdited, issueDate]);

  useEffect(() => {
    if (!companyVatRegistered) {
      setVatEnabled(false);
    }
  }, [companyVatRegistered]);

  useEffect(() => {
    setLines((current) =>
      current.map((line) => ({
        ...line,
        discountType: lineDiscountType,
        tax: effectiveVatEnabled
          ? perLineVat
            ? sanitizeWholePercent(line.tax ?? documentVatRate)
            : documentVatRate
          : 0,
        vatRate: effectiveVatEnabled
          ? perLineVat
            ? sanitizeWholePercent(line.vatRate ?? line.tax ?? documentVatRate)
            : documentVatRate
          : 0,
        withholdingRate: perLineWithholdingTax ? sanitizeWhtRate(line.withholdingRate ?? 0) : 0,
      }))
    );
  }, [documentVatRate, effectiveVatEnabled, lineDiscountType, perLineVat, perLineWithholdingTax]);

  useEffect(() => {
    const stored = window.localStorage.getItem("matter.sales.remarkTemplates");
    if (stored) {
      try {
        setRemarkTemplates(JSON.parse(stored) as RemarkTemplate[]);
      } catch {
        setRemarkTemplates(defaultRemarkTemplates);
      }
    }
  }, []);

  const updateCustomerField = (key: keyof PartyInfo, value: string) =>
    setCustomer((current) => ({ ...current, [key]: value }));
  const updateCustomerDraftField = (key: keyof PartyInfo, value: string) =>
    setCustomerDraft((current) => ({ ...current, [key]: value }));
  const updateCustomerDraftValue = (key: keyof PartyInfo, value: PartyInfo[keyof PartyInfo]) =>
    setCustomerDraft((current) => ({ ...current, [key]: value }));
  const updateSellerDraftField = (key: keyof PartyInfo, value: string) =>
    setSellerDraft((current) => ({ ...current, [key]: value }));
  const updateSellerDraftValue = (key: keyof PartyInfo, value: PartyInfo[keyof PartyInfo]) =>
    setSellerDraft((current) => ({ ...current, [key]: value }));
  const updateBrandingDraftField = (key: keyof BrandingSettings, value: string) =>
    setBrandingDraft((current) => ({ ...current, [key]: value }));

  const updatePaymentDetail = (key: keyof PaymentDetails, value: string) =>
    setPaymentDetails((current) => ({ ...current, [key]: value }));

  const applyRemarkTemplate = (templateId: string) => {
    setRemarkTemplateId(templateId);
    const template = remarkTemplates.find((item) => item.id === templateId);
    if (template) {
      setNotes(template.content);
    }
  };

  const saveCurrentRemarkAsTemplate = () => {
    if (!notes.trim()) {
      toast.error("Add a customer-facing remark before saving it as a template.");
      return;
    }
    const name = window.prompt(documentLanguage === "th" ? "ชื่อเทมเพลต" : "Template name", notes.trim().slice(0, 40));
    if (!name?.trim()) return;
    const next: RemarkTemplate[] = [
      ...remarkTemplates,
      {
        id: createClientId(),
        name: name.trim(),
        content: notes.trim(),
        language: documentLanguage,
        documentTypes: realTypes.length ? realTypes : ["all"],
      },
    ];
    setRemarkTemplates(next);
    window.localStorage.setItem("matter.sales.remarkTemplates", JSON.stringify(next));
    toast.success(documentLanguage === "th" ? "บันทึกเทมเพลตหมายเหตุแล้ว" : "Remark template saved");
  };

  const selectBankAccount = (accountId: string) => {
    const account = companyBankAccounts.find((item) => item.id === accountId);
    setPaymentDetails((current) => ({
      ...current,
      selectedBankAccountId: accountId,
      bankAccount: account?.bankName ?? "",
      accountName: account?.accountName ?? "",
      accountNumber: account?.accountNumber ?? "",
      promptPayId: account?.promptPayId ?? current.promptPayId,
    }));
  };

  const updateNewBankAccount = (key: keyof CompanyBankAccount, value: string | boolean) =>
    setNewBankAccount((current) => ({ ...current, [key]: value }));

  const saveBankAccountFromDocument = async () => {
    if (!companySettings) {
      toast.error("Company settings are still loading.");
      return;
    }
    if (!newBankAccount.bankName.trim() || !newBankAccount.accountName.trim() || !newBankAccount.accountNumber.trim()) {
      toast.error("Add bank name, account name, and account number before saving.");
      return;
    }

    const account: CompanyBankAccount = {
      ...newBankAccount,
      id: newBankAccount.id || `BANK-${Date.now()}`,
      bankName: newBankAccount.bankName.trim(),
      accountName: newBankAccount.accountName.trim(),
      accountNumber: newBankAccount.accountNumber.trim(),
      branch: newBankAccount.branch?.trim() ?? "",
      promptPayId: newBankAccount.promptPayId?.trim() ?? "",
      swiftCode: newBankAccount.swiftCode?.trim() ?? "",
      isDefault: Boolean(newBankAccount.isDefault),
    };
    const nextAccounts = [
      ...(companySettings.bankAccounts ?? []).map((item) => ({
        ...item,
        isDefault: account.isDefault ? false : Boolean(item.isDefault),
      })),
      account,
    ];
    const saved = await saveCompanySettings({ ...companySettings, bankAccounts: nextAccounts });
    setCompanySettings(saved);
    setShowAddBankAccount(false);
    setNewBankAccount({
      id: "",
      bankName: "",
      accountName: "",
      accountNumber: "",
      branch: "",
      promptPayId: "",
      swiftCode: "",
      isDefault: false,
    });
    selectSavedBankAccount(account);
    toast.success("Bank account saved to Company Settings", {
      description: "It is selected for this document and available for future documents.",
    });
  };

  const selectSavedBankAccount = (account: CompanyBankAccount) => {
    setPaymentDetails((current) => ({
      ...current,
      selectedBankAccountId: account.id,
      bankAccount: account.bankName,
      accountName: account.accountName,
      accountNumber: account.accountNumber,
      promptPayId: account.promptPayId ?? current.promptPayId,
    }));
  };

  const selectCustomer = (id: string) => {
    const selected = customerOptions.find((item) => item.code === id);
    setSelectedCustomerId(id);
    setCustomerMode("existing");
    setCustomerExpanded(false);
    if (selected) {
      setCustomer(selected);
      setCreditTerms(String(selected.creditDays ?? 0));
      setDueDateEdited(false);
    }
  };

  const setLinkedReferences = (nextReferences: ReferenceOption[]) => {
    const uniqueReferences = Array.from(
      new Map(nextReferences.map((item) => [item.id, item])).values()
    );
    setReferenceDocuments(uniqueReferences);
    const first = uniqueReferences[0];
    const ids = uniqueReferences.map((item) => item.id);
    setSourceDocumentId(first?.id ?? "");
    setSourceDocumentType(first?.kind ?? "");
    setRelatedDocument(ids.join(", "));
  };

  const applyReferenceLink = (selected: ReferenceOption) => {
    const nextReferences = allowsMultipleReferences
      ? Array.from(new Map([...referenceDocuments, selected].map((item) => [item.id, item])).values())
      : [selected];
    setLinkedReferences(nextReferences);
  };

  useEffect(() => {
    if (!initialSourceDocumentId || sourceDocumentId) {
      return;
    }

    const selected =
      referenceOptions.find(
        (item) =>
          item.id === initialSourceDocumentId &&
          (!initialSourceDocumentType || item.kind === initialSourceDocumentType)
      ) ?? referenceOptions.find((item) => item.id === initialSourceDocumentId);

    if (selected) {
      setLinkedReferences([selected]);
      return;
    }

    setSourceDocumentId(initialSourceDocumentId);
    setSourceDocumentType(initialSourceDocumentType ?? "");
    setRelatedDocument(initialSourceDocumentId);
  }, [initialSourceDocumentId, initialSourceDocumentType, referenceOptions, sourceDocumentId]);

  const selectReferenceDocument = (id: string) => {
    const selected = referenceOptions.find((item) => item.id === id);
    if (!selected) {
      setPendingReference(null);
      setSourceDocumentType("");
      setRelatedDocument("");
      return;
    }
    if (!selected.suggested) {
      toast.error(labels.incompatibleDocumentType);
      return;
    }
    if (!allowsMultipleReferences && referenceDocuments.some((item) => item.id !== selected.id)) {
      setLinkedReferences([]);
    }
    setPendingReference(selected);
    setReferenceConfirmOpen(true);
  };

  const clearReferenceDocument = () => {
    setLinkedReferences([]);
  };

  const removeReferenceDocument = (id: string) => {
    setLinkedReferences(referenceDocuments.filter((item) => item.id !== id));
  };

  const cancelReferenceSelection = () => {
    setPendingReference(null);
    setReferenceConfirmOpen(false);
  };

  const applyReferenceSelection = async (action: ReferenceImportAction) => {
    const selected = pendingReference;
    if (!selected) return;
    if (action === "link") {
      applyReferenceLink(selected);
      setPendingReference(null);
      setReferenceConfirmOpen(false);
      return;
    }

    setReferenceImporting(true);
    try {
      const source = await fetchDocument<SourceDocumentForImport>(selected.kind, selected.id);
      applyReferenceLink(selected);
      importReferenceDetails(source, selected, action);
      setPendingReference(null);
      setReferenceConfirmOpen(false);
      toast.success(
        action === "merge"
          ? `Line items imported from ${selected.id}`
          : `Details copied from ${selected.id}`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Unable to copy details from ${selected.id}.`);
    } finally {
      setReferenceImporting(false);
    }
  };

  const reimportReferenceDocument = () => {
    if (!selectedReference) return;
    setPendingReference(selectedReference);
    setReferenceConfirmOpen(true);
  };

  const importReferenceDetails = (
    source: SourceDocumentForImport | null,
    selected: ReferenceOption,
    action: ReferenceImportAction
  ) => {
    const sourceLines = mapSourceLinesToForm(source?.lines ?? [], selected);
    if (action === "merge") {
      if (sourceLines.length) {
        setLines((current) => [...current.filter((line) => line.desc.trim() || line.sku.trim()), ...sourceLines]);
      }
      return;
    }

    const importedCustomer = source?.customerInfo ? normalizePartyInfo(source.customerInfo, selected.party) : findPartyByName(customerOptions, source?.customer || selected.party);
    if (importedCustomer) {
      setCustomer(importedCustomer);
      setSelectedCustomerId(importedCustomer.code);
      setCustomerMode("existing");
    } else if (source?.customer || selected.party) {
      setCustomer((current) => ({ ...current, name: source?.customer || selected.party }));
    }

    if (sourceLines.length) {
      setLines(sourceLines);
    }
    if (source?.paymentTerms) {
      setPaymentTerms(source.paymentTerms);
      const days = extractCreditDays(source.paymentTerms);
      if (days !== null) {
        setCreditTerms(String(days));
        setDueDateEdited(false);
      }
    }
    if (source?.notes) {
      setNotes(source.notes);
    }
    if (source?.projectId) {
      setProjectId(source.projectId);
    }
  };

  useEffect(() => {
    const importId = initialDuplicateDocumentId || initialSourceDocumentId;
    if (!importId || initialImportAppliedRef.current === `${initialDuplicateDocumentId ? "duplicate" : "reference"}:${importId}`) {
      return;
    }

    const importKind = initialDuplicateDocumentType || initialSourceDocumentType;
    const selected =
      referenceOptions.find(
        (item) =>
          item.id === importId &&
          (!importKind || item.kind === importKind)
      ) ??
      referenceOptions.find((item) => item.id === importId) ??
      ({
        id: importId,
        kind: importKind || kind,
        party: "",
        date: issueDate,
        amount: 0,
        status: "pending",
        suggested: true,
      } satisfies ReferenceOption);

    initialImportAppliedRef.current = `${initialDuplicateDocumentId ? "duplicate" : "reference"}:${importId}`;
    void fetchDocument<SourceDocumentForImport>(selected.kind, selected.id)
      .then((source) => {
        if (!initialDuplicateDocumentId) {
          applyReferenceLink({
            ...selected,
            party: source.customer || selected.party,
            date: source.date || selected.date,
            amount: Number(source.amount ?? selected.amount) || 0,
            documentTypes: source.documentTypes ?? selected.documentTypes,
            status: source.status ?? selected.status,
          });
        }
        importReferenceDetails(source, selected, "replace");
        if (initialDuplicateDocumentId) {
          setSourceDocumentId("");
          setSourceDocumentType("");
          setRelatedDocument("");
          setReferenceDocuments([]);
        }
      })
      .catch(() => {
        initialImportAppliedRef.current = "";
      });
  // Initial URL-driven import must run once per source id; the helper functions intentionally use current form state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    initialDuplicateDocumentId,
    initialDuplicateDocumentType,
    initialSourceDocumentId,
    initialSourceDocumentType,
    issueDate,
    kind,
    referenceOptions,
  ]);

  const buildDocumentPayload = (status: "draft" | "pending" = "pending") => {
    const sanitizedLines = validLines(lines).map((line) => {
      const lineWithholdingRate = perLineWithholdingTax ? sanitizeWhtRate(line.withholdingRate ?? 0) : effectiveWithholdingRate;
      const effectiveLine = {
        ...line,
        discountType: perLineDiscount ? lineDiscountType : "percent",
        discountValue: perLineDiscount ? Number(line.discountValue ?? line.discount) || 0 : 0,
        discount: perLineDiscount ? Number(line.discountValue ?? line.discount) || 0 : 0,
        tax: effectiveVatEnabled ? (perLineVat ? sanitizeWholePercent(line.tax) : documentVatRate) : 0,
        vatRate: effectiveVatEnabled ? (perLineVat ? sanitizeWholePercent(line.vatRate ?? line.tax) : documentVatRate) : 0,
        withholdingRate: withholdingEnabled ? lineWithholdingRate : 0,
      };
      const amounts = lineAmounts(effectiveLine, {
        vatEnabled: effectiveVatEnabled,
        taxMode,
        perLineDiscount,
        defaultTaxRate: documentVatRate,
        withholdingEnabled,
        withholdingRate: effectiveLine.withholdingRate,
        lineDiscountType,
      });
      return {
        id: line.id,
        sku: line.sku.trim(),
        inventoryId: line.inventoryId || undefined,
        originalInventoryCode: line.originalInventoryCode || undefined,
        displayCode: line.sku.trim(),
        desc: line.desc.trim(),
        details: line.details.trim(),
        qty: Number(line.qty) || 0,
        unit: line.unit.trim(),
        price: Number(line.price) || 0,
        discountType: perLineDiscount ? lineDiscountType : "percent",
        discountValue: perLineDiscount ? Number(effectiveLine.discountValue ?? effectiveLine.discount) || 0 : 0,
        discountAmount: perLineDiscount ? amounts.discountAmount : 0,
        discount: perLineDiscount ? Number(effectiveLine.discountValue ?? effectiveLine.discount) || 0 : 0,
        tax: Number(effectiveLine.tax) || 0,
        vatRate: Number(effectiveLine.vatRate) || 0,
        amountBeforeVat: amounts.amountBeforeVat,
        vatAmount: amounts.vatAmount,
        withholdingRate: Number(effectiveLine.withholdingRate) || 0,
        withholdingAmount: amounts.withholdingAmount,
        lineTotal: amounts.lineTotal,
        totalAmount: amounts.totalAmount,
        sourceDocumentId: line.sourceDocumentId || undefined,
        sourceDocumentType: line.sourceDocumentType || undefined,
        sourceLineId: line.sourceLineId || undefined,
        availableStock: line.availableStock ?? undefined,
        stockOverrideAcknowledged: Boolean(stockWarning(line) && line.stockOverrideAcknowledged),
      };
    });
    const referenceDocumentSnapshots = referenceDocuments.map((item) => ({
      id: item.id,
      number: item.id,
      type: item.kind,
      kind: item.kind,
      documentTypes: item.documentTypes ?? [item.kind],
      party: item.party,
      date: item.date,
      total: item.amount,
      amount: item.amount,
      status: item.status,
    }));
    const referenceIds = referenceDocumentSnapshots.map((item) => item.id);

    return {
      id: documentNumber,
      number: documentNumber,
      customer: customer.name,
      date: issueDate,
      due: dueDate,
      expiryDate: dueDate,
      reference,
      relatedDocument,
      currency,
      exchangeRate: resolveExchangeRate(data.currencySettings, currency || "THB"),
      projectId,
      projectName: selectedProject?.name,
      paymentTerms,
      paymentMethod,
      paymentDetails: {
        ...paymentDetails,
        selectedBankAccount: selectedBankAccount ?? undefined,
      },
      notes,
      internalNote,
      customerAcknowledgement,
      status,
      documentTypes: isInvoiceDocument
        ? realTypes.map((type) => (type === "invoice" && invoiceTaxType === "tax" ? "tax_invoice" : type))
        : realTypes,
      documentTitle: documentTitleTh,
      documentVariant: documentTitleEn,
      invoiceTaxType,
      isTaxInvoice: isInvoiceDocument && (isTaxInvoiceDocument || invoiceTaxType === "tax"),
      invoicePaymentMode: isInvoiceDocument ? invoicePaymentMode : undefined,
      depositType: isInvoiceDocument && invoicePaymentMode === "deposit" ? depositType : undefined,
      depositValue: isInvoiceDocument && invoicePaymentMode === "deposit" ? depositValue : undefined,
      depositPercent: isInvoiceDocument && invoicePaymentMode === "deposit" ? depositPercent : undefined,
      depositAmount: isInvoiceDocument && invoicePaymentMode === "deposit" ? safeDepositAmount : undefined,
      depositSourceDocumentId: isInvoiceDocument && invoicePaymentMode === "deposit" ? selectedReference?.id : undefined,
      depositSourceDocumentType: isInvoiceDocument && invoicePaymentMode === "deposit" ? selectedReference?.kind : undefined,
      invoicePaymentSchedule: isInvoiceDocument && invoicePaymentMode === "partial_payment" ? calculatedPaymentSchedule : [],
      invoiceDeductions: isInvoiceDocument && priorInvoiceDeductions.length ? priorInvoiceDeductions : undefined,
      documentLanguage,
      documentCopy: copyGeneration,
      copyGeneration,
      transactionType,
      deliveryDate: realTypes.includes("delivery_note") ? issueDate : undefined,
      paymentDate: realTypes.includes("receipt") || invoicePaymentMode === "deposit" ? issueDate : undefined,
      serviceCompletedDate: transactionType === "service" ? issueDate : undefined,
      primaryDocumentType,
      documentNumberPrefix: numberPrefix,
      sellerInfo: seller,
      sellerUserId: selectedSellerUser?.id || sellerUserId || undefined,
      sellerUserInfo: selectedSellerUser
        ? {
            id: selectedSellerUser.id,
            name: selectedSellerUser.name,
            email: selectedSellerUser.email,
            role: selectedSellerUser.role,
          }
        : undefined,
      customerInfo: customer,
      salesperson,
      documentContact,
      sourceDocumentId: referenceIds[0] || sourceDocumentId || undefined,
      sourceDocumentType: referenceDocuments[0]?.kind || sourceDocumentType || undefined,
      sourceDocumentNumber: selectedReference?.id || undefined,
      sourceDocumentDate: selectedReference?.date || undefined,
      sourceDocumentCustomer: selectedReference?.party || undefined,
      relatedDocumentIds: referenceIds.length ? referenceIds : sourceDocumentId ? [sourceDocumentId] : undefined,
      referenceDocuments: referenceDocumentSnapshots.length ? referenceDocumentSnapshots : undefined,
      linkedDocumentIds: referenceIds.length ? referenceIds : undefined,
      sourceInvoiceIds: referenceDocumentSnapshots
        .filter((item) => item.type === "invoice" || item.documentTypes?.includes("invoice"))
        .map((item) => item.id),
      relatedDocumentNumber: relatedDocument,
      brandingSnapshot: {
        logoUrl: branding.logoUrl ?? "",
        signatureUrl: branding.signatureUrl ?? "",
        signaturePath: branding.signaturePath ?? "",
      },
      documentSettingsSnapshot,
      taxMode,
      subtotalBeforeDiscount: totals.subtotalBeforeDiscount,
      totalDiscount: totals.totalDiscount,
      discountType,
      discountValue,
      lineDiscountType,
      subtotal: totals.amountBeforeVat,
      amountBeforeVat: totals.amountBeforeVat,
      vatEnabled: effectiveVatEnabled,
      vatRate: effectiveVatEnabled ? (perLineVat ? dominantVatRate(lines) : documentVatRate) : 0,
      taxAmount: totals.vatAmount,
      vatGroups: totals.vatGroups,
      amount: totals.grandTotal,
      withholdingEnabled,
      withholdingRate: effectiveWithholdingRate,
      withholdingAmount: totals.withholdingAmount,
      withholdingGroups: totals.withholdingGroups,
      totalWithholdingTax: totals.totalWithholdingTax,
      amountPaid: hasRelatedDocument ? totals.amountPaid : 0,
      amountDue: totals.remainingDue,
      amountInWordsThai: amountWordsThai,
      amountInWordsEnglish: amountWordsEnglish,
      lines: sanitizedLines,
    };
  };

  const downloadPreviewPdf = async () => {
    setDownloadingPdf(true);
    try {
      const root = previewRef.current;
      if (!root) {
        throw new Error("Preview is not ready.");
      }
      const filename = `${sanitizeFilename(documentNumber || "sales-document")}-${sanitizeFilename(previewTitle || documentTitleEn || "document")}.pdf`;
      await downloadPreviewDomAsPdf(root, filename);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to download PDF.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const saveProjectFromDocument = async () => {
    if (!projectDraft.name.trim()) {
      toast.error("Project name is required.");
      return;
    }
    try {
      const saved = await createProject({
        code: projectDraft.code.trim(),
        name: projectDraft.name.trim(),
        status: projectDraft.status,
        customer: projectDraft.customer.trim() || customer.name,
        description: [
          projectDraft.notes.trim(),
          projectDraft.startDate ? `Start: ${projectDraft.startDate}` : "",
          projectDraft.endDate ? `End: ${projectDraft.endDate}` : "",
        ].filter(Boolean).join("\n"),
      });
      await refresh();
      setProjectId(saved.id);
      setProjectModalOpen(false);
      setProjectDraft({ code: "", name: "", customer: "", startDate: "", endDate: "", status: "active", notes: "" });
      toast.success(`Project ${saved.name} created`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create project.");
    }
  };

  const openCustomerModal = (mode: CustomerMode = customerMode) => {
    setCustomerMode(mode);
    setCustomerDraft(mode === "new" ? blankCustomer : customer);
    setCustomerScope("document");
    setContactAdvancedOpen(false);
    setCustomerModalOpen(true);
  };

  const openSellerModal = () => {
    setSellerDraft(seller);
    setBrandingDraft(branding);
    setSellerScope("document");
    setSellerEditOpen(true);
  };

  const saveCustomerModal = async (scope: SaveScope = customerScope) => {
    const changed = customerMode === "existing" && !sameParty(customerDraft, customer);
    try {
      if (customerMode === "existing" && scope === "profile" && changed) {
        const updated = await saveCustomerSnapshot(customerDraft, data.customers, data.vendors, "existing", selectedCustomerId, "profile");
        if (updated) {
          setCustomer(customerRecordToParty(updated));
          setSelectedCustomerId(updated.id);
        } else {
          setCustomer(customerDraft);
        }
        await refresh();
        toast.success(documentLanguage === "th" ? "อัปเดตข้อมูลลูกค้าแล้ว" : "Customer profile updated");
      } else if (customerMode === "new") {
        const created = await saveCustomerSnapshot(customerDraft, data.customers, data.vendors, "new", "", "profile");
        if (created) {
          setCustomer(customerRecordToParty(created));
          setSelectedCustomerId(created.id);
          setCustomerMode("existing");
          setCustomerExpanded(false);
          await refresh();
          toast.success(documentLanguage === "th" ? "สร้างลูกค้าใหม่แล้ว" : "Customer created");
        }
      } else {
        setCustomer(customerDraft);
        toast.success(documentLanguage === "th" ? "ใช้ข้อมูลลูกค้านี้เฉพาะเอกสารนี้" : "Customer changes applied to this document");
      }
      setCustomerExpanded(false);
      setCustomerModalOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save customer.");
    }
  };

  const saveSellerModal = async (scope: SaveScope = sellerScope) => {
    try {
      if (scope === "profile" && companySettings) {
        const saved = await saveCompanySettings({
          ...companySettings,
          name: sellerDraft.name,
          address: sellerDraft.address,
          taxId: sellerDraft.taxId,
          branch: sellerDraft.branch,
          contactName: sellerDraft.contactPerson,
          phone: sellerDraft.phone,
          email: sellerDraft.email,
          website: sellerDraft.website ?? "",
        });
        setCompanySettings(saved);
        setSeller(companyToSeller(saved));
        const savedBranding = await saveSettingsSection("branding", {
          ...(branding as BrandingSettings),
          logoUrl: brandingDraft.logoUrl ?? "",
          signatureUrl: brandingDraft.signatureUrl ?? "",
        });
        setBranding(savedBranding);
        await refresh();
        toast.success(documentLanguage === "th" ? "อัปเดตข้อมูลบริษัทแล้ว" : "Company profile updated");
      } else {
        setSeller(sellerDraft);
        setBranding(brandingDraft);
        toast.success(documentLanguage === "th" ? "ใช้ข้อมูลบริษัทนี้เฉพาะเอกสารนี้" : "Seller changes applied to this document");
      }
      setSellerExpanded(false);
      setSellerEditOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save seller information.");
    }
  };

  const addLine = () => setLines((current) => [...current, emptyLine()]);
  const removeLine = (id: string) => setLines((current) => current.filter((line) => line.id !== id));

  const updateLine = (id: string, key: keyof Line, value: string | number | boolean) => {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== id) return line;
        const rawNumericValue = Number.isFinite(Number(value)) ? Number(value) : 0;
        const lineBase = roundMoney((Number(line.qty) || 0) * (Number(line.price) || 0));
        const numericValue =
          key === "tax" || key === "vatRate"
            ? clampWholePercent(value as string | number)
            : key === "withholdingRate"
              ? sanitizeWhtRate(value as string | number)
              : key === "discountValue" || key === "discount"
                ? line.discountType === "amount"
                  ? Math.min(Math.max(rawNumericValue, 0), lineBase)
                  : Math.max(rawNumericValue, 0)
                : rawNumericValue;
        const stringKeys = ["sku", "desc", "details", "unit", "productType", "sourceDocumentId", "sourceDocumentType", "sourceLineId", "discountType"];
        const next = {
          ...line,
          [key]: typeof value === "boolean" ? value : stringKeys.includes(key) ? String(value) : numericValue,
        };
        if (key === "discountValue") {
          next.discount = numericValue;
        }
        if (key === "discount") {
          next.discountValue = numericValue;
        }
        if (key === "discountType") {
          next.discountType = value === "amount" ? "amount" : "percent";
          const currentDiscount = Number(line.discountValue ?? line.discount) || 0;
          const clampedDiscount = next.discountType === "amount" ? Math.min(Math.max(currentDiscount, 0), lineBase) : Math.max(currentDiscount, 0);
          next.discountValue = clampedDiscount;
          next.discount = clampedDiscount;
        }
        if (key === "tax" || key === "vatRate") {
          next.tax = numericValue;
          next.vatRate = numericValue;
        }

        return next;
      })
    );
  };

  const updateLineFromProduct = (id: string, product: Product) => {
    setLines((current) =>
      current.map((line) =>
        line.id === id
          ? hydrateLineFromProduct(
              { ...line, sku: product.sku, inventoryId: product.sku, originalInventoryCode: product.sku, desc: product.name },
              product,
              data.products,
              effectiveVatEnabled
            )
          : line
      )
    );
  };

  const applyDepositLine = () => {
    const amount = safeDepositAmount;
    if (amount <= 0) {
      toast.error(documentLanguage === "th" ? "กรุณาระบุยอดมัดจำ" : "Enter a deposit amount.");
      return;
    }
    const referenceLabel = selectedReference
      ? documentLanguage === "th"
        ? `อ้างอิงใบเสนอราคา ${selectedReference.id} มูลค่า ${formatMoney(selectedReference.amount, currency)}\nยอดมัดจำ ${formatMoney(amount, currency)}`
        : `Reference quotation ${selectedReference.id} total ${formatMoney(selectedReference.amount, currency)}\nDeposit amount ${formatMoney(amount, currency)}`
      : documentLanguage === "th"
        ? "ระบุยอดมัดจำด้วยตนเอง"
        : "Manual deposit amount";
    setLines([
      {
        ...emptyLine(),
        id: createClientId(),
        desc: documentLanguage === "th" ? "มัดจำ" : "Deposit",
        details: referenceLabel,
        qty: 1,
        unit: documentLanguage === "th" ? "ครั้ง" : "lot",
        price: amount,
        discount: 0,
        discountValue: 0,
        discountAmount: 0,
        tax: 0,
        vatRate: 0,
        withholdingRate: 0,
        withholdingAmount: 0,
        sourceDocumentId: selectedReference?.id,
        sourceDocumentType: selectedReference?.kind,
      },
    ]);
    toast.success(documentLanguage === "th" ? "เพิ่มรายการมัดจำแล้ว" : "Deposit line applied");
  };

  useEffect(() => {
    if (!isDepositPaymentDocument || safeDepositAmount <= 0 || !selectedReference) {
      return;
    }
    const referenceLabel = documentLanguage === "th"
      ? `อ้างอิง ${selectedReference.id} มูลค่า ${formatMoney(selectedReference.amount, currency)}`
      : `Reference ${selectedReference.id} total ${formatMoney(selectedReference.amount, currency)}`;
    setLines((current) => {
      const [first] = current;
      if (
        current.length === 1 &&
        first?.sourceDocumentId === selectedReference.id &&
        first.desc === (documentLanguage === "th" ? "มัดจำ" : "Deposit") &&
        Number(first.price) === safeDepositAmount
      ) {
        return current;
      }
      return [
        {
          ...emptyLine(),
          id: first?.id || createClientId(),
          desc: documentLanguage === "th" ? "มัดจำ" : "Deposit",
          details: referenceLabel,
          qty: 1,
          unit: documentLanguage === "th" ? "ครั้ง" : "lot",
          price: safeDepositAmount,
          discount: 0,
          discountValue: 0,
          discountAmount: 0,
          tax: 0,
          vatRate: 0,
          withholdingRate: 0,
          withholdingAmount: 0,
          sourceDocumentId: selectedReference.id,
          sourceDocumentType: selectedReference.kind,
        },
      ];
    });
  }, [currency, documentLanguage, isDepositPaymentDocument, safeDepositAmount, selectedReference]);

  const updatePaymentScheduleRow = (id: string, patch: Partial<PaymentScheduleRow>) => {
    setInvoicePaymentSchedule((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  };

  const addPaymentScheduleRow = () => {
    setInvoicePaymentSchedule((current) => [
      ...current,
      {
        id: createClientId(),
        label: `${labels.installment} ${current.length + 1}`,
        type: "percent",
        value: 0,
        amount: 0,
        dueDate: "",
      },
    ]);
  };

  const removePaymentScheduleRow = (id: string) => {
    setInvoicePaymentSchedule((current) => current.filter((row) => row.id !== id));
  };

  const previewDocument = () => {
    const nextErrors = validationErrors;
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      const firstKey = Object.keys(nextErrors)[0];
      document.querySelector<HTMLElement>(`[data-field="${firstKey}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error(Object.values(nextErrors)[0] ?? "Required fields are missing.");
      return;
    }
    if (isInvoiceDocument && invoicePaymentMode === "deposit" && safeDepositAmount <= 0) {
      toast.error(documentLanguage === "th" ? "กรุณาระบุยอดมัดจำ" : "Enter a deposit amount.");
      return;
    }
    if (isInvoiceDocument && invoicePaymentMode === "deposit" && !depositAmountValid) {
      toast.error(documentLanguage === "th" ? "ยอดมัดจำต้องไม่เกินยอดเอกสารอ้างอิงหรือยอดเอกสาร" : "Deposit amount cannot exceed the reference or invoice total.");
      return;
    }
    if (isInvoiceDocument && invoicePaymentMode === "partial_payment" && !paymentScheduleValid) {
      toast.error(labels.paymentScheduleTotalError);
      setPaymentScheduleOpen(true);
      return;
    }
    const unacknowledged = lines.find((line) => stockWarning(line) && !line.stockOverrideAcknowledged);
    if (unacknowledged) {
      toast.error("Acknowledge the stock warning before previewing this document.");
      return;
    }
    setFieldErrors({});
    setIsPreviewing(true);
  };

  const submit = async (submitMode: "draft" | "create") => {
    if (!isPreviewing) {
      toast.error("Preview the document before saving or creating it.");
      return;
    }

    setSubmitting(submitMode);
    try {
      if (isInvoiceDocument && invoicePaymentMode === "partial_payment" && !paymentScheduleValid) {
        toast.error(labels.paymentScheduleTotalError);
        setPaymentScheduleOpen(true);
        return;
      }
      if (isInvoiceDocument && invoicePaymentMode === "deposit" && !depositAmountValid) {
        toast.error(documentLanguage === "th" ? "ยอดมัดจำต้องไม่เกินยอดเอกสารอ้างอิงหรือยอดเอกสาร" : "Deposit amount cannot exceed the reference or invoice total.");
        return;
      }
      const savedCustomer = await saveCustomerSnapshot(customer, data.customers, data.vendors, customerMode, selectedCustomerId, "profile");
      await saveNewProducts(lines, productBySku);
      if (submitMode === "draft" && Object.keys(validationErrors).length > 0) {
        toast.warning(`${Object.keys(validationErrors).length} required fields are still missing. Saving as draft.`);
      }

      const created = await createDocument(kind, {
        ...buildDocumentPayload(submitMode === "draft" ? "draft" : "pending"),
        customer: savedCustomer?.name ?? customer.name,
        customerInfo: { ...customer, code: savedCustomer?.id ?? customer.code },
      });

      if (poAttachmentFiles.length > 0) {
        await uploadAttachments({
          entityType: kind,
          entityId: created.id,
          files: poAttachmentFiles,
          category: "customer_po",
          note: "Customer PO / purchase order evidence. Internal record only; not printed on document PDF.",
          attachedBy: selectedSellerUser?.name || salesperson || "Matter Acc.",
          tags: ["customer_po", "customer-po", "internal-only"],
        });
      }

      await refresh();
      setPoAttachmentFiles([]);
      toast.success(submitMode === "draft" ? `Draft ${created.id} saved` : `Document ${created.id} created`, {
        description:
          poAttachmentFiles.length > 0
            ? `${documentTitleTh} - ${poAttachmentFiles.length} PO file(s) attached`
            : documentTitleTh,
      });
      nav(resolveSalesDocumentRoute(kind, created.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save document.");
    } finally {
      setSubmitting(null);
    }
  };

  if (isPreviewing) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="outline" className="gap-1.5" onClick={() => setIsPreviewing(false)} disabled={Boolean(submitting)}>
            <ArrowLeft className="h-4 w-4" /> Back to Edit
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => void downloadPreviewPdf()} disabled={Boolean(submitting) || downloadingPdf}>
              {downloadingPdf ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
              {documentLanguage === "th" ? "ดาวน์โหลด PDF" : "Download PDF"}
            </Button>
            <Button type="button" variant="outline" onClick={() => void submit("draft")} disabled={Boolean(submitting)}>
              {submitting === "draft" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              {documentLanguage === "th" ? "บันทึกร่าง" : "Save Draft"}
            </Button>
            <Button type="button" className="border-0 bg-gradient-brand text-primary-foreground shadow-brand" onClick={() => void submit("create")} disabled={Boolean(submitting)}>
              {submitting === "create" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
              {mode === "edit" ? (documentLanguage === "th" ? "บันทึกเอกสาร" : "Save Document") : (documentLanguage === "th" ? "สร้างเอกสาร" : "Create Document")}
            </Button>
          </div>
        </div>
        <SalesDocumentTemplate
          previewRef={previewRef}
          data={{
            title: previewTitle,
            titleEn: documentTitleEn,
            documentTypes: isInvoiceDocument
              ? realTypes.map((type) => (type === "invoice" && invoiceTaxType === "tax" ? "tax_invoice" : type))
              : realTypes,
            copyGeneration,
            language: documentLanguage === "th" ? "th" : "en",
            status: "approved",
            documentNumber,
            seller,
            customer,
            branding,
            documentSettingsSnapshot,
            issueDate,
            dueDate,
            creditTerms,
            reference,
            relatedDocument,
            referenceDocuments: referenceDocuments.map((item) => ({
              id: item.id,
              number: item.id,
              type: item.kind,
              kind: item.kind,
              party: item.party,
              date: item.date,
              total: item.amount,
              status: item.status,
            })),
            documentContact,
            sellerUser: selectedSellerUser
              ? {
                  id: selectedSellerUser.id,
                  name: selectedSellerUser.name,
                  email: selectedSellerUser.email,
                }
              : undefined,
            lines,
            totals,
            discountRate: discountValue,
            withholdingRate: effectiveWithholdingRate,
            currency,
            paymentMethod,
            paymentDetails,
            selectedBankAccount,
            paymentTerms,
            notes,
            amountWordsThai,
            amountWordsEnglish,
            showAmountPaid: hasRelatedDocument,
            invoicePaymentMode: isInvoiceDocument ? invoicePaymentMode : undefined,
            invoiceDeductions: isInvoiceDocument && priorInvoiceDeductions.length ? priorInvoiceDeductions : undefined,
            invoicePaymentSchedule: isInvoiceDocument && invoicePaymentMode === "partial_payment" ? calculatedPaymentSchedule : undefined,
          }}
        />
      </div>
    );
  }

  return (
    <form className="min-w-0 max-w-full space-y-6 overflow-x-hidden pb-28 sm:pb-24">
      <Card className="mx-auto w-full max-w-6xl overflow-hidden bg-white p-4 text-slate-950 shadow-xl sm:p-6">
        <div className="grid min-w-0 gap-6 border-b border-slate-200 pb-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
          <div className="flex min-w-0 gap-4">
            <div className="flex h-20 w-28 shrink-0 items-center justify-center border border-slate-200 bg-slate-50">
              {branding.logoUrl ? <img src={resolveAssetUrl(branding.logoUrl)} alt="Company logo" className="max-h-16 max-w-24 object-contain" /> : <Image className="h-8 w-8 text-slate-400" />}
            </div>
            <div className="min-w-0">
              <CompactIdentity
                label={labels.seller}
                value={seller.name || "Company profile not loaded"}
                helper={labels.loadedFromSettings}
                expanded={sellerExpanded}
                onToggle={() => setSellerExpanded((current) => !current)}
                onEdit={openSellerModal}
              />
              {sellerExpanded ? (
                <div className="mt-3">
                  <SellerSnapshot seller={seller} branding={branding} loaded={companyLoaded} warnings={companyWarnings} />
                </div>
              ) : companyLoaded && companyWarnings.length ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-950">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {labels.companyIncomplete}
                  <a className="font-semibold underline" href="/settings/company">{labels.settings}</a>
                </div>
              ) : null}
            </div>
          </div>
          <div className="min-w-0 justify-self-stretch text-left xl:max-w-[420px] xl:justify-self-end xl:text-right">
            <div className="mb-3 flex flex-wrap justify-start gap-2 xl:justify-end">
              <Select value={copyGeneration} onValueChange={(value) => setCopyGeneration(value as CopyGeneration)}>
                <SelectTrigger className="h-8 w-full min-w-0 border-slate-200 bg-white text-xs sm:w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {localizedCopyOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {documentLanguage === "th" ? option.th : option.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={documentLanguage} onValueChange={(value) => setDocumentLanguage(value as DocumentLanguage)}>
                <SelectTrigger className="h-8 w-20 min-w-0 border-slate-200 bg-white text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="th">TH</SelectItem>
                  <SelectItem value="en">EN</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <h2 className={`${previewTitleSizeClass} break-words font-bold leading-tight`}>{previewTitle}</h2>
            <div className="mt-3 w-full max-w-56 xl:ml-auto" data-field="documentNumber">
              <Input
                value={documentNumber}
                onChange={(event) => {
                  setDocumentNumberEdited(true);
                  setDocumentNumber(event.target.value);
                }}
                className={`h-9 border-slate-200 bg-white text-right font-mono text-base font-bold text-primary ${fieldErrors.documentNumber ? "border-destructive" : ""}`}
              />
              <FieldError message={fieldErrors.documentNumber} />
            </div>
            <div className="mt-4 grid w-full min-w-0 gap-3 text-left">
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <div className="min-w-0" data-field="issueDate">
                  <Label>{labels.issueDate}<RequiredMark /></Label>
                  <Input type="date" value={issueDate} onChange={(event) => { setIssueDate(event.target.value); setDueDateEdited(false); }} className={`mt-1.5 min-w-0 border-slate-200 ${fieldErrors.issueDate ? "border-destructive" : ""}`} />
                  <FieldError message={fieldErrors.issueDate} />
                </div>
                <div className="min-w-0" data-field="dueDate">
                  <Label>{labels.dueDate}<RequiredMark /></Label>
                  <Input type="date" value={dueDate} onChange={(event) => { setDueDate(event.target.value); setDueDateEdited(true); }} className={`mt-1.5 min-w-0 border-slate-200 ${fieldErrors.dueDate ? "border-destructive" : ""}`} />
                  <FieldError message={fieldErrors.dueDate} />
                </div>
              </div>
              <div>
                <Label>{documentLanguage === "th" ? "ประเภทเอกสาร" : "Document type"}</Label>
                <div className="mt-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold">
                  {previewTitle}
                </div>
              </div>
              {isInvoiceDocument ? (
                <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                  <div className="min-w-0">
                    <Label>{labels.invoiceType}<RequiredMark /></Label>
                    <Select
                      value={isTaxInvoiceDocument ? "tax" : invoiceTaxType}
                      onValueChange={(value) => setInvoiceTaxType(value as "normal" | "tax")}
                      disabled={isTaxInvoiceDocument}
                    >
                      <SelectTrigger className="mt-1.5 min-w-0 border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">{labels.normalInvoice}</SelectItem>
                        <SelectItem value="tax">{labels.taxInvoice}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0">
                    <Label>{labels.paymentMode}<RequiredMark /></Label>
                    <Select
                      value={invoicePaymentMode}
                      onValueChange={(value) => {
                        const mode = value as InvoicePaymentMode;
                        setInvoicePaymentMode(mode);
                        if (mode === "partial_payment") {
                          setInvoicePaymentSchedule([{
                            id: createClientId(),
                            label: `${labels.installment} 1`,
                            type: "percent",
                            value: remainingPartialPercent || 100,
                            amount: 0,
                            dueDate: "",
                          }]);
                          setPaymentScheduleOpen(true);
                        }
                      }}
                    >
                      <SelectTrigger className="mt-1.5 min-w-0 border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full_payment">{labels.fullPayment}</SelectItem>
                        <SelectItem value="partial_payment">{labels.partialPayment}</SelectItem>
                        <SelectItem value="deposit">{labels.deposit}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : null}
              <Label>{labels.referenceDocuments}</Label>
              <ReferenceCombobox
                open={referenceSearchOpen}
                onOpenChange={setReferenceSearchOpen}
                options={referenceOptions}
                selected={selectedReference}
                currency={currency}
                language={documentLanguage}
                onSelect={(id) => {
                  setReferenceSearchOpen(false);
                  selectReferenceDocument(id);
                }}
                onClear={clearReferenceDocument}
                labels={labels}
              />
              {referenceDocuments.length ? (
                <ReferenceGroupList
                  references={referenceDocuments}
                  currency={currency}
                  language={documentLanguage}
                  labels={labels}
                  onView={(reference) => window.location.assign(resolveSalesDocumentRoute(reference.kind, reference.id))}
                  onRemove={(reference) => removeReferenceDocument(reference.id)}
                  onReimport={(reference) => {
                    setPendingReference(reference);
                    setReferenceConfirmOpen(true);
                  }}
                />
              ) : null}
              {isInvoiceDocument && invoicePaymentMode === "partial_payment" ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{labels.paymentSchedule}</p>
                      <p className={cn("text-xs", paymentScheduleValid ? "text-blue-900" : "text-destructive")}>
                        {formatMoney(paymentScheduleTotal, currency)} / {formatMoney(remainingPartialAmount, currency)}
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setPaymentScheduleOpen(true)}>
                      {labels.setupPaymentSchedule}
                    </Button>
                  </div>
                  <div className="mt-3 grid gap-2 border-t border-blue-200 pt-3 text-xs">
                    <SummaryMiniLine label={labels.currentPaymentAmount} value={formatMoney(paymentScheduleTotal, currency)} />
                    <SummaryMiniLine label={labels.remainingBalance} value={formatMoney(Math.max(remainingPartialAmount - paymentScheduleTotal, 0), currency)} />
                    <SummaryMiniLine label={labels.remainingPercent} value={formatPercent(Math.max(remainingPartialPercent - paymentSchedulePercentTotal, 0))} />
                  </div>
                </div>
              ) : null}
              {isInvoiceDocument && invoicePaymentMode === "deposit" ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
                  <div className="grid gap-3">
                    <div>
                      <Label>{depositType === "percent" ? labels.depositPercent : labels.depositAmount}</Label>
                      <Select value={depositType} onValueChange={(value) => setDepositType(value as DiscountType)}>
                        <SelectTrigger className="mt-1.5 border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percent">{labels.percent} (%)</SelectItem>
                          <SelectItem value="amount">{labels.amount} ({currency})</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      value={depositValue}
                      onChange={(event) => setDepositValue(Math.max(Number(event.target.value) || 0, 0))}
                      className="border-slate-200 bg-white text-right tabular-nums"
                    />
                    <Button type="button" variant="outline" onClick={applyDepositLine}>
                      {labels.applyDepositLine}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-emerald-950">
                    {labels.depositAmount}: {formatMoney(safeDepositAmount, currency)} / {labels.remainingBalance}:{" "}
                    {formatMoney(Math.max(depositBaseAmount - safeDepositAmount, 0), currency)}
                  </p>
                  {!depositAmountValid ? (
                    <p className="mt-1 text-xs text-destructive">
                      {documentLanguage === "th" ? "ยอดมัดจำต้องไม่เกินยอดเอกสารอ้างอิงหรือยอดเอกสาร" : "Deposit amount cannot exceed the reference or invoice total."}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-3">
                <Label htmlFor="customer-po-reference">
                  {documentLanguage === "th" ? "เลขที่ PO ลูกค้า / เลขอ้างอิง" : "Customer PO No. / Reference No."}
                </Label>
                <Input
                  id="customer-po-reference"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder={documentLanguage === "th" ? "เช่น PO-2026-001" : "e.g. PO-2026-001"}
                  className="mt-1.5 min-w-0 border-slate-200 bg-white"
                />
              </div>

              {showPoAttachmentBox ? (
                <div className="mt-3">
                  <PoAttachmentBox
                    files={poAttachmentFiles}
                    onFilesChange={setPoAttachmentFiles}
                    disabled={Boolean(submitting)}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {taxGuidanceMessages.length ? (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">{t("taxGuidance.title")}</p>
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  {taxGuidanceMessages.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <PaperBlock title={labels.customer}>
            <div className="mb-3" data-field="customer">
              <Label>{labels.searchCustomer}<RequiredMark /></Label>
              <CustomerCombobox
                customers={customerOptions}
                selected={customer}
                language={documentLanguage}
                onSelect={selectCustomer}
                onCreate={() => openCustomerModal("new")}
                onEdit={() => openCustomerModal("existing")}
              />
              <FieldError message={fieldErrors.customer} />
            </div>
            <CompactIdentity
              label={labels.customer}
              value={[customer.code, customer.name].filter(Boolean).join(" ") || (documentLanguage === "th" ? "ยังไม่ได้เลือกลูกค้า" : "No customer selected")}
              helper={labels.expandCustomer}
              expanded={customerExpanded}
              onToggle={() => setCustomerExpanded((current) => !current)}
              onEdit={() => openCustomerModal("existing")}
            />
            {customerExpanded ? (
              <div className="mt-3">
                <CustomerSnapshot customer={customer} />
              </div>
            ) : null}
          </PaperBlock>

          <PaperBlock title={documentLanguage === "th" ? "การตั้งค่าเอกสาร" : "Document settings"}>
            <div className="grid grid-cols-2 gap-3">
              <div data-field="creditTerms">
                <Label>{labels.creditTerm}<RequiredMark /></Label>
                <Select value={creditTermSelectValue} onValueChange={(value) => { setCreditTerms(value === "custom" ? "" : value); setDueDateEdited(false); }}>
                  <SelectTrigger className="mt-1.5 border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {standardCreditTerms.map((days) => (
                      <SelectItem key={days} value={days}>{days} days</SelectItem>
                    ))}
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                {creditTermSelectValue === "custom" ? (
                  <Input
                    type="number"
                    value={creditTerms}
                    className="mt-2 h-8 border-slate-200"
                    placeholder={labels.customDays}
                    onChange={(event) => {
                      setCreditTerms(event.target.value);
                      setDueDateEdited(false);
                    }}
                  />
                ) : null}
                <FieldError message={fieldErrors.creditTerms} />
              </div>
              <div>
                <Label>{documentLanguage === "th" ? "การตั้งค่า VAT" : "VAT setting"}</Label>
                <Select
                  value={effectiveVatEnabled ? "include" : "none"}
                  onValueChange={(value) => setVatEnabled(companyVatRegistered && value === "include")}
                  disabled={!companyVatRegistered}
                >
                  <SelectTrigger className="mt-1.5 border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="include">{documentLanguage === "th" ? "มี VAT" : "Include VAT"}</SelectItem>
                    <SelectItem value="none">{documentLanguage === "th" ? "ไม่มี VAT" : "No VAT"}</SelectItem>
                  </SelectContent>
                </Select>
                {!companyVatRegistered ? (
                  <p className="mt-1 text-xs text-amber-700">{labels.vatDisabledMessage}</p>
                ) : null}
              </div>
              <div>
                <Label>{labels.project}</Label>
                <div className="mt-1.5 flex gap-1">
                  <Select value={projectId || "none"} onValueChange={(value) => setProjectId(value === "none" ? "" : value)}>
                    <SelectTrigger className="border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No project</SelectItem>
                      {data.projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {[project.code, project.name].filter(Boolean).join(" - ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => setProjectModalOpen(true)} aria-label={labels.createProject} title={labels.createProject}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label>{labels.documentContact}</Label>
                {internalUsers.length ? (
                  <Select
                    value={sellerUserId}
                    onValueChange={(id) => {
                      const user = internalUsers.find((item) => item.id === id);
                      setSellerUserId(id);
                      if (user) {
                        setSalesperson(user.name);
                        setDocumentContact(`${user.name}${user.email ? ` (${user.email})` : ""}`);
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1.5 border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {internalUsers.map((user) => {
                        const value = `${user.name}${user.email ? ` (${user.email})` : ""}`;
                        return (
                          <SelectItem key={user.id || value} value={user.id || value}>
                            {value}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="mt-1.5 min-h-9 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {documentContact || seller.contactPerson || seller.phone || seller.email || "-"}
                  </div>
                )}
              </div>
              <div data-field="currency">
                <Label>{labels.currency}<RequiredMark /></Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="mt-1.5 border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {currencyOptions.map((currencyCode) => (
                      <SelectItem key={currencyCode} value={currencyCode}>{currencyCode}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={fieldErrors.currency} />
              </div>
            </div>
          </PaperBlock>
        </div>

        {isDepositPaymentDocument ? (
          <div className="mt-6 min-w-0 max-w-full overflow-x-auto rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 [contain:inline-size]">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-xs uppercase text-emerald-900">
                <tr>
                  <th className="w-56 px-2 py-2 text-left">{labels.description}</th>
                  <th className="px-2 py-2 text-left">{labels.referenceDocuments}</th>
                  <th className="w-40 px-2 py-2 text-right">{labels.amount}</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-t border-emerald-200 align-top">
                    <td className="px-2 py-2">
                      <Input value={line.desc} onChange={(event) => updateLine(line.id, "desc", event.target.value)} className="border-slate-200 bg-white" />
                    </td>
                    <td className="px-2 py-2">
                      <Input value={line.details} onChange={(event) => updateLine(line.id, "details", event.target.value)} className="border-slate-200 bg-white" />
                    </td>
                    <td className="px-2 py-2">
                      <Input type="number" min={0} value={line.price} onChange={(event) => updateLine(line.id, "price", event.target.value)} className="border-slate-200 bg-white text-right tabular-nums" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
        <div className="mt-6 min-w-0 max-w-full overflow-x-auto [contain:inline-size]">
          <div data-field="lines">
            <FieldError message={fieldErrors.lines} />
          </div>
          <datalist id="sales-product-codes-paper">
            {data.products.map((product) => (
              <option key={product.sku} value={product.sku}>{product.name}</option>
            ))}
          </datalist>
          <datalist id="sales-product-names-paper">
            {data.products.map((product) => (
              <option key={product.sku} value={product.name}>{product.sku} - {product.name}</option>
            ))}
          </datalist>
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th className="w-32 px-2 py-2 text-left">{labels.code}</th>
                <th className="min-w-72 px-2 py-2 text-left">{labels.descriptionDetail}</th>
                <th className="w-20 px-2 py-2 text-right">{labels.quantity}</th>
                <th className="w-24 px-2 py-2 text-left">{labels.unit}</th>
                <th className="w-32 px-2 py-2 text-right">{labels.unitPrice}</th>
                {perLineDiscount ? (
                  <th className="w-44 px-2 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span>{labels.discount}</span>
                      <Select value={lineDiscountType} onValueChange={(value) => setLineDiscountType(value as DiscountType)}>
                        <SelectTrigger className="h-8 w-12 border-slate-200 bg-white text-center text-sm normal-case" aria-label={documentLanguage === "th" ? "ประเภทส่วนลด" : "Discount type"}>
                          <span className="w-full text-center">{lineDiscountType === "percent" ? "%" : "฿"}</span>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percent">{documentLanguage === "th" ? "เปอร์เซ็นต์ (%)" : "Percent (%)"}</SelectItem>
                          <SelectItem value="amount">{documentLanguage === "th" ? "จำนวนเงิน (฿)" : "Amount (฿)"}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </th>
                ) : null}
                {perLineVat ? <th className="w-20 px-2 py-2 text-right">{labels.vat} %</th> : null}
                {perLineWithholdingTax ? <th className="w-20 px-2 py-2 text-right">{labels.wht} %</th> : null}
                <th className="w-32 px-2 py-2 text-right">{labels.total}</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const amounts = lineAmounts(
                  {
                    ...line,
                    tax: effectiveVatEnabled ? (perLineVat ? sanitizeWholePercent(line.tax) : documentVatRate) : 0,
                    withholdingRate: perLineWithholdingTax ? sanitizeWhtRate(line.withholdingRate ?? 0) : effectiveWithholdingRate,
                  },
                  {
                    vatEnabled: effectiveVatEnabled,
                    taxMode,
                    perLineDiscount,
                    defaultTaxRate: documentVatRate,
                    withholdingEnabled,
                    withholdingRate: perLineWithholdingTax ? sanitizeWhtRate(line.withholdingRate ?? 0) : effectiveWithholdingRate,
                    lineDiscountType,
                  }
                );
                const warning = stockWarning(line);
                const exists = Boolean(line.inventoryId) || productBySku.has(line.sku.trim().toLowerCase());
                const lastCustomerPrice = findLastCustomerPrice(data.invoices, customer, line.inventoryId || line.originalInventoryCode || line.sku);
                return (
                  <tr key={line.id} className={`border-b border-slate-200 align-top ${warning ? "bg-red-50" : ""}`}>
                    <td className="px-2 py-2">
                      <ProductCombobox
                              language={documentLanguage}
                        value={line.sku}
                        products={data.products}
                        mode="code"
                        onSelect={(product) => updateLineFromProduct(line.id, product)}
                        onChange={(value) => updateLine(line.id, "sku", value)}
                      />
                      {line.sku && !exists ? (
                        <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                          <input type="checkbox" checked={Boolean(line.addAsProduct)} onChange={(event) => updateLine(line.id, "addAsProduct", event.target.checked)} />
                          {documentLanguage === "th" ? "เพิ่มเป็นสินค้า/บริการใหม่" : "Add as new product/service"}
                        </label>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">
                      <div className="space-y-1.5">
                        <ProductCombobox
                              language={documentLanguage}
                          value={line.desc}
                          products={data.products}
                          mode="description"
                          placeholder={labels.description}
                          className={fieldErrors[`line-${line.id}-desc`] ? "border-destructive" : ""}
                          onSelect={(product) => updateLineFromProduct(line.id, product)}
                          onChange={(value) => updateLine(line.id, "desc", value)}
                        />
                        <FieldError message={fieldErrors[`line-${line.id}-desc`]} />
                        <Input value={line.details} onChange={(event) => updateLine(line.id, "details", event.target.value)} className="h-8 border-slate-200 text-xs" placeholder={labels.detail} />
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <Input type="number" value={line.qty} onChange={(event) => updateLine(line.id, "qty", event.target.value)} className={`h-8 border-slate-200 text-right tabular-nums ${warning || fieldErrors[`line-${line.id}-qty`] ? "border-destructive text-destructive" : ""}`} />
                      <FieldError message={fieldErrors[`line-${line.id}-qty`]} />
                      {warning ? (
                        <div className="mt-1 space-y-1 text-[11px] text-destructive">
                          <p>Only {formatQuantity(line.availableStock)} units available in stock. You entered {formatQuantity(line.qty)}.</p>
                          <label className="flex items-center gap-2">
                            <input type="checkbox" checked={Boolean(line.stockOverrideAcknowledged)} onChange={(event) => updateLine(line.id, "stockOverrideAcknowledged", event.target.checked)} />
                            {documentLanguage === "th" ? "ยืนยันการ override" : "Acknowledge override"}
                          </label>
                        </div>
                      ) : null}
                    </td>
                    <td className="px-2 py-2"><Input value={line.unit} onChange={(event) => updateLine(line.id, "unit", event.target.value)} className="h-8 border-slate-200" /></td>
                    <td className="px-2 py-2">
                      <Input type="number" value={line.price} onChange={(event) => updateLine(line.id, "price", event.target.value)} className={`h-8 border-slate-200 text-right tabular-nums ${fieldErrors[`line-${line.id}-price`] ? "border-destructive" : ""}`} />
                      <FieldError message={fieldErrors[`line-${line.id}-price`]} />
                      {lastCustomerPrice !== null && lastCustomerPrice !== Number(line.price) ? (
                        <button type="button" className="mt-1 text-left text-[11px] font-medium text-primary underline-offset-2 hover:underline" onClick={() => updateLine(line.id, "price", lastCustomerPrice)}>
                          Last price: {formatNumber(lastCustomerPrice)}
                        </button>
                      ) : null}
                    </td>
                    {perLineDiscount ? (
                      <td className="px-2 py-2">
                        <div>
                          <Input
                            type="number"
                            min={0}
                            value={line.discountValue ?? line.discount}
                            onChange={(event) => updateLine(line.id, "discountValue", event.target.value)}
                            className="h-8 border-slate-200 text-right tabular-nums"
                            aria-label={labels.discount}
                          />
                        </div>
                      </td>
                    ) : null}
                    {perLineVat ? (
                      <td className="px-2 py-2">
                        <Select
                          value={String(sanitizeWholePercent(line.tax))}
                          onValueChange={(value) => updateLine(line.id, "tax", value === "exempt" ? 0 : Number(value))}
                          disabled={!effectiveVatEnabled}
                        >
                          <SelectTrigger className="h-8 border-slate-200 disabled:bg-slate-100" aria-label={`${labels.vat} %`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {vatRateOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    ) : null}
                    {perLineWithholdingTax ? (
                      <td className="px-2 py-2">
                        <Select
                          value={String(sanitizeWhtRate(line.withholdingRate ?? 0))}
                          onValueChange={(value) => updateLine(line.id, "withholdingRate", Number(value))}
                        >
                          <SelectTrigger className="h-8 border-slate-200" aria-label={documentLanguage === "th" ? "หัก ณ ที่จ่าย %" : "WHT %"}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {whtRateOptions.map((rate) => (
                              <SelectItem key={rate} value={String(rate)}>{rate}%</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    ) : null}
                    <td className="px-2 py-2 text-right font-semibold tabular-nums">{formatNumber(amounts.totalAmount)}</td>
                    <td className="px-2 py-2">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeLine(line.id)} aria-label="Remove line">
                        <Trash2 className="h-4 w-4 text-slate-500" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Button type="button" variant="outline" size="sm" className="mt-3 gap-1.5" onClick={addLine}>
            <Plus className="h-4 w-4" /> {labels.addLine}
          </Button>
        </div>
        )}

        <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
          <section className="min-w-0 space-y-4 text-sm">
            <PaperBlock title={labels.payment}>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>{labels.paymentMethod}<RequiredMark /></Label>
                  <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethodChoice)}>
                    <SelectTrigger className="mt-1.5 border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {paymentMethodOptions.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError message={fieldErrors.paymentMethod} />
                </div>
              </div>
              {paymentMethod === "Bank Transfer" ? (
                <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Label>{labels.companyBankAccount}{paymentMethod === "Bank Transfer" ? <RequiredMark /> : null}</Label>
                      <HelpHint content={labels.bankScope} />
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowAddBankAccount((current) => !current)}>
                      {labels.addBank}
                    </Button>
                  </div>
                  {companyBankAccounts.length ? (
                    <Select value={paymentDetails.selectedBankAccountId} onValueChange={selectBankAccount}>
                      <SelectTrigger className="border-slate-200 bg-white"><SelectValue placeholder="Select company bank account" /></SelectTrigger>
                      <SelectContent>
                        {companyBankAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.bankName} - {account.accountNumber}{account.isDefault ? " (Default)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                      <AlertTriangle className="h-4 w-4" />
                      {labels.noBank}
                    </div>
                  )}
                  <FieldError message={fieldErrors.bankAccount} />
                  {selectedBankAccount ? (
                    <SelectedBankAccountCard account={selectedBankAccount} />
                  ) : null}
                  {showAddBankAccount ? (
                    <div className="grid gap-3 rounded-lg border border-primary/20 bg-white p-4 md:grid-cols-2">
                      <TextField label="Bank name" value={newBankAccount.bankName} onChange={(value) => updateNewBankAccount("bankName", value)} />
                      <TextField label="Account name" value={newBankAccount.accountName} onChange={(value) => updateNewBankAccount("accountName", value)} />
                      <TextField label="Account number" value={newBankAccount.accountNumber} onChange={(value) => updateNewBankAccount("accountNumber", value)} />
                      <TextField label="Branch" value={newBankAccount.branch ?? ""} onChange={(value) => updateNewBankAccount("branch", value)} />
                      <TextField label="PromptPay ID" value={newBankAccount.promptPayId ?? ""} onChange={(value) => updateNewBankAccount("promptPayId", value)} />
                      <TextField label="SWIFT code" value={newBankAccount.swiftCode ?? ""} onChange={(value) => updateNewBankAccount("swiftCode", value)} />
                      <label className="flex items-center gap-2 text-sm md:col-span-2">
                        <input type="checkbox" checked={Boolean(newBankAccount.isDefault)} onChange={(event) => updateNewBankAccount("isDefault", event.target.checked)} />
                        Set as default company bank account
                      </label>
                      <div className="flex justify-end gap-2 md:col-span-2">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddBankAccount(false)}>Cancel</Button>
                        <Button type="button" size="sm" onClick={() => void saveBankAccountFromDocument()}>Save to Company Settings</Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </PaperBlock>

            <PaperBlock title={labels.notes}>
              <div>
                <div className="flex items-center gap-2">
                  <Label>{labels.customerNote}</Label>
                  <HelpHint content={labels.customerFacingNote} />
                </div>
                <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={5} className="mt-1.5 border-slate-200" />
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
                <div>
                  <Label>{labels.chooseRemark}</Label>
                  <Select value={remarkTemplateId} onValueChange={applyRemarkTemplate}>
                    <SelectTrigger className="mt-1.5 border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No template</SelectItem>
                      {availableRemarkTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" variant="outline" size="sm" className="mt-7" onClick={saveCurrentRemarkAsTemplate}>
                  <Save className="mr-1.5 h-4 w-4" /> {labels.saveRemarkTemplate}
                </Button>
              </div>
              <div className="mt-4 border-t border-slate-200 pt-4">
                <div className="flex items-center gap-2">
                  <Label>{labels.internalNote}</Label>
                  <HelpHint content={labels.internalOnlyNote} />
                </div>
                <Textarea value={internalNote} onChange={(event) => setInternalNote(event.target.value)} rows={3} className="mt-1.5 border-slate-200" placeholder="Internal only; not shown on the customer-facing document." />
              </div>
            </PaperBlock>
          </section>
          <section className="min-w-0 rounded-lg border border-slate-200 p-4">
            <EditableTotalsSummary
              totals={totals}
              lines={lines}
              currency={currency}
              labels={labels}
              showAmountPaid={hasRelatedDocument}
              discountRate={discountValue}
              onDiscountRateChange={(value) => setDiscountValue(clampNumericPercent(value))}
              withholdingRate={withholdingRate}
              onWithholdingRateChange={(value) => setWithholdingRate(sanitizeWhtRate(value))}
              showWithholding={showWhtFooter && !perLineWithholdingTax}
            />
            {hasRelatedDocument ? <TextField label={labels.amountPaid} value={amountPaid} onChange={() => undefined} type="number" readOnly /> : null}
            <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs">
              <p className="font-semibold">{labels.amountWords}</p>
              <p className="mt-1 text-slate-600">{documentLanguage === "th" ? amountWordsThai : amountWordsEnglish}</p>
            </div>
          </section>
        </div>

        <StaticSignaturePreview language={documentLanguage} />
      </Card>

      <div className="hidden">
      <Card className="card-premium border-primary/20 bg-white p-5 shadow-sm">
        <div className="grid items-start gap-5 lg:grid-cols-[180px_1fr_360px]">
          <div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-primary/25 bg-secondary/25 p-4">
            {branding.logoUrl ? (
              <img src={resolveAssetUrl(branding.logoUrl)} alt="Company logo" className="max-h-24 max-w-full object-contain" />
            ) : (
              <Image className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 text-center lg:pt-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Document Header Area</p>
            <h2 className="mt-1 break-words font-display text-3xl font-bold text-foreground">{previewTitle}</h2>
            <p className="mt-1 text-sm font-medium text-muted-foreground">{documentTitleEn}</p>
            <p className="mt-2 text-xs text-muted-foreground">This area appears as the top document title and document information box.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {realTypes.map((type) => (
                <span key={type} className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-primary shadow-sm">
                  {type}
                </span>
              ))}
            </div>
          </div>
          <div className="grid gap-3 rounded-xl border border-primary/20 bg-card p-4 shadow-sm">
            <div>
              <Label>ต้นฉบับ / สำเนา</Label>
              <Select value={copyGeneration} onValueChange={(value) => setCopyGeneration(value as CopyGeneration)}>
                <SelectTrigger className="mt-1.5 bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {localizedCopyOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{documentLanguage === "th" ? option.th : option.en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Document language</Label>
              <Select value={documentLanguage} onValueChange={(value) => setDocumentLanguage(value as DocumentLanguage)}>
                <SelectTrigger className="mt-1.5 bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="th">TH</SelectItem>
                  <SelectItem value="en">EN</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border border-primary/20 bg-card px-4 py-3 text-sm shadow-sm">
              <p className="text-xs text-muted-foreground">Auto document number</p>
              <p className="font-mono text-lg font-bold text-primary">{documentNumber}</p>
            </div>
            <TextField label="Issue date" value={issueDate} onChange={(value) => { setIssueDate(value); setDueDateEdited(false); }} type="date" />
            <div className="grid grid-cols-[1fr_96px] gap-2">
              <div>
                <Label>Credit term</Label>
                <Select value={creditTerms} onValueChange={(value) => { setCreditTerms(value); setDueDateEdited(false); }}>
                  <SelectTrigger className="mt-1.5 bg-card"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["0", "7", "15", "30", "45", "60"].map((days) => (
                      <SelectItem key={days} value={days}>{days} days</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <TextField label="Custom" value={creditTerms} onChange={(value) => { setCreditTerms(value); setDueDateEdited(false); }} type="number" />
            </div>
            <TextField label="Due date" value={dueDate} onChange={(value) => { setDueDate(value); setDueDateEdited(true); }} type="date" />
            <TextField label="Reference number" value={reference} onChange={setReference} />
          </div>
        </div>
        <div className="mt-5 grid gap-4 border-t border-primary/20 pt-5 md:grid-cols-4">
          <div>
            <Label>Original / Copy</Label>
            <Select value={copyGeneration} onValueChange={(value) => setCopyGeneration(value as CopyGeneration)}>
              <SelectTrigger className="mt-1.5 bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                {localizedCopyOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{documentLanguage === "th" ? option.th : option.en}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Document language</Label>
            <Select value={documentLanguage} onValueChange={(value) => setDocumentLanguage(value as DocumentLanguage)}>
              <SelectTrigger className="mt-1.5 bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="th">TH</SelectItem>
                <SelectItem value="en">EN</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <TextField label="Related document number" value={relatedDocument} onChange={setRelatedDocument} />
          <div>
            <Label>Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="mt-1.5 bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                {currencyOptions.map((currencyCode) => (
                  <SelectItem key={currencyCode} value={currencyCode}>{currencyCode}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <div className="space-y-6">
          <Section
            icon={Building2}
            title="Seller / Company Information"
            helper="This section appears in the seller block and is loaded from Company Settings."
          >
            <CompactIdentity
              label="Seller"
              value={seller.name || "Company profile not loaded"}
              helper="Seller information loaded from Company Settings"
              expanded={sellerExpanded}
              onToggle={() => setSellerExpanded((current) => !current)}
              editHref="/settings/company"
            />
            {sellerExpanded ? (
              <SellerSnapshot seller={seller} branding={branding} loaded={companyLoaded} warnings={companyWarnings} />
            ) : companyLoaded && companyWarnings.length ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                <AlertTriangle className="h-4 w-4" />
                Company profile is incomplete.
                <a className="font-semibold underline" href="/settings/company">Open Settings</a>
              </div>
            ) : null}
          </Section>

          <Section
            icon={customerMode === "new" ? UserPlus : UserRoundSearch}
            title="Customer Information"
            helper="This section will appear in the customer block."
          >
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant={customerMode === "existing" ? "default" : "outline"} size="sm" onClick={() => { setCustomerMode("existing"); setCustomerExpanded(false); }}>
                Select existing customer
              </Button>
              <Button type="button" variant={customerMode === "new" ? "default" : "outline"} size="sm" onClick={() => { setCustomerMode("new"); setSelectedCustomerId(""); setCustomer(blankCustomer); setCustomerExpanded(true); }}>
                Create new customer
              </Button>
            </div>
            {customerMode === "existing" ? (
              <div>
                <Label>Search/select customer</Label>
                <Select value={selectedCustomerId} onValueChange={selectCustomer}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select a customer" /></SelectTrigger>
                  <SelectContent>
                    {customerOptions.map((item) => (
                      <SelectItem key={item.code} value={item.code}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {customerMode === "existing" ? (
              <CompactIdentity
                label="Customer"
                value={[customer.code, customer.name].filter(Boolean).join(" ") || "No customer selected"}
                helper="Full address, tax ID, branch, phone, and email are hidden until expanded."
                expanded={customerExpanded}
                onToggle={() => setCustomerExpanded((current) => !current)}
              />
            ) : null}
            {customerMode === "new" || customerExpanded ? <CustomerFields customer={customer} onChange={updateCustomerField} labels={labels} /> : null}
          </Section>

          <Section
            icon={PackageSearch}
            title="Item Description"
            helper="These rows appear in the main item table of the document."
          >
            <datalist id="sales-product-codes">
              {data.products.map((product) => (
                <option key={product.sku} value={product.sku}>{product.name}</option>
              ))}
            </datalist>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-xs">
                <thead className="uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b border-border/60">
                    <th className="w-32 px-2 py-2 text-left font-semibold">Code</th>
                    <th className="min-w-72 px-2 py-2 text-left font-semibold">Description / Detail</th>
                    <th className="w-20 px-2 py-2 text-right font-semibold">Qty</th>
                    <th className="w-24 px-2 py-2 text-left font-semibold">Unit</th>
                    <th className="w-28 px-2 py-2 text-right font-semibold">Unit price</th>
                    {perLineDiscount ? (
                      <th className="w-44 px-2 py-2 text-right font-semibold">
                        <div className="flex items-center justify-end gap-2">
                          <span>{labels.discount}</span>
                          <Select value={lineDiscountType} onValueChange={(value) => setLineDiscountType(value as DiscountType)}>
                            <SelectTrigger className="h-8 w-12 bg-card text-center text-sm normal-case" aria-label={documentLanguage === "th" ? "ประเภทส่วนลด" : "Discount type"}>
                              <span className="w-full text-center">{lineDiscountType === "percent" ? "%" : "฿"}</span>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percent">{documentLanguage === "th" ? "เปอร์เซ็นต์ (%)" : "Percent (%)"}</SelectItem>
                              <SelectItem value="amount">{documentLanguage === "th" ? "จำนวนเงิน (฿)" : "Amount (฿)"}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </th>
                    ) : null}
                    {perLineVat ? <th className="w-20 px-2 py-2 text-right font-semibold">VAT %</th> : null}
                    {perLineWithholdingTax ? <th className="w-20 px-2 py-2 text-right font-semibold">WHT %</th> : null}
                    <th className="w-32 px-2 py-2 text-right font-semibold">Total</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => {
                    const amounts = lineAmounts(
                      {
                        ...line,
                        tax: effectiveVatEnabled ? (perLineVat ? sanitizeWholePercent(line.tax) : documentVatRate) : 0,
                        withholdingRate: perLineWithholdingTax ? sanitizeWhtRate(line.withholdingRate ?? 0) : effectiveWithholdingRate,
                      },
                      {
                        vatEnabled: effectiveVatEnabled,
                        taxMode,
                        perLineDiscount,
                        defaultTaxRate: documentVatRate,
                        withholdingEnabled,
                        withholdingRate: perLineWithholdingTax ? sanitizeWhtRate(line.withholdingRate ?? 0) : effectiveWithholdingRate,
                        lineDiscountType,
                      }
                    );
                    const warning = stockWarning(line);
                    const exists = Boolean(line.inventoryId) || productBySku.has(line.sku.trim().toLowerCase());
                    const lastCustomerPrice = findLastCustomerPrice(data.invoices, customer, line.sku);
                    return (
                      <tr key={line.id} className={`border-b border-border/40 align-top ${warning ? "bg-destructive/5" : ""}`}>
                        <td className="px-2 py-2">
                          <Input list="sales-product-codes" value={line.sku} onChange={(event) => updateLine(line.id, "sku", event.target.value)} className="h-8" />
                          {line.sku && !exists ? (
                            <label className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                              <input type="checkbox" checked={Boolean(line.addAsProduct)} onChange={(event) => updateLine(line.id, "addAsProduct", event.target.checked)} />
                              {documentLanguage === "th" ? "เพิ่มเป็นสินค้า/บริการใหม่" : "Add as new product/service"}
                            </label>
                          ) : null}
                        </td>
                        <td className="px-2 py-2">
                          <div className="space-y-1.5">
                            <Input value={line.desc} onChange={(event) => updateLine(line.id, "desc", event.target.value)} className="h-8" placeholder={labels.description} />
                            <Input value={line.details} onChange={(event) => updateLine(line.id, "details", event.target.value)} className="h-8 text-xs" placeholder={labels.detail} />
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <Input type="number" value={line.qty} onChange={(event) => updateLine(line.id, "qty", event.target.value)} className={`h-8 text-right tabular-nums ${warning ? "border-destructive text-destructive" : ""}`} />
                          {warning ? (
                            <div className="mt-1 space-y-1 text-[11px] text-destructive">
                              <p>Only {formatQuantity(line.availableStock)} units available in stock. You entered {formatQuantity(line.qty)}.</p>
                              <label className="flex items-center gap-2">
                                <input type="checkbox" checked={Boolean(line.stockOverrideAcknowledged)} onChange={(event) => updateLine(line.id, "stockOverrideAcknowledged", event.target.checked)} />
                                {documentLanguage === "th" ? "ยืนยันการ override" : "Acknowledge override"}
                              </label>
                            </div>
                          ) : null}
                        </td>
                        <td className="px-2 py-2"><Input value={line.unit} onChange={(event) => updateLine(line.id, "unit", event.target.value)} className="h-8" /></td>
                        <td className="px-2 py-2">
                          <Input type="number" value={line.price} onChange={(event) => updateLine(line.id, "price", event.target.value)} className="h-8 text-right tabular-nums" />
                          {lastCustomerPrice !== null && lastCustomerPrice !== Number(line.price) ? (
                            <button
                              type="button"
                              className="mt-1 text-left text-[11px] font-medium text-primary underline-offset-2 hover:underline"
                              onClick={() => updateLine(line.id, "price", lastCustomerPrice)}
                            >
                              Last price for this customer: {formatNumber(lastCustomerPrice)}
                            </button>
                          ) : null}
                        </td>
                        {perLineDiscount ? (
                          <td className="px-2 py-2">
                            <div>
                              <Input
                                type="number"
                                min={0}
                                value={line.discountValue ?? line.discount}
                                onChange={(event) => updateLine(line.id, "discountValue", event.target.value)}
                                className="h-8 text-right tabular-nums"
                                aria-label={documentLanguage === "th" ? "ส่วนลด" : "Discount"}
                              />
                            </div>
                          </td>
                        ) : null}
                        {perLineVat ? (
                          <td className="px-2 py-2">
                            <Select value={String(sanitizeWholePercent(line.tax))} onValueChange={(value) => updateLine(line.id, "tax", value === "exempt" ? 0 : Number(value))}>
                              <SelectTrigger className="h-8" aria-label={labels.vat}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {vatRateOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        ) : null}
                        {perLineWithholdingTax ? (
                          <td className="px-2 py-2">
                            <Select
                              value={String(sanitizeWhtRate(line.withholdingRate ?? 0))}
                              onValueChange={(value) => updateLine(line.id, "withholdingRate", Number(value))}
                            >
                              <SelectTrigger className="h-8" aria-label={documentLanguage === "th" ? "หัก ณ ที่จ่าย %" : "WHT %"}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {whtRateOptions.map((rate) => (
                                  <SelectItem key={rate} value={String(rate)}>{rate}%</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        ) : null}
                        <td className="px-2 py-2 text-right font-semibold tabular-nums">{formatNumber(amounts.totalAmount)}</td>
                        <td className="px-2 py-2">
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeLine(line.id)}>
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addLine}>
              <Plus className="h-4 w-4" /> {labels.addLine}
            </Button>
          </Section>

          <Section
            icon={ReceiptText}
            title="Summary"
            helper="These values appear in the summary area at the bottom of the document."
          >
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
              <div className="grid gap-4 md:grid-cols-2">
                {showWhtFooter && !perLineWithholdingTax ? (
                  <TextField label="Withholding tax %" value={withholdingRate} onChange={(value) => setWithholdingRate(sanitizeWhtRate(value))} type="number" />
                ) : null}
                {hasRelatedDocument ? <TextField label="Amount already paid" value={amountPaid} onChange={() => undefined} type="number" readOnly /> : null}
                <div className="md:col-span-2 rounded-lg bg-secondary/40 p-3 text-xs">
                  <p className="font-semibold">Amount in words</p>
                  <p className="mt-1 text-muted-foreground">{documentLanguage === "th" ? amountWordsThai : amountWordsEnglish}</p>
                </div>
              </div>
              <div className="rounded-lg border border-border/70 p-4">
              <TotalsSummary totals={totals} lines={lines} currency={currency} showAmountPaid={hasRelatedDocument} labels={labels} discountRate={discountValue} withholdingRate={effectiveWithholdingRate} showWithholding={showWhtFooter} />
              </div>
            </div>
          </Section>

          <Section
            icon={ReceiptText}
            title="Payment"
            helper="This section appears in the payment instructions block."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Payment method</Label>
                <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethodChoice)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {paymentMethodOptions.map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {paymentMethod === "Bank Transfer" ? (
                <div className="md:col-span-2 space-y-3 rounded-lg border border-border/70 bg-secondary/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Label>Company bank account</Label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        This updates the payment details that appear on the document. Adding a bank account here saves it to Company Settings for future documents.
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowAddBankAccount((current) => !current)}>
                      Add new bank account
                    </Button>
                  </div>
                  {companyBankAccounts.length ? (
                    <Select value={paymentDetails.selectedBankAccountId} onValueChange={selectBankAccount}>
                      <SelectTrigger className="bg-card"><SelectValue placeholder="Select company bank account" /></SelectTrigger>
                      <SelectContent>
                        {companyBankAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.bankName} - {account.accountNumber}{account.isDefault ? " (Default)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                      <AlertTriangle className="h-4 w-4" />
                      No bank account registered. Add one to show payment details on this document.
                    </div>
                  )}
                  {selectedBankAccount ? (
                    <div className="overflow-hidden rounded-lg border border-teal-200 bg-card text-sm shadow-sm">
                      <div className="border-l-4 border-teal-400 px-3 py-2">
                        <p className="font-semibold">{selectedBankAccount.bankName}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Account name: {selectedBankAccount.accountName || "-"}</p>
                        <p className="text-xs text-muted-foreground">Account number: {selectedBankAccount.accountNumber || "-"}</p>
                        <p className="text-xs text-muted-foreground">Branch: {selectedBankAccount.branch || "-"}</p>
                        {selectedBankAccount.swiftCode ? <p className="text-xs text-muted-foreground">SWIFT: {selectedBankAccount.swiftCode}</p> : null}
                      </div>
                    </div>
                  ) : null}
                  {showAddBankAccount ? (
                    <div className="grid gap-3 rounded-lg border border-primary/20 bg-card p-4 md:grid-cols-2">
                      <TextField label="Bank name" value={newBankAccount.bankName} onChange={(value) => updateNewBankAccount("bankName", value)} />
                      <TextField label="Account name" value={newBankAccount.accountName} onChange={(value) => updateNewBankAccount("accountName", value)} />
                      <TextField label="Account number" value={newBankAccount.accountNumber} onChange={(value) => updateNewBankAccount("accountNumber", value)} />
                      <TextField label="Branch" value={newBankAccount.branch ?? ""} onChange={(value) => updateNewBankAccount("branch", value)} />
                      <TextField label="PromptPay ID" value={newBankAccount.promptPayId ?? ""} onChange={(value) => updateNewBankAccount("promptPayId", value)} />
                      <TextField label="SWIFT code" value={newBankAccount.swiftCode ?? ""} onChange={(value) => updateNewBankAccount("swiftCode", value)} />
                      <label className="flex items-center gap-2 text-sm md:col-span-2">
                        <input type="checkbox" checked={Boolean(newBankAccount.isDefault)} onChange={(event) => updateNewBankAccount("isDefault", event.target.checked)} />
                        Set as default company bank account
                      </label>
                      <div className="flex justify-end gap-2 md:col-span-2">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddBankAccount(false)}>Cancel</Button>
                        <Button type="button" size="sm" onClick={() => void saveBankAccountFromDocument()}>Save to Company Settings</Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <PaymentDetailFields method={paymentMethod} details={paymentDetails} onChange={updatePaymentDetail} />
              <div className="md:col-span-2">
                <Label>Payment terms / instruction</Label>
                <Textarea value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} className="mt-1.5 min-h-[88px]" />
              </div>
            </div>
          </Section>

          <Section icon={StickyNote} title="Notes" helper="These remarks appear under the payment and summary area.">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Customer note / remark</Label>
                <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} className="mt-1.5" />
              </div>
              <div>
                <Label>Internal note</Label>
                <Textarea value={internalNote} onChange={(event) => setInternalNote(event.target.value)} rows={4} className="mt-1.5" placeholder="Internal only; not shown on the customer-facing document." />
              </div>
            </div>
          </Section>

          <Section icon={Signature} title="Approval" helper="Signature labels are fixed by document type and shown in the preview/PDF.">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-dashed border-border bg-secondary/20 p-4 text-center text-sm text-muted-foreground">
                <div className="mx-auto mb-3 w-48 border-t border-slate-500" />
                <p className="font-semibold text-foreground">{documentLanguage === "th" ? "ผู้รับเอกสาร" : "Received by"}</p>
                <p className="mt-1 text-xs">{documentLanguage === "th" ? "วันที่ ____ / ____ / ____" : "Date ____ / ____ / ____"}</p>
              </div>
              <div className="rounded-lg border border-dashed border-border bg-secondary/20 p-4 text-center text-sm text-muted-foreground">
                <div className="mx-auto mb-3 w-48 border-t border-slate-500" />
                <p className="font-semibold text-foreground">{documentLanguage === "th" ? "ผู้อนุมัติ" : "Approved by"}</p>
                <p className="mt-1 text-xs">{documentLanguage === "th" ? "วันที่ ____ / ____ / ____" : "Date ____ / ____ / ____"}</p>
              </div>
            </div>
          </Section>

        <div className="hidden">
          <Card className="card-premium sticky top-20 overflow-hidden">
            <div className="border-b border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ready to preview</p>
                  <h3 className="mt-1 font-display text-xl font-bold">{previewTitle}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">{localizedCopyOptions.find((option) => option.value === copyGeneration)?.[documentLanguage === "th" ? "th" : "en"]}</p>
                </div>
                <Languages className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="space-y-4 p-5">
              <DocumentMiniSummary customer={customer} seller={seller} documentNumber={documentNumber} dueDate={dueDate} />
              <TotalsSummary totals={totals} lines={lines} currency={currency} showAmountPaid={hasRelatedDocument} labels={labels} discountRate={discountValue} withholdingRate={effectiveWithholdingRate} showWithholding={showWhtFooter} />
              <div className="rounded-lg bg-secondary/40 p-3 text-xs">
                <p className="font-semibold">Amount in words</p>
                <p className="mt-1 text-muted-foreground">{amountWordsThai}</p>
                <p className="mt-1 text-muted-foreground">{amountWordsEnglish}</p>
              </div>
              <Button type="button" className="w-full border-0 bg-gradient-brand text-primary-foreground shadow-brand" onClick={previewDocument}>
                <Eye className="mr-1.5 h-4 w-4" /> Preview Document
              </Button>
            </div>
          </Card>
        </div>
      </div>
      </div>

      <div className="sticky bottom-0 z-20 -mx-2 rounded-t-xl border border-border bg-card/95 p-2 shadow-lg backdrop-blur sm:p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm sm:gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Grand total</p>
              <p className="font-display text-lg font-bold text-primary">{formatMoney(totals.remainingDue, currency)}</p>
            </div>
            {stockWarningCount ? (
              <span className="rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">
                {stockWarningCount} stock warning{stockWarningCount > 1 ? "s" : ""}
              </span>
            ) : null}
            {missingRequiredCount ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                {missingRequiredCount} {labels.missingRequired}
              </span>
            ) : null}
          </div>
          <Button type="button" className="w-full border-0 bg-gradient-brand text-primary-foreground shadow-brand sm:w-auto" onClick={previewDocument}>
            <Eye className="mr-1.5 h-4 w-4" /> {labels.preview}
          </Button>
        </div>
      </div>

      <Dialog open={paymentScheduleOpen} onOpenChange={setPaymentScheduleOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{labels.paymentSchedule}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-[64px_90px_minmax(130px,1fr)_minmax(150px,1fr)_150px_40px] gap-2 text-xs font-semibold text-muted-foreground">
              <span>{documentLanguage === "th" ? "งวดที่" : "No."}</span>
              <span>{documentLanguage === "th" ? "ประเภท" : "Type"}</span>
              <span className="text-right">{labels.percent}</span>
              <span className="text-right">{labels.amount}</span>
              <span>{labels.dueDateLabel} ({documentLanguage === "th" ? "ไม่บังคับ" : "optional"})</span>
              <span />
            </div>
            {calculatedPaymentSchedule.map((row, index) => (
              <div key={row.id} className="grid grid-cols-[64px_90px_minmax(130px,1fr)_minmax(150px,1fr)_150px_40px] gap-2">
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold">
                  {index + 1}
                </div>
                <Select value={row.type} onValueChange={(value) => updatePaymentScheduleRow(row.id, { type: value as DiscountType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">%</SelectItem>
                    <SelectItem value="amount">{currency}</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0}
                  max={remainingPartialPercent}
                  value={row.percent ?? 0}
                  onChange={(event) => updatePaymentScheduleRow(row.id, { type: "percent", value: Math.max(Number(event.target.value) || 0, 0) })}
                  className="text-right"
                />
                <Input
                  type="number"
                  min={0}
                  max={remainingPartialAmount}
                  value={row.amount}
                  onChange={(event) => updatePaymentScheduleRow(row.id, { type: "amount", value: Math.max(Number(event.target.value) || 0, 0) })}
                  className="text-right"
                />
                <Input type="date" value={row.dueDate ?? ""} onChange={(event) => updatePaymentScheduleRow(row.id, { dueDate: event.target.value })} />
                <Button type="button" variant="ghost" size="icon" onClick={() => removePaymentScheduleRow(row.id)} disabled={calculatedPaymentSchedule.length <= 1}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
              <Button type="button" variant="outline" size="sm" onClick={addPaymentScheduleRow}>
                <Plus className="mr-1.5 h-4 w-4" /> {labels.addPaymentRow}
              </Button>
              <div className={cn("text-sm font-semibold", paymentScheduleValid ? "text-emerald-700" : "text-destructive")}>
                {formatMoney(paymentScheduleTotal, currency)} / {formatMoney(remainingPartialAmount, currency)}
                {!paymentScheduleValid ? <span className="ml-2">{labels.paymentScheduleTotalError}</span> : null}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setPaymentScheduleOpen(false)} disabled={!paymentScheduleValid}>
              {documentLanguage === "th" ? "บันทึก" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={customerModalOpen} onOpenChange={setCustomerModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{customerMode === "new" ? labels.createCustomer : labels.editCustomer}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
            <ContactFields
              contact={customerDraft}
              onChange={updateCustomerDraftValue}
              labels={labels}
              advancedOpen={contactAdvancedOpen}
              onAdvancedOpenChange={setContactAdvancedOpen}
            />
            {customerMode === "existing" && !sameParty(customerDraft, customer) ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                <p className="font-medium">{labels.editedCustomer}</p>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCustomerModalOpen(false)}>Cancel</Button>
            {customerMode === "new" ? (
              <Button type="button" onClick={() => void saveCustomerModal("profile")}>{labels.createCustomer}</Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => void saveCustomerModal("document")}>{labels.docOnly}</Button>
                <Button type="button" onClick={() => void saveCustomerModal("profile")}>{labels.updateCustomerProfile}</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={projectModalOpen} onOpenChange={setProjectModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{labels.createProject}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label={labels.projectName} value={projectDraft.name} onChange={(value) => setProjectDraft((current) => ({ ...current, name: value }))} />
            <TextField label={labels.projectCode} value={projectDraft.code} onChange={(value) => setProjectDraft((current) => ({ ...current, code: value.toUpperCase() }))} />
            <TextField label={labels.customer} value={projectDraft.customer || customer.name} onChange={(value) => setProjectDraft((current) => ({ ...current, customer: value }))} />
            <div>
              <Label>{labels.status}</Label>
              <Select value={projectDraft.status} onValueChange={(value) => setProjectDraft((current) => ({ ...current, status: value }))}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <TextField label={labels.startDate} value={projectDraft.startDate} onChange={(value) => setProjectDraft((current) => ({ ...current, startDate: value }))} type="date" />
            <TextField label={labels.endDate} value={projectDraft.endDate} onChange={(value) => setProjectDraft((current) => ({ ...current, endDate: value }))} type="date" />
            <div className="md:col-span-2">
              <Label>{labels.notes}</Label>
              <Textarea value={projectDraft.notes} onChange={(event) => setProjectDraft((current) => ({ ...current, notes: event.target.value }))} className="mt-1.5 min-h-[96px]" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setProjectModalOpen(false)}>Cancel</Button>
            <Button type="button" onClick={() => void saveProjectFromDocument()}>{labels.createProject}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sellerEditOpen} onOpenChange={setSellerEditOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{labels.editSeller}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
            <ContactFields
              contact={sellerDraft}
              onChange={updateSellerDraftValue}
              labels={labels}
              party="seller"
              advancedOpen={contactAdvancedOpen}
              onAdvancedOpenChange={setContactAdvancedOpen}
            />
            <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-2">
              <TextField label="Logo URL" value={brandingDraft.logoUrl ?? ""} onChange={(value) => updateBrandingDraftField("logoUrl", value)} />
              <TextField label="Signature URL" value={brandingDraft.signatureUrl ?? ""} onChange={(value) => updateBrandingDraftField("signatureUrl", value)} />
            </div>
            {!sameParty(sellerDraft, seller) ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                <p className="font-medium">{labels.editedSeller}</p>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSellerEditOpen(false)}>Cancel</Button>
            <Button type="button" variant="outline" onClick={() => void saveSellerModal("document")}>{labels.docOnly}</Button>
            <Button type="button" onClick={() => void saveSellerModal("profile")}>{labels.updateCompanyProfile}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={referenceConfirmOpen} onOpenChange={(open) => (open ? setReferenceConfirmOpen(true) : cancelReferenceSelection())}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {documentLanguage === "th" ? "ยืนยันเอกสารอ้างอิง" : "Confirm reference document"}
            </DialogTitle>
          </DialogHeader>
          {pendingReference ? (
            <div className="space-y-4 text-sm">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="font-semibold">{pendingReference.id}</p>
                <p className="mt-1 text-muted-foreground">
                  {formatReferenceKind(pendingReference.kind, documentLanguage)} · {pendingReference.party} · {pendingReference.date} · {formatMoney(pendingReference.amount, currency)}
                </p>
                {!pendingReference.suggested ? (
                  <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-950">
                    {documentLanguage === "th"
                      ? `เอกสารประเภทนี้ไม่ใช่เอกสารอ้างอิงปกติสำหรับ ${formatPrimaryDocumentType(primaryDocumentType, documentLanguage)}`
                      : `This document type is not normally used as a source for ${formatPrimaryDocumentType(primaryDocumentType, documentLanguage)}.`}
                  </p>
                ) : null}
              </div>
              <p>
                {documentLanguage === "th"
                  ? `คุณเลือกเอกสาร ${pendingReference.id} ต้องการคัดลอกรายละเอียดจากเอกสารนี้มายังเอกสารปัจจุบันหรือไม่?`
                  : `You selected ${pendingReference.id}. Do you want to copy details from this document into the current document?`}
              </p>
              {hasCurrentDocumentData(customer, lines, notes, paymentTerms) ? (
                <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950">
                  {documentLanguage === "th"
                    ? `เอกสารนี้มีข้อมูลอยู่แล้ว การคัดลอกรายละเอียดอาจแทนที่ข้อมูลลูกค้าและรายการสินค้าในเอกสารปัจจุบัน`
                    : `This document already has information. Copying details may replace current customer and line items.`}
                </p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="ghost" onClick={cancelReferenceSelection} disabled={referenceImporting}>
              {documentLanguage === "th" ? "ยกเลิก" : "Cancel"}
            </Button>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => void applyReferenceSelection("link")} disabled={referenceImporting}>
                <Link2 className="mr-1.5 h-4 w-4" />
                {documentLanguage === "th" ? "อ้างอิงเท่านั้น" : "Link only"}
              </Button>
              {hasCurrentDocumentData(customer, lines, notes, paymentTerms) ? (
                <Button type="button" variant="outline" onClick={() => void applyReferenceSelection("merge")} disabled={referenceImporting}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  {documentLanguage === "th" ? "รวมรายการสินค้า" : "Merge line items only"}
                </Button>
              ) : null}
              <Button type="button" onClick={() => void applyReferenceSelection("replace")} disabled={referenceImporting}>
                {referenceImporting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
                {hasCurrentDocumentData(customer, lines, notes, paymentTerms)
                  ? (documentLanguage === "th" ? "แทนที่ข้อมูลปัจจุบัน" : "Replace current data")
                  : (documentLanguage === "th" ? "คัดลอกรายละเอียด" : "Copy details")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
};

const CompactIdentity = ({
  label,
  value,
  helper,
  expanded,
  onToggle,
  onEdit,
  editHref,
}: {
  label: string;
  value: string;
  helper: string;
  expanded: boolean;
  onToggle: () => void;
  onEdit?: () => void;
  editHref?: string;
}) => (
  <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
    <div className="min-w-0 flex-1">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-semibold">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{helper}</p>
    </div>
    <div className="flex shrink-0 gap-1">
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onToggle} aria-label={`${expanded ? "Collapse" : "Expand"} ${label}`}>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </Button>
      {onEdit ? (
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} aria-label={`Edit ${label}`} title={`Edit ${label}`}>
          <Pencil className="h-4 w-4" />
        </Button>
      ) : null}
      {editHref ? (
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" asChild aria-label={`${label} settings`}>
          <a href={editHref} title="Open Settings">
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      ) : null}
    </div>
  </div>
);

const ReferenceCombobox = ({
  open,
  onOpenChange,
  options,
  selected,
  currency,
  language,
  onSelect,
  onClear,
  labels,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: ReferenceOption[];
  selected: ReferenceOption | null;
  currency: string;
  language: DocumentLanguage;
  onSelect: (id: string) => void;
  onClear: () => void;
  labels: (typeof docLabels)["en"] | (typeof docLabels)["th"];
}) => {
  const compatibleOptions = options.filter((option) => option.suggested);
  const placeholder = labels.searchReferenceDocuments;

  return (
    <div className="relative min-w-0">
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="mt-1.5 h-auto min-h-9 w-full min-w-0 justify-between border-slate-200 bg-white px-3 py-2 text-left font-normal"
          aria-label={placeholder}
        >
          <span className="min-w-0 flex-1">
            {selected ? (
              <span className="block truncate pr-2">
                {formatReferenceKind(selected.kind, language)} · {selected.id}
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <Search className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(560px,calc(100vw-2rem))] p-0" align="start">
        <Command filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder={placeholder} />
          <CommandList className="max-h-80">
            <CommandEmpty>{language === "th" ? "ไม่พบเอกสาร" : "No matching documents."}</CommandEmpty>
            <CommandGroup heading={labels.internalReferenceDocument}>
              {compatibleOptions.map((option) => (
                <ReferenceCommandItem key={option.id} option={option} currency={currency} language={language} onSelect={onSelect} />
              ))}
            </CommandGroup>
            {selected ? (
              <CommandGroup>
                <CommandItem value="clear reference remove no reference" onSelect={onClear}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {language === "th" ? "ล้างเอกสารอ้างอิง" : "Clear reference"}
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
    </div>
  );
};

const CustomerCombobox = ({
  customers,
  selected,
  language,
  onSelect,
  onCreate,
  onEdit,
}: {
  customers: PartyInfo[];
  selected: PartyInfo;
  language: DocumentLanguage;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onEdit: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const label = [selected.code, selected.name].filter(Boolean).join(" ") || (language === "th" ? "ค้นหาลูกค้า" : "Search customer");
  const searchPlaceholder = language === "th" ? "ค้นหาลูกค้า" : "Search customers";
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="h-10 min-w-0 flex-1 justify-between border-slate-200 bg-white px-3 text-left font-normal">
            <span className="truncate">{label}</span>
            <Search className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(520px,calc(100vw-2rem))] p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{language === "th" ? "ไม่พบลูกค้า" : "No customer found."}</CommandEmpty>
              <CommandGroup heading={language === "th" ? "ลูกค้า" : "Customers"}>
                {customers.map((item) => (
                  <CommandItem key={item.code} value={[item.code, item.name, item.taxId, item.email, item.phone].join(" ")} onSelect={() => { onSelect(item.code); setOpen(false); }}>
                    <UserRoundSearch className="mr-2 h-4 w-4 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{[item.code, item.name].filter(Boolean).join(" ")}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.taxId || item.email || item.phone || "-"}</p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup>
                <CommandItem value="create new customer add" onSelect={() => { setOpen(false); onCreate(); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  {language === "th" ? "สร้างลูกค้าใหม่" : "Create new customer"}
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button type="button" variant="outline" size="icon" className="h-10 w-10 border-slate-200 bg-white" onClick={onCreate} aria-label={language === "th" ? "สร้างลูกค้าใหม่" : "Create customer"} title={language === "th" ? "สร้างลูกค้าใหม่" : "Create customer"}>
          <Plus className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="icon" className="h-10 w-10 border-slate-200 bg-white" onClick={onEdit} aria-label={language === "th" ? "แก้ไขลูกค้า" : "Edit customer"} title={language === "th" ? "แก้ไขลูกค้า" : "Edit customer"} disabled={!selected.name}>
          <Pencil className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
const ReferenceCommandItem = ({
  option,
  currency,
  language,
  onSelect,
}: {
  option: ReferenceOption;
  currency: string;
  language: DocumentLanguage;
  onSelect: (id: string) => void;
}) => (
  <CommandItem
    value={[
      option.id,
      option.kind,
      formatReferenceKind(option.kind, "en"),
      formatReferenceKind(option.kind, "th"),
      option.party,
      option.date,
      option.status,
      String(option.amount),
    ].join(" ")}
    onSelect={() => onSelect(option.id)}
    className="items-start gap-3 py-3"
  >
    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold text-foreground">
        {formatReferenceKind(option.kind, language)} · <span className="font-mono">{option.id}</span>
      </p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{option.party}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {option.date} · {formatMoney(option.amount, currency)} · {formatReferenceStatus(option.status, language)}
      </p>
    </div>
  </CommandItem>
);

const ProductCombobox = ({
  value,
  products,
  mode,
  placeholder,
  language = "th",
  className = "",
  onSelect,
  onChange,
}: {
  value: string;
  products: Product[];
  mode: "code" | "description";
  placeholder?: string;
  language?: DocumentLanguage;
  className?: string;
  onSelect: (product: Product) => void;
  onChange: (value: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const isThai = language === "th";
  const label = value || placeholder || (mode === "code" ? (isThai ? "รหัสสินค้า/บริการ" : "Code") : (isThai ? "คำอธิบายสินค้า/บริการ" : "Description"));
  const searchPlaceholder = placeholder || (mode === "code" ? (isThai ? "ค้นหารหัสหรือชื่อสินค้า/บริการ" : "Search product code or name") : (isThai ? "ค้นหาชื่อสินค้า/บริการ" : "Search product/service name"));
  const groupHeading = mode === "code" ? (isThai ? "รหัสสินค้า/บริการ" : "Product codes") : (isThai ? "สินค้าและบริการ" : "Products and services");
  const productSummary = (product: Product) => {
    const summary = String(product.stockSummary || product.productType || product.type || "-");
    if (!isThai) return summary;
    const onHandMatch = summary.match(/^(\d+(?:\.\d+)?) on hand$/i);
    if (onHandMatch) return `คงเหลือ ${onHandMatch[1]}`;
    const mapping: Record<string, string> = {
      "Service item": "บริการ",
      "Non-stock item": "สินค้า/บริการไม่ตัดสต็อก",
      "Low stock": "สต็อกต่ำ",
      "Inactive stock item": "สินค้าปิดใช้งาน",
      "Out of stock": "สินค้าหมด",
      "Negative stock": "สต็อกติดลบ",
    };
    return mapping[summary] ?? summary;
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Input
          value={value}
          placeholder={placeholder}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className={`h-8 border-slate-200 ${className}`}
          aria-label={label}
        />
      </PopoverTrigger>
      <PopoverContent className="w-[min(520px,calc(100vw-2rem))] p-0" align="start">
        <Command filter={(itemValue, search) => (itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder={searchPlaceholder} value={value} onValueChange={onChange} />
          <CommandList>
            <CommandEmpty>{isThai ? "ไม่พบสินค้า/บริการ" : "No matching products."}</CommandEmpty>
            <CommandGroup heading={groupHeading}>
              {products.map((product) => (
                <CommandItem
                  key={product.sku}
                  value={[product.sku, product.name, product.stockSummary, product.type, product.productType].join(" ")}
                  onSelect={() => {
                    onSelect(product);
                    setOpen(false);
                  }}
                >
                  <PackageSearch className="mr-2 h-4 w-4 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{product.sku} - {product.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{productSummary(product)}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const ReferenceGroupList = ({
  references,
  currency,
  language,
  labels,
  onView,
  onRemove,
  onReimport,
}: {
  references: ReferenceOption[];
  currency: string;
  language: DocumentLanguage;
  labels: (typeof docLabels)["en"] | (typeof docLabels)["th"];
  onView: (reference: ReferenceOption) => void;
  onRemove: (reference: ReferenceOption) => void;
  onReimport: (reference: ReferenceOption) => void;
}) => {
  const grouped = references.reduce<Record<string, ReferenceOption[]>>((acc, reference) => {
    const key = reference.documentTypes?.[0] ?? reference.kind;
    acc[key] = [...(acc[key] ?? []), reference];
    return acc;
  }, {});

  return (
    <div className="mt-3 min-w-0 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">{labels.referenceDocuments}</p>
      {Object.entries(grouped).map(([kind, items]) => (
        <div key={kind} className="space-y-2">
          <p className="text-[11px] font-semibold text-slate-500">
            {referenceGroupTitle(kind, language, labels)}
          </p>
          {items.map((reference) => (
            <ReferenceChip
              key={reference.id}
              reference={reference}
              currency={currency}
              language={language}
              labels={labels}
              onView={() => onView(reference)}
              onRemove={() => onRemove(reference)}
              onReimport={() => onReimport(reference)}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

const ReferenceChip = ({
  reference,
  currency,
  language,
  labels,
  onView,
  onRemove,
  onReimport,
}: {
  reference: ReferenceOption;
  currency: string;
  language: DocumentLanguage;
  labels: (typeof docLabels)["en"] | (typeof docLabels)["th"];
  onView: () => void;
  onRemove: () => void;
  onReimport: () => void;
}) => (
  <div className="mt-1.5 flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
    <div className="min-w-0 flex-1">
      <p className="break-words font-semibold text-slate-950">
        {formatReferenceKind(reference.kind, language)} · <span className="font-mono">{reference.id}</span>
      </p>
      <p className="mt-0.5 break-words text-slate-600">
        {reference.party || "-"} · {reference.date || "-"} · {formatMoney(reference.amount, currency)} · {formatReferenceStatus(reference.status, language)}
      </p>
    </div>
    <div className="flex shrink-0 gap-1">
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-700" onClick={onView} aria-label={labels.sourceDocument}>
        <Eye className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-700" onClick={onReimport} aria-label={labels.addReference}>
        <RefreshCw className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-700 hover:text-destructive" onClick={onRemove} aria-label={labels.removeReference}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  </div>
);

const ContactFields = ({
  contact,
  onChange,
  labels,
  party = "customer",
  advancedOpen,
  onAdvancedOpenChange,
}: {
  contact: PartyInfo;
  onChange: (key: keyof PartyInfo, value: PartyInfo[keyof PartyInfo]) => void;
  labels: (typeof docLabels)["en"] | (typeof docLabels)["th"];
  party?: "customer" | "seller";
  advancedOpen: boolean;
  onAdvancedOpenChange: (open: boolean) => void;
}) => {
  const isThai = labels === localizedDocLabels.th;
  const contactTypes = contact.contactTypes ?? (party === "seller" ? ["supplier"] : ["client"]);
  const setContactType = (type: "client" | "supplier", checked: boolean) => {
    const next = checked ? Array.from(new Set([...contactTypes, type])) : contactTypes.filter((item) => item !== type);
    onChange("contactTypes", next.length ? next : [type]);
  };
  const uploadQr = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange("qrPaymentUrl", String(reader.result ?? ""));
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <PaperBlock title={isThai ? "ประเภทข้อมูลติดต่อ" : "Basic contact type"}>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label>{isThai ? "ประเภทธุรกิจ" : "Business Type"}</Label>
            <Select value={contact.businessType ?? "corporation"} onValueChange={(value) => onChange("businessType", value as PartyInfo["businessType"])}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="corporation">{isThai ? "นิติบุคคล" : "Corporation"}</SelectItem>
                <SelectItem value="individual">{isThai ? "บุคคลธรรมดา" : "Individual"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{isThai ? "ประเภทผู้ติดต่อ" : "Contact Type"}</Label>
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={contactTypes.includes("client")} onChange={(event) => setContactType("client", event.target.checked)} /> {isThai ? "ลูกค้า" : "Client"}</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={contactTypes.includes("supplier")} onChange={(event) => setContactType("supplier", event.target.checked)} /> {isThai ? "ผู้ขาย" : "Supplier"}</label>
            </div>
          </div>
          <div>
            <Label>{isThai ? "ที่ตั้ง" : "Location"}</Label>
            <Select value={contact.location ?? "thailand"} onValueChange={(value) => onChange("location", value as PartyInfo["location"])}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="thailand">Thailand</SelectItem>
                <SelectItem value="foreign">Foreign</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <TextField label={isThai ? "เครดิต (วัน)" : "Credit Days"} value={contact.creditDays ?? 0} onChange={(value) => onChange("creditDays", Number(value) || 0)} type="number" />
          <TextField label={isThai ? "รหัสผู้ติดต่อ" : "Contact ID"} value={contact.code} onChange={(value) => onChange("code", value)} />
          <TextField label={contact.businessType === "individual" ? (isThai ? "ชื่อบุคคล" : "Contact Name") : (isThai ? "ชื่อธุรกิจ" : "Business Name")} value={contact.name} onChange={(value) => onChange("name", value)} />
        </div>
      </PaperBlock>

      <PaperBlock title={isThai ? "ที่อยู่และภาษี" : "Address and tax"}>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-3">
            <Label>{isThai ? "ที่อยู่" : "Address"}</Label>
            <Textarea value={contact.address} onChange={(event) => onChange("address", event.target.value)} className="mt-1.5 min-h-[88px]" />
          </div>
          <TextField label={isThai ? "รหัสไปรษณีย์" : "Zip Code"} value={contact.zipCode ?? ""} onChange={(value) => onChange("zipCode", value)} />
          <TextField label={isThai ? "เลขประจำตัวผู้เสียภาษี" : "Tax ID"} value={contact.taxId} onChange={(value) => onChange("taxId", value)} className="font-mono" />
          <div>
            <Label>{isThai ? "สาขา" : "Branch"}</Label>
            <Select value={contact.branchType ?? "head_office"} onValueChange={(value) => onChange("branchType", value as PartyInfo["branchType"])}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="head_office">{isThai ? "สำนักงานใหญ่" : "Head Office"}</SelectItem>
                <SelectItem value="branch">{isThai ? "สาขา" : "Branch"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {contact.branchType === "branch" ? (
            <>
              <TextField label={isThai ? "รหัสสาขา" : "Branch Code"} value={contact.branchCode ?? ""} onChange={(value) => onChange("branchCode", value)} />
              <TextField label={isThai ? "ชื่อสาขา" : "Branch Name"} value={contact.branchName ?? ""} onChange={(value) => onChange("branchName", value)} />
            </>
          ) : null}
        </div>
      </PaperBlock>

      <PaperBlock title={isThai ? "ผู้ติดต่อ" : "Contact person detail"}>
        <div className="grid gap-4 md:grid-cols-3">
          <TextField label={isThai ? "ชื่อผู้ติดต่อ" : "Contact Person Name"} value={contact.contactPerson} onChange={(value) => onChange("contactPerson", value)} />
          <TextField label="Email" value={contact.email} onChange={(value) => onChange("email", value)} type="email" />
          <TextField label={isThai ? "มือถือ" : "Mobile"} value={contact.mobile ?? ""} onChange={(value) => onChange("mobile", value)} />
          <TextField label={isThai ? "โทรศัพท์" : "Phone"} value={contact.phone} onChange={(value) => onChange("phone", value)} />
          <TextField label={isThai ? "ตำแหน่ง" : "Position/Role"} value={contact.position ?? ""} onChange={(value) => onChange("position", value)} />
        </div>
      </PaperBlock>

      <PaperBlock title={isThai ? "ข้อมูลธนาคาร" : "Bank information"}>
        <div className="grid gap-4 md:grid-cols-3">
          <TextField label={isThai ? "ธนาคาร" : "Bank"} value={contact.bankName ?? ""} onChange={(value) => onChange("bankName", value)} />
          <TextField label={isThai ? "ชื่อบัญชี" : "Account Name"} value={contact.bankAccountName ?? ""} onChange={(value) => onChange("bankAccountName", value)} />
          <TextField label={isThai ? "เลขที่บัญชี" : "Account Number"} value={contact.bankAccountNumber ?? ""} onChange={(value) => onChange("bankAccountNumber", value)} />
          <TextField label={isThai ? "รหัสสาขาธนาคาร" : "Branch Code"} value={contact.bankBranchCode ?? ""} onChange={(value) => onChange("bankBranchCode", value)} />
          <TextField label={isThai ? "ชื่อสาขาธนาคาร" : "Branch Name"} value={contact.bankBranchName ?? ""} onChange={(value) => onChange("bankBranchName", value)} />
          <div>
            <Label>{isThai ? "ประเภทบัญชี" : "Account Type"}</Label>
            <Select value={contact.bankAccountType ?? "savings"} onValueChange={(value) => onChange("bankAccountType", value as PartyInfo["bankAccountType"])}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="savings">{isThai ? "ออมทรัพย์" : "Savings Account"}</SelectItem>
                <SelectItem value="current">{isThai ? "กระแสรายวัน" : "Current Account"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-3">
            <Label>{isThai ? "QR Payment" : "QR Payment"}</Label>
            <Input type="file" accept="image/*" onChange={(event) => uploadQr(event.target.files?.[0])} className="mt-1.5" />
            {contact.qrPaymentUrl ? <img src={contact.qrPaymentUrl} alt="QR payment" className="mt-3 h-24 w-24 rounded border object-contain" /> : null}
          </div>
        </div>
      </PaperBlock>

      <PaperBlock>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={Boolean(contact.hasForeignBankInfo) || contact.location === "foreign"} onChange={(event) => onChange("hasForeignBankInfo", event.target.checked)} />
          {isThai ? "ข้อมูลเพิ่มเติมสำหรับธนาคารต่างประเทศ" : "More Information For Foreign Bank"}
        </label>
        {(contact.hasForeignBankInfo || contact.location === "foreign") ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <TextField label="Swift Code" value={contact.swiftCode ?? ""} onChange={(value) => onChange("swiftCode", value)} />
            <TextField label={isThai ? "ที่อยู่ธนาคาร" : "Bank Address"} value={contact.bankAddress ?? ""} onChange={(value) => onChange("bankAddress", value)} />
            <TextField label="IBAN" value={contact.iban ?? ""} onChange={(value) => onChange("iban", value)} />
            <TextField label={isThai ? "ประเทศ" : "Country"} value={contact.bankCountry ?? ""} onChange={(value) => onChange("bankCountry", value)} />
          </div>
        ) : null}
      </PaperBlock>

      <PaperBlock>
        <Button type="button" variant="ghost" size="sm" onClick={() => onAdvancedOpenChange(!advancedOpen)}>
          {advancedOpen ? <ChevronUp className="mr-1.5 h-4 w-4" /> : <ChevronDown className="mr-1.5 h-4 w-4" />}
          {isThai ? "ตัวเลือกเพิ่มเติม" : "More Option"}
        </Button>
        {advancedOpen ? (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <TextField label="Website" value={contact.website ?? ""} onChange={(value) => onChange("website", value)} />
            <TextField label="Line ID" value={contact.lineId ?? ""} onChange={(value) => onChange("lineId", value)} />
            <TextField label={isThai ? "แท็ก" : "Tags"} value={contact.tags ?? ""} onChange={(value) => onChange("tags", value)} />
            <TextField label={isThai ? "สกุลเงินเริ่มต้น" : "Default currency"} value={contact.defaultCurrency ?? "THB"} onChange={(value) => onChange("defaultCurrency", value)} />
            <TextField label={isThai ? "เงื่อนไขชำระเงิน" : "Payment terms"} value={contact.defaultPaymentTerms ?? ""} onChange={(value) => onChange("defaultPaymentTerms", value)} />
            <TextField label={isThai ? "ภาษีหัก ณ ที่จ่ายเริ่มต้น" : "Default withholding tax"} value={contact.defaultWithholdingTax ?? ""} onChange={(value) => onChange("defaultWithholdingTax", value)} />
            <div className="md:col-span-3">
              <Label>{isThai ? "หมายเหตุ" : "Notes"}</Label>
              <Textarea value={contact.note ?? ""} onChange={(event) => onChange("note", event.target.value)} className="mt-1.5" />
            </div>
            <div className="md:col-span-3">
              <Label>{isThai ? "หมายเหตุภายใน" : "Internal remark"}</Label>
              <Textarea value={contact.internalRemark ?? ""} onChange={(event) => onChange("internalRemark", event.target.value)} className="mt-1.5" />
            </div>
          </div>
        ) : null}
      </PaperBlock>
    </div>
  );
};

const CustomerFields = ({
  customer,
  onChange,
  labels,
  party = "customer",
}: {
  customer: PartyInfo;
  onChange: (key: keyof PartyInfo, value: string) => void;
  labels: (typeof docLabels)["en"] | (typeof docLabels)["th"];
  party?: "customer" | "seller";
}) => (
  <div className="grid gap-4 md:grid-cols-3">
    <TextField label={party === "seller" ? "Company code" : "Customer code"} value={customer.code} onChange={(value) => onChange("code", value)} />
    <TextField label={party === "seller" ? labels.seller : labels.customer} value={customer.name} onChange={(value) => onChange("name", value)} />
    <TextField label="Tax ID" value={customer.taxId} onChange={(value) => onChange("taxId", value)} className="font-mono" />
    <TextField label="Branch / Head office" value={customer.branch} onChange={(value) => onChange("branch", value)} />
    <TextField label="Contact person" value={customer.contactPerson} onChange={(value) => onChange("contactPerson", value)} />
    <TextField label="Phone" value={customer.phone} onChange={(value) => onChange("phone", value)} />
    <TextField label="Email" value={customer.email} onChange={(value) => onChange("email", value)} />
    {party === "seller" ? <TextField label="Website" value={customer.website ?? ""} onChange={(value) => onChange("website", value)} /> : null}
    <div className="md:col-span-2">
      <Label>{party === "seller" ? "Note" : "Customer reference/contact note"}</Label>
      <Input value={customer.note ?? ""} onChange={(event) => onChange("note", event.target.value)} className="mt-1.5" />
    </div>
    <div className="md:col-span-3">
      <Label>Address</Label>
      <Textarea value={customer.address} onChange={(event) => onChange("address", event.target.value)} className="mt-1.5 min-h-[88px]" />
    </div>
  </div>
);

const PaymentDetailFields = ({
  method,
  details,
  onChange,
}: {
  method: PaymentMethodChoice;
  details: PaymentDetails;
  onChange: (key: keyof PaymentDetails, value: string) => void;
}) => {
  if (method === "Bank Transfer") {
    return null;
  }

  if (method === "Cheque") {
    return (
      <>
        <TextField label="Cheque number *" value={details.chequeNumber} onChange={(value) => onChange("chequeNumber", value)} />
        <TextField label="Bank name" value={details.chequeBankName} onChange={(value) => onChange("chequeBankName", value)} />
        <TextField label="Cheque date *" value={details.chequeDate} onChange={(value) => onChange("chequeDate", value)} type="date" />
      </>
    );
  }

  if (method === "Credit Card") {
    return (
      <>
        <TextField label="Card type" value={details.cardType} onChange={(value) => onChange("cardType", value)} />
        <TextField label="Reference/approval code" value={details.approvalCode} onChange={(value) => onChange("approvalCode", value)} />
      </>
    );
  }

  if (method === "PromptPay") {
    return <TextField label="PromptPay ID" value={details.promptPayId} onChange={(value) => onChange("promptPayId", value)} />;
  }

  return null;
};

const SellerSnapshot = ({
  seller,
  branding,
  loaded,
  warnings,
}: {
  seller: PartyInfo;
  branding: Partial<BrandingSettings>;
  loaded: boolean;
  warnings: string[];
}) => (
  <div className="space-y-4">
    {loaded && warnings.length ? (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
        <AlertTriangle className="h-4 w-4" />
        Company profile is missing {warnings.join(", ")}.
        <a className="font-semibold underline" href="/settings/company">Open Settings</a>
      </div>
    ) : null}
    <div className="grid gap-4 md:grid-cols-[160px_1fr_1fr]">
      <div className="space-y-3">
        <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border bg-secondary/30">
          {branding.logoUrl ? <img src={resolveAssetUrl(branding.logoUrl)} alt="Company logo" className="max-h-20 max-w-full object-contain" /> : <Image className="h-7 w-7 text-muted-foreground" />}
        </div>
      </div>
      <div className="space-y-2 text-sm">
        <PreviewLine label="Company" value={seller.name || "-"} />
        <PreviewLine label="Tax ID" value={seller.taxId || "-"} />
        <PreviewLine label="Branch" value={seller.branch || "-"} />
        <PreviewLine label="Phone" value={seller.phone || "-"} />
      </div>
      <div className="space-y-2 text-sm">
        <PreviewLine label="Address" value={seller.address || "-"} multiline />
        <PreviewLine label="Email" value={seller.email || "-"} />
        <PreviewLine label="Website" value={seller.website || "-"} />
      </div>
    </div>
  </div>
);

const CustomerSnapshot = ({ customer }: { customer: PartyInfo }) => (
  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
    <div className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-sm">
      <CustomerDetailLine label="Customer code" value={customer.code || "-"} />
      <CustomerDetailLine label="Customer" value={customer.name || "-"} />
      <CustomerDetailLine label="Address" value={customer.address || "-"} multiline />
      <CustomerDetailLine label="Tax ID" value={customer.taxId || "-"} />
      <CustomerDetailLine label="Branch" value={customer.branch || "-"} />
      <CustomerDetailLine label="Contact person" value={customer.contactPerson || "-"} />
      <CustomerDetailLine label="Phone" value={customer.phone || customer.mobile || "-"} />
      <CustomerDetailLine label="Email" value={customer.email || "-"} />
      <CustomerDetailLine label="Credit days" value={String(customer.creditDays ?? 0)} />
      <CustomerDetailLine label="Bank" value={[customer.bankName, customer.bankAccountNumber].filter(Boolean).join(" / ") || "-"} />
    </div>
  </div>
);

const DocumentMiniSummary = ({ customer, seller, documentNumber, dueDate }: { customer: PartyInfo; seller: PartyInfo; documentNumber: string; dueDate: string }) => (
  <div className="rounded-lg border border-border/70 p-4 text-sm">
    <div className="mb-3 flex justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground">Seller</p>
        <p className="mt-1 font-semibold">{seller.name || "-"}</p>
        <p className="text-muted-foreground">Tax ID {seller.taxId || "-"}</p>
      </div>
      <div className="text-right">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Document</p>
        <p className="mt-1 font-mono font-bold text-primary">{documentNumber}</p>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3 border-t border-border/60 pt-3 text-xs">
      <div><span className="text-muted-foreground">Customer</span><p className="font-semibold">{customer.name || "-"}</p></div>
      <div><span className="text-muted-foreground">Due</span><p className="font-semibold">{dueDate}</p></div>
    </div>
  </div>
);

const TotalsSummary = ({
  totals,
  lines,
  currency,
  showAmountPaid,
  labels = docLabels.en,
  discountRate = 0,
  showWithholding = true,
}: {
  totals: ReturnType<typeof summarizeLines>;
  lines: Line[];
  currency: string;
  showAmountPaid: boolean;
  labels?: (typeof docLabels)["en"] | (typeof docLabels)["th"];
  discountRate?: number;
  withholdingRate?: number;
  showWithholding?: boolean;
}) => {
  const isThai = labels === localizedDocLabels.th;
  const vatGroups = totals.vatGroups?.length
    ? totals.vatGroups
    : totals.vatAmount > 0
      ? [{ rate: dominantVatRate(lines), taxableBase: totals.amountBeforeVat, taxAmount: totals.vatAmount }]
      : [];
  const withholdingGroups = totals.withholdingGroups ?? [];
  const shouldShowWithholding = showWithholding || withholdingGroups.length > 0;
  return (
    <dl className="min-w-0 space-y-2 text-sm">
      <SummaryRow label={isThai ? "ยอดรวม" : "Subtotal"} value={formatMoney(totals.subtotalBeforeDiscount, currency)} />
      <SummaryRow label={`${isThai ? "ส่วนลด" : "Discount"} ${formatPercent(discountRate)}`} value={formatMoney(totals.totalDiscount, currency)} />
      <SummaryRow label={isThai ? "ยอดก่อน VAT" : "Amount before VAT"} value={formatMoney(totals.amountBeforeVat, currency)} />
      {vatGroups.map((group) => (
        <SummaryRow key={`vat-${group.rate}`} label={`${labels.vat} ${formatPercent(group.rate)}`} value={formatMoney(group.taxAmount, currency)} />
      ))}
      <SummaryRow label={isThai ? "ยอดรวมสุทธิ" : "Grand total"} value={formatMoney(totals.grandTotal, currency)} strong />
      {shouldShowWithholding
        ? withholdingGroups.map((group) => (
            <SummaryRow key={`wht-${group.rate}`} label={`${labels.wht} ${formatPercent(group.rate)}`} value={formatMoney(group.taxAmount, currency)} />
          ))
        : null}
      {shouldShowWithholding && totals.withholdingAmount > 0 ? (
        <SummaryRow label={labels.totalWithholdingTax} value={formatMoney(totals.withholdingAmount, currency)} />
      ) : null}
      {showAmountPaid ? <SummaryRow label={isThai ? "จำนวนเงินที่ชำระแล้ว" : labels.amountPaid} value={formatMoney(totals.amountPaid, currency)} /> : null}
      <div className="flex min-w-0 justify-between gap-3 border-t border-border pt-3 font-display text-lg font-bold">
        <dt className="min-w-0 break-words">{shouldShowWithholding && totals.withholdingAmount > 0 ? labels.amountAfterWithholding : isThai ? "จำนวนเงินที่ชำระ" : "Amount remaining due"}</dt>
        <dd className="shrink-0 tabular-nums gradient-brand-text">{formatMoney(totals.remainingDue, currency)}</dd>
      </div>
    </dl>
  );
};
const SummaryRow = ({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) => (
  <div className={`flex min-w-0 justify-between gap-3 ${strong ? "font-semibold" : ""}`}>
    <dt className="min-w-0 break-words text-muted-foreground">{label}</dt>
    <dd className="shrink-0 tabular-nums">{value}</dd>
  </div>
);

const SummaryMiniLine = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md bg-white/70 px-3 py-2">
    <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
    <p className="mt-0.5 font-semibold tabular-nums text-foreground">{value}</p>
  </div>
);

const StaticSignaturePreview = ({ language }: { language: DocumentLanguage }) => {
  const isThai = language === "th";
  const receivedBy = isThai ? "ผู้รับเอกสาร" : "Received by";
  const approvedBy = isThai ? "ผู้อนุมัติ" : "Approved by";
  const dateLabel = isThai ? "วันที่ ____ / ____ / ____" : "Date ____ / ____ / ____";

  return (
    <div className="mt-10 grid grid-cols-2 gap-8 text-center text-sm">
      {[receivedBy, approvedBy].map((label) => (
        <div key={label} className="flex flex-col items-center">
          <div className="mt-16 w-56 border-t border-slate-400" />
          <div className="mt-3 font-semibold">{label}</div>
          <div className="mt-2 text-xs text-slate-500">{dateLabel}</div>
        </div>
      ))}
    </div>
  );
};

const SelectedBankAccountCard = ({ account }: { account: CompanyBankAccount }) => (
  <div className="overflow-hidden rounded-lg border border-teal-200 bg-white text-sm shadow-sm">
    <div className="grid grid-cols-[5px_1fr]">
      <div className="bg-teal-400" />
      <div className="px-3 py-2">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <p className="font-semibold text-slate-900">{account.bankName || "Bank account"}</p>
          {account.isDefault ? <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700">Default</span> : null}
        </div>
        <p className="text-xs text-slate-600">Account name: {account.accountName || "-"}</p>
        <p className="text-xs text-slate-600">Account number: {account.accountNumber || "-"}</p>
        {account.branch ? <p className="text-xs text-slate-600">Branch: {account.branch}</p> : null}
        {account.swiftCode ? <p className="text-xs text-slate-600">SWIFT: {account.swiftCode}</p> : null}
        {account.promptPayId ? <p className="text-xs text-slate-600">PromptPay: {account.promptPayId}</p> : null}
      </div>
    </div>
  </div>
);

const EditableTotalsSummary = ({
  totals,
  lines,
  currency,
  showAmountPaid,
  labels,
  discountRate,
  onDiscountRateChange,
  withholdingRate,
  onWithholdingRateChange,
  showWithholding = true,
}: {
  totals: ReturnType<typeof summarizeLines>;
  lines: Line[];
  currency: string;
  showAmountPaid: boolean;
  labels: (typeof docLabels)["en"] | (typeof docLabels)["th"];
  discountRate: number;
  onDiscountRateChange: (value: number) => void;
  withholdingRate: number;
  onWithholdingRateChange: (value: number) => void;
  showWithholding?: boolean;
}) => {
  const isThai = labels === localizedDocLabels.th;
  const vatGroups = totals.vatGroups?.length
    ? totals.vatGroups
    : totals.vatAmount > 0
      ? [{ rate: dominantVatRate(lines), taxableBase: totals.amountBeforeVat, taxAmount: totals.vatAmount }]
      : [];
  const withholdingGroups = totals.withholdingGroups ?? [];
  const showWithholdingRows = showWithholding || withholdingGroups.length > 0;
  return (
    <dl className="min-w-0 space-y-2 text-sm">
      <SummaryRow label={isThai ? "ยอดรวม" : "Subtotal"} value={formatMoney(totals.subtotalBeforeDiscount, currency)} />
      <EditablePercentSummaryRow
        label={isThai ? "ส่วนลด" : "Discount"}
        value={discountRate}
        amount={totals.totalDiscount}
        currency={currency}
        onChange={onDiscountRateChange}
      />
      <SummaryRow label={isThai ? "ยอดก่อน VAT" : "Amount before VAT"} value={formatMoney(totals.amountBeforeVat, currency)} />
      {vatGroups.map((group) => (
        <SummaryRow key={`vat-${group.rate}`} label={`${labels.vat} ${formatPercent(group.rate)}`} value={formatMoney(group.taxAmount, currency)} />
      ))}
      <SummaryRow label={isThai ? "ยอดรวมสุทธิ" : "Grand total"} value={formatMoney(totals.grandTotal, currency)} strong />
      {showWithholding ? (
        <EditablePercentSummaryRow
          label={isThai ? "หัก ณ ที่จ่าย" : "WHT"}
          value={withholdingRate}
          amount={totals.withholdingAmount}
          currency={currency}
          onChange={onWithholdingRateChange}
          wholeNumber
        />
      ) : null}
      {!showWithholding && showWithholdingRows
        ? withholdingGroups.map((group) => (
            <SummaryRow key={`editable-wht-${group.rate}`} label={`${labels.wht} ${formatPercent(group.rate)}`} value={formatMoney(group.taxAmount, currency)} />
          ))
        : null}
      {showWithholdingRows && totals.withholdingAmount > 0 ? (
        <SummaryRow label={labels.totalWithholdingTax} value={formatMoney(totals.withholdingAmount, currency)} />
      ) : null}
      {showAmountPaid ? <SummaryRow label={labels.amountPaid} value={formatMoney(totals.amountPaid, currency)} /> : null}
      <div className="flex min-w-0 justify-between gap-3 border-t border-border pt-3 font-display text-lg font-bold">
        <dt className="min-w-0 break-words">{showWithholdingRows && totals.withholdingAmount > 0 ? labels.amountAfterWithholding : isThai ? "จำนวนเงินที่ชำระ" : "Amount remaining due"}</dt>
        <dd className="shrink-0 tabular-nums gradient-brand-text">{formatMoney(totals.remainingDue, currency)}</dd>
      </div>
    </dl>
  );
};

const EditablePercentSummaryRow = ({
  label,
  value,
  amount,
  currency,
  onChange,
  wholeNumber = false,
}: {
  label: string;
  value: number;
  amount: number;
  currency: string;
  onChange: (value: number) => void;
  wholeNumber?: boolean;
}) => (
  <div className="grid min-w-0 grid-cols-[minmax(80px,1fr)_auto_minmax(100px,auto)] items-center gap-2 sm:gap-3">
    <dt className="min-w-0 break-words text-muted-foreground">{label}</dt>
    <div className="flex shrink-0 items-center gap-2">
      <Input
        type="number"
        min={0}
        max={100}
        step={wholeNumber ? 1 : 0.01}
        inputMode={wholeNumber ? "numeric" : "decimal"}
        value={Number.isFinite(value) ? String(wholeNumber ? sanitizeWholePercent(value) : value) : "0"}
        onChange={(event) => onChange(wholeNumber ? clampWholePercent(event.target.value) : clampNumericPercent(event.target.value))}
        className="h-8 w-16 border-slate-200 text-center text-sm tabular-nums"
      />
      <span className="text-xs text-muted-foreground">%</span>
    </div>
    <dd className="min-w-0 text-right tabular-nums">{formatMoney(amount, currency)}</dd>
  </div>
);

const PreviewLine = ({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) => (
  <div>
    <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
    <p className={multiline ? "whitespace-pre-line" : ""}>{value}</p>
  </div>
);

const CustomerDetailLine = ({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) => (
  <>
    <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
    <p className={`min-w-0 ${multiline ? "whitespace-pre-line" : ""}`}>{value}</p>
  </>
);

const companyToSeller = (company: CompanySettings): PartyInfo => ({
  code: "",
  name: company.name || "",
  address: company.address || "",
  taxId: company.taxId || "",
  branch: company.branch || "",
  contactPerson: company.contactName || "",
  phone: company.phone || "",
  email: company.email || "",
  website: company.website || "",
});

const resolveDefaultBankAccount = (accounts: CompanyBankAccount[]) =>
  accounts.find((account) => account.isDefault) ?? accounts[0] ?? null;

const customerRecordToParty = (item: Customer): PartyInfo => ({
  code: item.id,
  name: item.name,
  address: item.address ?? "",
  taxId: item.taxId ?? "",
  branch: String((item as Customer & Record<string, unknown>).branch ?? "Head Office"),
  contactPerson: item.contactPerson ?? item.contact ?? "",
  phone: item.phone ?? "",
  email: item.email ?? "",
  note: String((item as Customer & Record<string, unknown>).notes ?? ""),
  ...contactRecordExtras(item as Customer & Record<string, unknown>),
});

const contactRecordExtras = (item: Record<string, unknown>): Partial<PartyInfo> => ({
  businessType: (item.businessType as PartyInfo["businessType"]) ?? "corporation",
  contactTypes: (item.contactTypes as PartyInfo["contactTypes"]) ?? ["client"],
  location: (item.location as PartyInfo["location"]) ?? "thailand",
  creditDays: Number(item.creditDays ?? 0),
  zipCode: String(item.zipCode ?? ""),
  branchType: (item.branchType as PartyInfo["branchType"]) ?? "head_office",
  branchCode: String(item.branchCode ?? ""),
  branchName: String(item.branchName ?? item.branch ?? "Head Office"),
  mobile: String(item.mobile ?? item.phone ?? ""),
  position: String(item.position ?? ""),
  bankName: String(item.bankName ?? ""),
  bankAccountName: String(item.bankAccountName ?? ""),
  bankAccountNumber: String(item.bankAccountNumber ?? ""),
  bankBranchCode: String(item.bankBranchCode ?? ""),
  bankBranchName: String(item.bankBranchName ?? ""),
  bankAccountType: (item.bankAccountType as PartyInfo["bankAccountType"]) ?? "savings",
  qrPaymentUrl: String(item.qrPaymentUrl ?? ""),
  hasForeignBankInfo: Boolean(item.hasForeignBankInfo),
  swiftCode: String(item.swiftCode ?? ""),
  bankAddress: String(item.bankAddress ?? ""),
  iban: String(item.iban ?? ""),
  bankCountry: String(item.bankCountry ?? ""),
  website: String(item.website ?? ""),
  lineId: String(item.lineId ?? ""),
  tags: String(item.tags ?? ""),
  internalRemark: String(item.internalRemark ?? ""),
  defaultCurrency: String(item.defaultCurrency ?? "THB"),
  defaultPaymentTerms: String(item.defaultPaymentTerms ?? ""),
  defaultWithholdingTax: String(item.defaultWithholdingTax ?? ""),
});

const sameParty = (left: PartyInfo, right: PartyInfo) =>
  (["code", "name", "address", "taxId", "branch", "contactPerson", "phone", "email", "website", "note"] as Array<keyof PartyInfo>).every(
    (key) => String(left[key] ?? "").trim() === String(right[key] ?? "").trim()
  );

type SourceDocumentForImport = SalesDocumentRecord & {
  customerInfo?: Partial<PartyInfo>;
  paymentTerms?: string;
  projectId?: string;
  notes?: string;
};

const buildReferenceOptions = (data: ReturnType<typeof useAppData>["data"], currentType: string): ReferenceOption[] =>
  [
    ...data.quotations.map((item) => referenceFromSummary(item, currentType)),
    ...data.invoices.map((item) =>
      referenceFromSummary(
        {
          id: item.id,
          kind: "invoice" as DocumentKind,
          party: item.customer,
          date: item.date,
          amount: item.amount,
          status: item.status,
          documentTypes: item.documentTypes,
        },
        currentType
      )
    ),
    ...data.billings.map((item) => referenceFromSummary(item, currentType)),
    ...data.receipts.map((item) => referenceFromSummary(item, currentType)),
    ...data.creditNotes.map((item) => referenceFromSummary(item, currentType)),
    ...data.debitNotes.map((item) => referenceFromSummary(item, currentType)),
  ].sort((a, b) => Number(b.suggested) - Number(a.suggested) || b.date.localeCompare(a.date));

const referenceFromSummary = (item: {
  id: string;
  kind: DocumentKind;
  documentTypes?: string[];
  party: string;
  date: string;
  amount: number;
  status: string;
}, currentType: string): ReferenceOption => ({
  id: item.id,
  kind: item.kind,
  documentTypes: item.documentTypes,
  party: item.party,
  date: item.date,
  amount: item.amount,
  status: item.status,
  suggested: getSuggestedReferenceKinds(currentType).some((referenceType) =>
    referenceType === item.kind || item.documentTypes?.includes(referenceType)
  ),
});

const referenceKindLabels: Record<string, { en: string; th: string }> = {
  quotation: { en: "Quotation", th: "ใบเสนอราคา" },
  delivery_note: { en: "Delivery Note", th: "ใบส่งของ" },
  invoice: { en: "Invoice", th: "ใบแจ้งหนี้" },
  tax_invoice: { en: "Tax Invoice", th: "ใบกำกับภาษี" },
  billing: { en: "Billing Note", th: "ใบวางบิล" },
  billing_note: { en: "Billing Note", th: "ใบวางบิล" },
  receipt: { en: "Receipt", th: "ใบเสร็จรับเงิน" },
  credit_note: { en: "Credit Note", th: "ใบลดหนี้" },
  debit_note: { en: "Debit Note", th: "ใบเพิ่มหนี้" },
  combined_billing_note: { en: "Combined Billing Note", th: "ใบวางบิลรวม" },
  combined_receipt: { en: "Combined Receipt", th: "ใบเสร็จรับเงินรวม" },
};

const getSuggestedReferenceKinds = (currentType: string): string[] => {
  if (currentType === "delivery_note") return ["quotation"];
  if (currentType === "invoice") return ["quotation", "delivery_note", "billing", "billing_note"];
  if (currentType === "tax_invoice") return ["quotation", "delivery_note", "invoice"];
  if (currentType === "billing_note" || currentType === "combined_billing_note") return ["invoice", "tax_invoice"];
  if (currentType === "receipt" || currentType === "combined_receipt") return ["invoice", "tax_invoice", "billing", "billing_note", "combined_billing_note"];
  if (currentType === "credit_note" || currentType === "debit_note") return ["invoice", "tax_invoice"];
  if (currentType === "cash_sale" || currentType === "short_tax_invoice") return ["quotation", "delivery_note"];
  return [];
};

const formatReferenceKind = (kind: string, language: DocumentLanguage) =>
  referenceKindLabels[kind]?.[language === "th" ? "th" : "en"] ?? kind.replace(/_/g, " ");

const formatReferenceStatus = (status: string, language: DocumentLanguage) => {
  const normalized = status.trim().toLowerCase();
  if (language === "th") {
    return (
      {
        draft: "แบบร่าง",
        sent: "ส่งแล้ว",
        approved: "อนุมัติแล้ว",
        pending: "รออนุมัติ",
        pendingapproval: "รออนุมัติ",
        paid: "ชำระแล้ว",
        partiallypaid: "ชำระบางส่วน",
        cancelled: "ยกเลิก",
      }[normalized.replace(/\s+/g, "")] ?? status
    );
  }
  return status
    ? status
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase())
    : "-";
};

const formatPrimaryDocumentType = (kind: string, language: DocumentLanguage) =>
  formatReferenceKind(kind, language);

const referenceGroupTitle = (
  kind: string,
  language: DocumentLanguage,
  labels: (typeof docLabels)["en"] | (typeof docLabels)["th"]
) => {
  if (kind === "invoice" || kind === "tax_invoice") return labels.referencedInvoices;
  if (kind === "quotation") return labels.referencedQuotations;
  return language === "th"
    ? `${labels.referenceDocuments}: ${formatReferenceKind(kind, language)}`
    : `Referenced ${formatReferenceKind(kind, language)}s`;
};

const sanitizeFilename = (value: string) =>
  value.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 90);


const appendCanvasAsA4Images = (
  target: string[],
  canvas: HTMLCanvasElement,
  logicalPageWidthPx: number,
  logicalPageHeightPx: number
) => {
  const scale = canvas.width / logicalPageWidthPx;
  const sliceHeight = Math.max(1, Math.round(logicalPageHeightPx * scale));

  for (let sourceY = 0; sourceY < canvas.height; sourceY += sliceHeight) {
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeight;

    const context = pageCanvas.getContext("2d");
    if (!context) {
      continue;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    context.drawImage(
      canvas,
      0,
      sourceY,
      canvas.width,
      Math.min(sliceHeight, canvas.height - sourceY),
      0,
      0,
      canvas.width,
      Math.min(sliceHeight, canvas.height - sourceY)
    );

    target.push(pageCanvas.toDataURL("image/png"));
  }
};

const downloadPreviewDomAsPdf = async (root: HTMLElement, filename: string) => {
  const [{ default: html2canvas }, { default: JsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  if ("fonts" in document) {
    await document.fonts.ready;
  }
  const imageElements = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imageElements.map(
      (image) =>
        image.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              image.onload = () => resolve();
              image.onerror = () => resolve();
            })
    )
  );
  const PDF_PAGE_WIDTH_PX = 794;
  const PDF_PAGE_HEIGHT_PX = 1123;
  const PDF_EXPORT_CLASS = "sales-document-pdf-export";
  const pages = Array.from(root.querySelectorAll<HTMLElement>(".sales-document-page"));
  const sourcePages = pages.length ? pages : [root];
  const capturedImages: string[] = [];

  root.classList.add(PDF_EXPORT_CLASS);
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  try {
    for (const page of sourcePages) {
      const previousScrollLeft = page.scrollLeft;
      const previousScrollTop = page.scrollTop;
      page.scrollLeft = 0;
      page.scrollTop = 0;

      const captureHeight = Math.max(
        PDF_PAGE_HEIGHT_PX,
        Math.ceil(page.scrollHeight),
        Math.ceil(page.getBoundingClientRect().height)
      );

      const canvas = await html2canvas(page, {
        scale: 4,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        width: PDF_PAGE_WIDTH_PX,
        height: captureHeight,
        windowWidth: 1280,
        windowHeight: captureHeight,
      });

      page.scrollLeft = previousScrollLeft;
      page.scrollTop = previousScrollTop;
      appendCanvasAsA4Images(capturedImages, canvas, PDF_PAGE_WIDTH_PX, PDF_PAGE_HEIGHT_PX);
    }
  } finally {
    root.classList.remove(PDF_EXPORT_CLASS);
  }

  try {
    await downloadPreviewImagesPdf({
      images: capturedImages,
      filename: filename.endsWith(".pdf") ? filename : `${filename}.pdf`,
    });
  } catch {
    const pdf = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    capturedImages.forEach((image, index) => {
      if (index > 0) {
        pdf.addPage("a4", "portrait");
      }
      pdf.addImage(image, "PNG", 0, 0, pdfWidth, pdfHeight);
    });
    pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
  }
};

const mapSourceLinesToForm = (
  sourceLines: NonNullable<SourceDocumentForImport["lines"]>,
  source?: ReferenceOption
): Line[] =>
  sourceLines
    .map((line) => ({
      id: createClientId(),
      sku: String(line.displayCode ?? line.sku ?? ""),
      inventoryId: String((line as Partial<Line>).inventoryId ?? line.sku ?? ""),
      originalInventoryCode: String((line as Partial<Line>).originalInventoryCode ?? line.sku ?? ""),
      desc: String(line.desc ?? ""),
      details: String(line.details ?? ""),
      qty: Number(line.qty) || 1,
      unit: String(line.unit ?? "item"),
      price: Number(line.price) || 0,
      discountType: ((line as Partial<Line>).discountType === "amount" ? "amount" : "percent") as DiscountType,
      discountValue: Number((line as Partial<Line>).discountValue ?? line.discount) || 0,
      discountAmount: Number((line as Partial<Line>).discountAmount) || 0,
      discount: Number((line as Partial<Line>).discountValue ?? line.discount) || 0,
      tax: sanitizeWholePercent(line.vatRate ?? line.tax ?? 0),
      vatRate: sanitizeWholePercent(line.vatRate ?? line.tax ?? 0),
      vatAmount: Number(line.vatAmount) || 0,
      withholdingRate: sanitizeWhtRate(line.withholdingRate ?? 0),
      withholdingAmount: Number(line.withholdingAmount) || 0,
      sourceDocumentId: source?.id ?? String(line.sourceDocumentId ?? ""),
      sourceDocumentType: source?.kind ?? String(line.sourceDocumentType ?? ""),
      sourceLineId: String(line.sourceLineId ?? line.id ?? ""),
      availableStock: Number((line as { availableStock?: number }).availableStock) || null,
      stockOverrideAcknowledged: false,
    }))
    .filter((line) => line.desc.trim() || line.sku.trim());

const normalizePartyInfo = (party: Partial<PartyInfo>, fallbackName: string): PartyInfo => ({
  ...blankCustomer,
  ...party,
  code: String(party.code ?? ""),
  name: String(party.name ?? fallbackName),
  address: String(party.address ?? ""),
  taxId: String(party.taxId ?? ""),
  branch: String(party.branch ?? ""),
  contactPerson: String(party.contactPerson ?? ""),
  phone: String(party.phone ?? ""),
  email: String(party.email ?? ""),
});

const findPartyByName = (options: PartyInfo[], name: string) =>
  options.find((option) => option.name.trim().toLowerCase() === name.trim().toLowerCase()) ?? null;

const extractCreditDays = (value: string) => {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : null;
};

const hasCurrentDocumentData = (customer: PartyInfo, lines: Line[], notes: string, paymentTerms: string) =>
  Boolean(customer.name.trim()) ||
  validLines(lines).length > 0 ||
  Boolean(notes.trim()) ||
  Boolean(paymentTerms.trim());

const emptyLine = (): Line => ({
  id: createClientId(),
  sku: "",
  inventoryId: "",
  originalInventoryCode: "",
  desc: "",
  details: "",
  qty: 1,
  unit: "item",
  price: 0,
  discount: 0,
  discountType: "percent",
  discountValue: 0,
  discountAmount: 0,
  tax: 7,
  vatRate: 7,
  withholdingRate: 0,
  withholdingAmount: 0,
  availableStock: null,
});

const validLines = (lines: Line[]) => lines.filter((line) => line.desc.trim() && Number(line.qty) > 0);

const validateSalesDocument = ({
  realTypes,
  seller,
  customer,
  documentNumber,
  issueDate,
  dueDate,
  creditTerms,
  currency,
  documentLanguage,
  copyGeneration,
  lines,
  paymentMethod,
  selectedBankAccount,
  paymentDetails,
  labels,
}: {
  realTypes: string[];
  seller: PartyInfo;
  customer: PartyInfo;
  documentNumber: string;
  issueDate: string;
  dueDate: string;
  creditTerms: string;
  currency: string;
  documentLanguage: string;
  copyGeneration: CopyGeneration;
  lines: Line[];
  paymentMethod: PaymentMethodChoice;
  selectedBankAccount: CompanyBankAccount | null;
  paymentDetails: PaymentDetails;
  labels: (typeof docLabels)["en"] | (typeof docLabels)["th"];
}) => {
  const errors: FieldErrors = {};
  const requiredText = labels.required;
  if (!realTypes.length) errors.documentTypes = requiredText;
  if (!seller.name.trim()) errors.seller = requiredText;
  if (!customer.name.trim()) errors.customer = requiredText;
  if (!documentNumber.trim()) errors.documentNumber = requiredText;
  if (!issueDate.trim()) errors.issueDate = requiredText;
  if (!dueDate.trim()) errors.dueDate = requiredText;
  if (!String(creditTerms).trim()) errors.creditTerms = requiredText;
  if (!currency.trim()) errors.currency = requiredText;
  if (!documentLanguage.trim()) errors.documentLanguage = requiredText;
  if (!copyGeneration) errors.copyGeneration = requiredText;
  if (!validLines(lines).length) errors.lines = labels === localizedDocLabels.th ? "ต้องมีรายการอย่างน้อย 1 รายการ" : "Add at least one line item.";
  lines.forEach((line) => {
    if (!line.desc.trim()) errors[`line-${line.id}-desc`] = requiredText;
    if (Number(line.qty) <= 0) errors[`line-${line.id}-qty`] = labels === localizedDocLabels.th ? "จำนวนต้องมากกว่า 0" : "Quantity must be greater than 0.";
    if (Number(line.price) < 0 || line.price === null || line.price === undefined) errors[`line-${line.id}-price`] = requiredText;
  });
  if (!paymentMethod) errors.paymentMethod = requiredText;
  if (paymentMethod === "Bank Transfer" && !selectedBankAccount) errors.bankAccount = requiredText;
  if (paymentMethod === "Cheque") {
    if (!paymentDetails.chequeNumber.trim()) errors.chequeNumber = requiredText;
    if (!paymentDetails.chequeDate.trim()) errors.chequeDate = requiredText;
  }
  return errors;
};

const addDays = (dateText: string, days: number) => {
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return dateText;
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const formatQuantity = (value: number | null | undefined) =>
  Number(value ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

const findLastCustomerPrice = (
  documents: Array<{ customer?: string; customerInfo?: Partial<PartyInfo>; lines?: Array<Partial<Line>>; date?: string }>,
  customer: PartyInfo,
  sku: string
) => {
  const normalizedSku = sku.trim().toLowerCase();
  if (!normalizedSku || !customer.name.trim()) return null;
  const customerKeys = [customer.code, customer.name, customer.taxId, customer.email]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .filter(Boolean);

  const matchingLines = documents
    .filter((document) => {
      const documentCustomerKeys = [
        document.customer,
        document.customerInfo?.code,
        document.customerInfo?.name,
        document.customerInfo?.taxId,
        document.customerInfo?.email,
      ]
        .map((value) => String(value ?? "").trim().toLowerCase())
        .filter(Boolean);
      return documentCustomerKeys.some((key) => customerKeys.includes(key));
    })
    .flatMap((document) =>
      (document.lines ?? []).map((line) => ({
        price: Number(line.price) || 0,
        sku: String(line.inventoryId || line.originalInventoryCode || line.sku || "").trim().toLowerCase(),
        date: document.date ?? "",
      }))
    )
    .filter((line) => line.sku === normalizedSku && line.price > 0)
    .sort((a, b) => b.date.localeCompare(a.date));

  return matchingLines[0]?.price ?? null;
};

const formatPaymentDetails = (method: string, details: PaymentDetails, selectedBankAccount?: CompanyBankAccount | null) => {
  if (method === "Bank Transfer") {
    return [
      selectedBankAccount?.bankName ? `Bank: ${selectedBankAccount.bankName}` : details.bankAccount ? `Bank: ${details.bankAccount}` : "",
      selectedBankAccount?.accountName ? `Account name: ${selectedBankAccount.accountName}` : details.accountName ? `Account name: ${details.accountName}` : "",
      selectedBankAccount?.accountNumber ? `Account number: ${selectedBankAccount.accountNumber}` : details.accountNumber ? `Account number: ${details.accountNumber}` : "",
      selectedBankAccount?.branch ? `Branch: ${selectedBankAccount.branch}` : "",
      selectedBankAccount?.promptPayId ? `PromptPay ID: ${selectedBankAccount.promptPayId}` : "",
      selectedBankAccount?.swiftCode ? `SWIFT: ${selectedBankAccount.swiftCode}` : "",
      details.otherNote ? `Note: ${details.otherNote}` : "",
    ].filter(Boolean).join("\n") || "-";
  }
  if (method === "Cheque") {
    return [
      details.chequeNumber ? `Cheque number: ${details.chequeNumber}` : "",
      details.chequeBankName ? `Bank name: ${details.chequeBankName}` : "",
      details.chequeDate ? `Cheque date: ${details.chequeDate}` : "",
      details.otherNote ? `Note: ${details.otherNote}` : "",
    ].filter(Boolean).join("\n") || "-";
  }
  if (method === "Credit Card") {
    return [
      details.cardType ? `Card type: ${details.cardType}` : "",
      details.approvalCode ? `Approval code: ${details.approvalCode}` : "",
      details.otherNote ? `Note: ${details.otherNote}` : "",
    ].filter(Boolean).join("\n") || "-";
  }
  if (method === "PromptPay") {
    return [details.promptPayId ? `PromptPay ID: ${details.promptPayId}` : "", details.otherNote ? `Note: ${details.otherNote}` : ""]
      .filter(Boolean)
      .join("\n") || "-";
  }
  return details.otherNote || "-";
};

const stockWarning = (line: Line) =>
  line.availableStock !== null &&
  line.availableStock !== undefined &&
  Number(line.qty) > Number(line.availableStock);

const productDocumentDetails = (product: Product) => {
  const detailSource = product as Product & {
    description?: string;
    details?: string;
    specification?: string;
    specifications?: string;
    notes?: string;
  };
  return String(
    detailSource.description ??
      detailSource.details ??
      detailSource.specification ??
      detailSource.specifications ??
      detailSource.notes ??
      ""
  ).trim();
};

const hydrateLineFromProduct = (line: Line, product: Product | undefined, products: Product[], vatEnabled = true): Line => {
  if (!product) {
    return {
      ...line,
      productType: line.inventoryId ? line.productType : undefined,
      availableStock: line.inventoryId ? line.availableStock : null,
      stockOverrideAcknowledged: false,
    };
  }
  const stock = resolveProductStock(product, products);
  const productType = product.productType ?? product.type;
  return {
    ...line,
    sku: product.sku || line.sku,
    inventoryId: product.sku || line.inventoryId,
    originalInventoryCode: product.sku || line.originalInventoryCode,
    desc: product.name || line.desc,
    details: productDocumentDetails(product) || line.details,
    unit: productType === "service" ? "service" : "item",
    price: Number(product.price) || line.price,
    tax: vatEnabled
      ? sanitizeWholePercent((product as Product & { vatRate?: number; taxRate?: number }).vatRate ?? (product as Product & { vatRate?: number; taxRate?: number }).taxRate ?? line.tax ?? 7)
      : 0,
    vatRate: vatEnabled
      ? sanitizeWholePercent((product as Product & { vatRate?: number; taxRate?: number }).vatRate ?? (product as Product & { vatRate?: number; taxRate?: number }).taxRate ?? line.vatRate ?? line.tax ?? 7)
      : 0,
    productType,
    availableStock: isInventoryProduct(product) ? stock : null,
    stockOverrideAcknowledged: false,
  };
};

const isInventoryProduct = (product: Product) =>
  (product.productType ?? product.type ?? "").toLowerCase().includes("stock");

const resolveProductStock = (product: Product, products: Product[]) => {
  const refreshed = products.find((item) => item.sku === product.sku) ?? product;
  return Number(refreshed.stock ?? refreshed.openingStockQty ?? 0);
};

const saveCustomerSnapshot = async (
  customer: PartyInfo,
  customers: Customer[],
  vendors: Vendor[],
  mode: CustomerMode,
  selectedCustomerId: string,
  scope: SaveScope = "profile"
) => {
  const match =
    customers.find((item) => selectedCustomerId && item.id === selectedCustomerId) ??
    customers.find((item) => customer.taxId && item.taxId === customer.taxId) ??
    customers.find((item) => item.name.trim().toLowerCase() === customer.name.trim().toLowerCase()) ??
    customers.find((item) => customer.email && item.email?.trim().toLowerCase() === customer.email.trim().toLowerCase());

  const payload = {
    id: customer.code || undefined,
    name: customer.name,
    contact: customer.contactPerson,
    email: customer.email,
    phone: customer.mobile || customer.phone,
    taxId: customer.taxId,
    address: customer.address,
    status: "active",
    ...contactPayloadExtras(customer),
  };

  if (match && scope === "profile") {
    const updated = await updateCustomer(match.id, payload);
    if (customer.contactTypes?.includes("supplier")) {
      await upsertVendorFromContact(customer, vendors);
    }
    return updated;
  }
  if (mode === "new") {
    const created = customer.contactTypes?.includes("client") !== false ? await createCustomer(payload) : null;
    if (customer.contactTypes?.includes("supplier")) {
      await upsertVendorFromContact(customer, vendors);
    }
    return created;
  }
  return match ?? null;
};

const contactPayloadExtras = (contact: PartyInfo) => ({
  businessType: contact.businessType,
  contactTypes: contact.contactTypes,
  location: contact.location,
  creditDays: contact.creditDays ?? 0,
  zipCode: contact.zipCode,
  branchType: contact.branchType,
  branch: contact.branchType === "head_office" ? "Head Office" : contact.branchName || contact.branch,
  branchCode: contact.branchType === "head_office" ? contact.branchCode || "00000" : contact.branchCode,
  branchName: contact.branchType === "head_office" ? "Head Office" : contact.branchName,
  mobile: contact.mobile,
  position: contact.position,
  bankName: contact.bankName,
  bankAccountName: contact.bankAccountName,
  bankAccountNumber: contact.bankAccountNumber,
  bankBranchCode: contact.bankBranchCode,
  bankBranchName: contact.bankBranchName,
  bankAccountType: contact.bankAccountType,
  qrPaymentUrl: contact.qrPaymentUrl,
  hasForeignBankInfo: contact.hasForeignBankInfo,
  swiftCode: contact.swiftCode,
  bankAddress: contact.bankAddress,
  iban: contact.iban,
  bankCountry: contact.bankCountry,
  website: contact.website,
  lineId: contact.lineId,
  notes: contact.note,
  tags: contact.tags,
  internalRemark: contact.internalRemark,
  defaultCurrency: contact.defaultCurrency,
  defaultPaymentTerms: contact.defaultPaymentTerms,
  defaultWithholdingTax: contact.defaultWithholdingTax,
});

const upsertVendorFromContact = async (contact: PartyInfo, vendors: Vendor[]) => {
  const payload = {
    id: contact.code?.startsWith("V-") ? contact.code : undefined,
    name: contact.name,
    contact: contact.contactPerson,
    email: contact.email,
    phone: contact.mobile || contact.phone,
    taxId: contact.taxId,
    address: contact.address,
    status: "active",
    ...contactPayloadExtras(contact),
  };
  const existingVendor =
    vendors.find((item) => contact.taxId && item.taxId === contact.taxId) ??
    vendors.find((item) => item.name.trim().toLowerCase() === contact.name.trim().toLowerCase()) ??
    vendors.find((item) => contact.email && item.email?.trim().toLowerCase() === contact.email.trim().toLowerCase());
  if (existingVendor) {
    return updateVendor(existingVendor.id, payload);
  }
  return createVendor(payload);
};

const saveNewProducts = async (lines: Line[], productBySku: Map<string, Product>) => {
  const createdSkus = new Set<string>();
  for (const line of lines) {
    const sku = line.sku.trim();
    if (!sku || !line.addAsProduct || productBySku.has(sku.toLowerCase()) || createdSkus.has(sku.toLowerCase())) {
      continue;
    }
    await createProduct({
      sku,
      name: line.desc.trim() || sku,
      type: "Service",
      productType: "service",
      price: Number(line.price) || 0,
      stock: null,
      status: "active",
    });
    createdSkus.add(sku.toLowerCase());
  }
};

const dominantVatRate = (lines: Line[]) => {
  const rates = lines.map((line) => sanitizeWholePercent(line.vatRate ?? line.tax ?? 0)).filter((rate) => rate > 0);
  return rates.length ? rates[0] : 0;
};

const resolveSalesDocumentKind = (primaryType: string): DocumentKind => {
  if (primaryType === "quotation") return "quotation";
  if (primaryType === "receipt" || primaryType === "combined_receipt") return "receipt";
  if (primaryType === "billing_note" || primaryType === "combined_billing_note") return "billing";
  if (primaryType === "credit_note") return "credit_note";
  if (primaryType === "debit_note") return "debit_note";
  if (primaryType === "deposit") return "deposit";
  return "invoice";
};

const resolveNumberPrefix = (primaryType: string, _data: ReturnType<typeof useAppData>["data"], selectedTypes: string[]) => {
  const settingsPrefix = {
    tax_invoice: "INV",
    short_tax_invoice: "CA",
    invoice: "INV",
    cash_sale: "CA",
    delivery_note: "INV",
    combined_billing_note: "BL",
    billing_note: "BL",
    combined_receipt: "RE",
    receipt: "RE",
    quotation: "QT",
    credit_note: "CN",
    debit_note: "DN",
    deposit: "INV",
    installment: "INV",
  }[primaryType];
  return settingsPrefix || getSalesDocumentNumberPrefix(selectedTypes);
};

const buildNextDocumentNumber = ({
  kind,
  prefix,
  issueDate,
  data,
}: {
  kind: DocumentKind;
  prefix: string;
  issueDate: string;
  data: ReturnType<typeof useAppData>["data"];
}) => {
  const date = new Date(issueDate);
  const year = Number.isNaN(date.getTime()) ? new Date().getFullYear().toString() : String(date.getFullYear());
  const month = Number.isNaN(date.getTime()) ? String(new Date().getMonth() + 1).padStart(2, "0") : String(date.getMonth() + 1).padStart(2, "0");
  const bucketPrefix = `${prefix}-${year}-${month}`;
  const ids = getExistingDocumentIds(kind, data).filter((id) => id.startsWith(bucketPrefix));
  const previous = ids
    .map((id) => ({ id, serial: Number(id.slice(bucketPrefix.length) || 0) }))
    .filter((item) => item.serial > 0)
    .sort((a, b) => b.serial - a.serial)[0];
  return `${bucketPrefix}${String((previous?.serial ?? 0) + 1).padStart(5, "0")}`;
};

const getExistingDocumentIds = (kind: DocumentKind, data: ReturnType<typeof useAppData>["data"]) => {
  if (kind === "quotation") return data.quotations.map((item) => item.id);
  if (kind === "receipt") return data.receipts.map((item) => item.id);
  if (kind === "billing") return data.billings.map((item) => item.id);
  if (kind === "credit_note") return data.creditNotes.map((item) => item.id);
  if (kind === "debit_note") return data.debitNotes.map((item) => item.id);
  return data.invoices.map((item) => item.id);
};

const resolveSalesDocumentRoute = (kind: DocumentKind, id: string) => {
  return `/income/documents/${encodeURIComponent(id)}?type=${encodeURIComponent(kind === "billing" ? "billing_note" : kind)}`;
};

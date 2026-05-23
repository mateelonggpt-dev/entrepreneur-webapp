import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { UserAccessModal } from "@/components/modals/DomainModals";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { HelpHint } from "@/components/ui-kit/HelpHint";
import {
  Copy,
  Save,
  Loader2,
  Mail,
  Trash2,
  Upload,
  Users,
  ZoomIn,
} from "lucide-react";
import { fetchSettingsSection, saveSettingsSection, uploadBrandingAsset } from "@/lib/api";
import { resolveDocumentAssetUrl } from "@/components/documents/document-utils";
import { SalesDocumentTemplate } from "@/components/documents/SalesDocumentTemplate";
import type { SalesDocumentTemplateData } from "@/components/documents/types";
import type {
  BrandingSettings,
  CompanySettings,
  CurrencySettings,
  DocumentSettings,
  SettingsSection,
  TeamMember,
  UserPermission,
  UserRole,
  UsersSettings,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const sections = [
  { id: "company", label: "Company Profile", to: "/settings/company" },
  { id: "users", label: "Users & Roles", to: "/settings/users" },
  { id: "documents", label: "Document Settings", to: "/settings/documents" },
  { id: "currency", label: "Currency", to: "/settings/currency" },
] as const;

const emptyCompanySettings: CompanySettings = {
  name: "",
  taxId: "",
  branch: "",
  address: "",
  phone: "",
  email: "",
  contactName: "",
  website: "",
  vatRegistrationMode: "registered",
  taxDefaults: {
    vatRate: 7,
    taxMode: "exclusive",
    withholdingRate: 3,
  },
  bankAccounts: [],
};

const emptyUsersSettings: UsersSettings = {
  inviteMessage: "",
  members: [],
  permissionNotes: [],
};

const emptyDocumentSettings: DocumentSettings = {
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

const emptyBrandingSettings: BrandingSettings = {
  logoUrl: "",
  logoPath: "",
  logoContentType: "",
  stampUrl: "",
  stampPath: "",
  stampContentType: "",
  signatureUrl: "",
  signaturePath: "",
  signatureContentType: "",
  signatureLabel: "",
  stampLabel: "",
  accentColor: "#1d4ed8",
  documentTagline: "",
};

const emptyCurrencySettings: CurrencySettings = {
  baseCurrency: "THB",
  multiCurrencyEnabled: false,
  defaultExchangeRate: 1,
  enabledCurrencies: ["THB"],
  exchangeRateSource: "manual",
  manualRates: {
    THB: 1,
    USD: 36.25,
    EUR: 39.4,
  },
  documentSnapshot: {
    useDocumentDate: true,
    fallbackRate: 1,
    note: "",
  },
};

type ManagedSettingsState = {
  company: CompanySettings;
  users: UsersSettings;
  documents: DocumentSettings;
  branding: BrandingSettings;
  currency: CurrencySettings;
};

type ManagedSection = keyof ManagedSettingsState;
type VisibleSettingsSection = Exclude<ManagedSection, "branding">;

const managedSections = [
  "company",
  "users",
  "documents",
  "branding",
  "currency",
] as const satisfies readonly SettingsSection[];

const emptyManagedSettings: ManagedSettingsState = {
  company: emptyCompanySettings,
  users: emptyUsersSettings,
  documents: emptyDocumentSettings,
  branding: emptyBrandingSettings,
  currency: emptyCurrencySettings,
};

const CURRENCY_OPTIONS = ["THB", "USD", "EUR", "JPY", "SGD", "CNY"] as const;

const BRANDING_COLOR_PRESETS = [
  { name: "Matter Green", hex: "#14B8A6" },
  { name: "Emerald", hex: "#10B981" },
  { name: "Deep Teal", hex: "#0F766E" },
  { name: "Mint Green", hex: "#34D399" },
  { name: "Navy", hex: "#0F172A" },
  { name: "Deep Navy", hex: "#1E3A8A" },
  { name: "Slate Navy", hex: "#334155" },
  { name: "Blue Navy", hex: "#1D4ED8" },
] as const;

type ColorSelectorCopy = {
  presetColors: string;
  selectColor: string;
  selectedColor: string;
};

const usersSettingsCopy = {
  en: {
    title: "Users & Roles",
    description: "Manage simple team access for your accounting workspace.",
    pageTitle: "Users & roles",
    inviteMessage: "Invite teammates to collaborate on setup, documents, and reporting.",
    manageHelper: "Only owners can change roles, permissions, and invitation actions.",
    ownerFullAccess: "Owner has full access.",
    employeeApproval: "Documents created by employees require owner approval.",
    permissionsTitle: "Permissions",
    role: "Role",
    lastSeen: "Last seen",
    inviteUser: "Invite user",
    copyInviteLink: "Copy invite link",
    resendInvite: "Resend invite",
    removeUser: "Remove user",
    saveChanges: "Save changes",
    cancel: "Cancel",
    changesDiscarded: "Changes discarded",
    saved: "Users & roles saved",
    invitationSaved: "User invitation saved",
    inviteLinkCopied: "Invite link copied",
    inviteLinkError: "Unable to copy invite link.",
    inviteDenied: "Only owners can invite users.",
    resendUnavailable: "Resend invite API is not connected yet.",
    roleLabels: {
      owner: "Owner",
      employee: "Employee",
    },
    permissions: {
      dashboard: {
        title: "Dashboard",
        description: "View dashboard and business summary.",
      },
      salesDocuments: {
        title: "Sales Documents",
        description: "Create and manage quotations, invoices, receipts, and sales documents.",
      },
      purchasesInventory: {
        title: "Purchases & Inventory",
        description: "Create and manage purchase orders, receiving inventory, expenses, and products.",
      },
      customersVendors: {
        title: "Customers & Vendors",
        description: "Create and manage customers, vendors, and contact details.",
      },
      reportsSettings: {
        title: "Reports & Settings",
        description: "View reports and allowed settings.",
      },
    },
  },
  th: {
    title: "ผู้ใช้และบทบาท",
    description: "จัดการสิทธิ์ของทีมอย่างง่ายสำหรับพื้นที่ทำงานบัญชี",
    pageTitle: "ผู้ใช้และบทบาท",
    inviteMessage: "เชิญเพื่อนร่วมทีมมาช่วยตั้งค่า ทำเอกสาร และดูรายงาน",
    manageHelper: "เฉพาะเจ้าของเท่านั้นที่เปลี่ยนบทบาท สิทธิ์ และคำเชิญได้",
    ownerFullAccess: "เจ้าของมีสิทธิ์ใช้งานทั้งหมด",
    employeeApproval: "เอกสารที่สร้างโดยพนักงานต้องรอเจ้าของอนุมัติ",
    permissionsTitle: "สิทธิ์การใช้งาน",
    role: "บทบาท",
    lastSeen: "ใช้งานล่าสุด",
    inviteUser: "เชิญผู้ใช้",
    copyInviteLink: "คัดลอกลิงก์เชิญ",
    resendInvite: "ส่งคำเชิญอีกครั้ง",
    removeUser: "นำผู้ใช้ออก",
    saveChanges: "บันทึกการเปลี่ยนแปลง",
    cancel: "ยกเลิก",
    changesDiscarded: "ยกเลิกการเปลี่ยนแปลงแล้ว",
    saved: "บันทึกผู้ใช้และบทบาทแล้ว",
    invitationSaved: "บันทึกคำเชิญผู้ใช้แล้ว",
    inviteLinkCopied: "คัดลอกลิงก์เชิญแล้ว",
    inviteLinkError: "ไม่สามารถคัดลอกลิงก์เชิญได้",
    inviteDenied: "เฉพาะเจ้าของเท่านั้นที่เชิญผู้ใช้ได้",
    resendUnavailable: "ยังไม่ได้เชื่อมต่อ API สำหรับส่งคำเชิญอีกครั้ง",
    roleLabels: {
      owner: "เจ้าของ",
      employee: "พนักงาน",
    },
    permissions: {
      dashboard: {
        title: "แดชบอร์ด",
        description: "ดูแดชบอร์ดและสรุปภาพรวมธุรกิจ",
      },
      salesDocuments: {
        title: "เอกสารขาย",
        description: "สร้างและจัดการใบเสนอราคา ใบแจ้งหนี้ ใบเสร็จ และเอกสารขาย",
      },
      purchasesInventory: {
        title: "การซื้อและสต็อก",
        description: "สร้างและจัดการใบสั่งซื้อ การรับสินค้า ค่าใช้จ่าย และสินค้า",
      },
      customersVendors: {
        title: "ลูกค้าและผู้ขาย",
        description: "สร้างและจัดการลูกค้า ผู้ขาย และข้อมูลติดต่อ",
      },
      reportsSettings: {
        title: "รายงานและการตั้งค่า",
        description: "ดูรายงานและการตั้งค่าที่ได้รับอนุญาต",
      },
    },
  },
} as const;

const USER_ROLES: Array<{ value: UserRole; label: string }> = [
  { value: "owner", label: "Owner" },
  { value: "employee", label: "Employee" },
];

const USER_PERMISSIONS: Array<{ value: UserPermission; titleKey: keyof typeof usersSettingsCopy.en.permissions }> = [
  { value: "dashboard", titleKey: "dashboard" },
  { value: "sales_documents", titleKey: "salesDocuments" },
  { value: "purchases_inventory", titleKey: "purchasesInventory" },
  { value: "customers_vendors", titleKey: "customersVendors" },
  { value: "reports_settings", titleKey: "reportsSettings" },
];

const ALL_USER_PERMISSIONS = USER_PERMISSIONS.map((permission) => permission.value);

const ROLE_PERMISSION_PRESETS: Record<UserRole, UserPermission[]> = {
  owner: ALL_USER_PERMISSIONS,
  employee: ["dashboard", "sales_documents", "customers_vendors"],
};

const LEGACY_ROLE_MAP: Record<string, UserRole> = {
  admin: "employee",
  manager: "employee",
  accountant: "employee",
  sales: "employee",
  purchasing: "employee",
  inventory: "employee",
  staff: "employee",
  viewer: "employee",
};

const LEGACY_PERMISSION_GROUPS: Record<string, UserPermission> = {
  view_dashboard: "dashboard",
  manage_company_profile: "reports_settings",
  manage_document_settings: "reports_settings",
  manage_users_roles: "reports_settings",
  view_documents: "sales_documents",
  create_documents: "sales_documents",
  edit_documents: "sales_documents",
  delete_documents: "sales_documents",
  approve_documents: "sales_documents",
  send_share_documents: "sales_documents",
  view_customers: "customers_vendors",
  manage_customers: "customers_vendors",
  view_products_services: "purchases_inventory",
  manage_products_services: "purchases_inventory",
  view_reports: "reports_settings",
  manage_currency_settings: "reports_settings",
};

const normalizeUserRole = (role?: string): UserRole => {
  const normalized = String(role || "employee").toLowerCase();
  return normalized === "owner" ? "owner" : LEGACY_ROLE_MAP[normalized] ?? "employee";
};

const normalizeUserPermissions = (role: UserRole, permissions?: string[]): UserPermission[] => {
  if (role === "owner") {
    return ROLE_PERMISSION_PRESETS.owner;
  }
  if (!Array.isArray(permissions)) {
    return ROLE_PERMISSION_PRESETS.employee;
  }
  return permissions.reduce<UserPermission[]>((acc, permission) => {
    const normalized = LEGACY_PERMISSION_GROUPS[permission] ?? (permission as UserPermission);
    if (ALL_USER_PERMISSIONS.includes(normalized) && !acc.includes(normalized)) {
      acc.push(normalized);
    }
    return acc;
  }, []);
};

const normalizeTeamMember = (member: TeamMember): TeamMember => {
  const role = normalizeUserRole(member.role);
  return {
    ...member,
    role,
    permissions: normalizeUserPermissions(role, member.permissions),
  };
};

type CompanyProfileForm = {
  businessType: string;
  vatRegistration: string;
  businessName: string;
  address: string;
  taxId: string;
  branchType: "head_office" | "branch";
  branchCode: string;
  branchName: string;
  addEnglishInfo: boolean;
  englishBusinessName: string;
  englishAddress: string;
  englishTaxId: string;
  englishBranchCode: string;
  englishBranchName: string;
  officePhone: string;
  mobilePhone: string;
  faxNumber: string;
  website: string;
  email: string;
};

const emptyCompanyProfileForm: CompanyProfileForm = {
  businessType: "",
  vatRegistration: "",
  businessName: "",
  address: "",
  taxId: "",
  branchType: "head_office",
  branchCode: "",
  branchName: "",
  addEnglishInfo: false,
  englishBusinessName: "",
  englishAddress: "",
  englishTaxId: "",
  englishBranchCode: "",
  englishBranchName: "",
  officePhone: "",
  mobilePhone: "",
  faxNumber: "",
  website: "",
  email: "",
};

const companyProfileCopy = {
  en: {
    businessInformation: "Business Information",
    businessType: "Business Type",
    vatRegistration: "VAT Registration",
    businessDetails: "Business Details",
    helper: "Information used for document issuance",
    businessName: "Business Name",
    address: "Address",
    taxId: "Tax ID",
    headOffice: "Head Office",
    branch: "Branch",
    branchCode: "Branch Code",
    branchName: "Branch Name",
    englishInformation: "English Business Information",
    addEnglishInformation: "Add Business English Information",
    contactInformation: "Contact Information",
    officePhone: "Office Phone",
    mobilePhone: "Mobile Phone",
    faxNumber: "Fax Number",
    website: "Website",
    email: "Email",
    selectPlaceholder: "Select",
    cancel: "Cancel",
    save: "Save changes",
    saved: "Company profile saved",
    discarded: "Changes discarded",
    businessTypes: {
      company: "Company Limited",
      partnership: "Partnership",
      soleProprietor: "Sole Proprietor",
      individual: "Individual",
      other: "Other",
    },
    vatOptions: {
      registered: "VAT Registered",
      notRegistered: "Not VAT Registered",
    },
  },
  th: {
    businessInformation: "ข้อมูลธุรกิจ",
    businessType: "ประเภทธุรกิจ",
    vatRegistration: "จดภาษีมูลค่าเพิ่ม",
    businessDetails: "รายละเอียดธุรกิจ",
    helper: "ข้อมูลใช้สำหรับการออกเอกสาร",
    businessName: "ชื่อธุรกิจ",
    address: "ที่อยู่",
    taxId: "เลขประจำตัวผู้เสียภาษี",
    headOffice: "สำนักงานใหญ่",
    branch: "สาขา",
    branchCode: "รหัสสาขา",
    branchName: "ชื่อสาขา",
    englishInformation: "ข้อมูลธุรกิจภาษาอังกฤษ",
    addEnglishInformation: "เพิ่มข้อมูลธุรกิจภาษาอังกฤษ",
    contactInformation: "ข้อมูลติดต่อ",
    officePhone: "เบอร์สำนักงาน",
    mobilePhone: "เบอร์มือถือ",
    faxNumber: "เบอร์โทรสาร",
    website: "เว็บไซต์",
    email: "อีเมล",
    selectPlaceholder: "เลือก",
    cancel: "ยกเลิก",
    save: "บันทึกการเปลี่ยนแปลง",
    saved: "บันทึกข้อมูลธุรกิจแล้ว",
    discarded: "ยกเลิกการเปลี่ยนแปลงแล้ว",
    businessTypes: {
      company: "บริษัทจำกัด",
      partnership: "ห้างหุ้นส่วน",
      soleProprietor: "เจ้าของคนเดียว",
      individual: "บุคคลธรรมดา",
      other: "อื่น ๆ",
    },
    vatOptions: {
      registered: "จดภาษีมูลค่าเพิ่ม",
      notRegistered: "ไม่จดภาษีมูลค่าเพิ่ม",
    },
  },
} as const;

const documentSettingsCopy = {
  en: {
    title: "Document Settings",
    description: "Configure document tax behavior, line discounts, branding assets, and document color.",
    sections: {
      vatSettings: {
        title: "VAT settings",
        helper: "Control VAT calculation and VAT display on documents.",
      },
      withholdingTaxSettings: {
        title: "Withholding tax settings",
        helper: "Control withholding tax display and per-line WHT options.",
      },
      discountsAdjustments: {
        title: "Discounts and adjustments",
        helper: "Control line discounts and receipt adjustment display.",
      },
      brandingAssets: {
        title: "Branding assets",
        helper: "Upload logo and signature images used on documents.",
      },
      documentColor: {
        title: "Document color",
        helper: "Choose a preset document highlight color.",
      },
    },
    color: {
      presetColors: "Preset color",
      selectColor: "Select color",
      selectedColor: "Selected color",
    },
    previewTitle: "Document preview",
    previewDescription: "Preview uses the real document template.",
    logo: "Logo",
    signature: "Signature",
    uploadAsset: "Upload",
    uploaded: "Uploaded and stored in backend.",
    noUpload: "No file uploaded yet.",
    accentColor: "Document color",
    enable: "Enable feature",
    disable: "Do not use",
    vatExclusive: "VAT Exclusive",
    vatInclusive: "VAT Inclusive",
    vatDisabled: "VAT options are disabled because this company is not VAT registered.",
    cancel: "Cancel",
    save: "Save changes",
    saved: "Document settings saved",
    discarded: "Changes discarded",
    rows: {
      showWhtFooter: {
        title: "Show withholding tax at document footer",
        description:
          "Show withholding tax totals at the document footer so service businesses can communicate the payable amount after tax deduction.",
      },
      taxMode: {
        title: "Price calculation: VAT exclusive or VAT inclusive",
        description:
          "Choose whether product or service prices shown in documents are before VAT or already include VAT.",
      },
      perLineVat: {
        title: "VAT per line item",
        description:
          "Use this when products or services in the same document have different VAT rates, such as VAT 7%, VAT 0%, or VAT exempt.",
      },
      perLineDiscount: {
        title: "Discount per line item",
        description:
          "Show line-level discounts when each product or service needs a different discount value.",
      },
      perLineWithholdingTax: {
        title: "Withholding tax per line item",
        description: "Allow each line item to use a different withholding tax rate.",
      },
      receiptAdjustmentFooter: {
        title: "Show receipt adjustment items at footer",
        description:
          "Show receipt footer adjustment items so the receipt reflects the actual collected payment amount.",
      },
    },
  },
  th: {
    title: "ตั้งค่าเอกสาร",
    description: "ตั้งค่าการแสดงผลเอกสาร ภาษี ไฟล์แบรนด์ สีเอกสาร และดูตัวอย่างเอกสารจริง",
    brandingTitle: "แบรนด์เอกสาร",
    brandingDescription: "อัปโหลดไฟล์สำหรับเอกสาร และตั้งค่าข้อความที่แสดงบนเอกสาร",
    sections: {
      vatSettings: {
        title: "ตั้งค่า VAT",
        helper: "ตั้งค่าการคำนวณและการแสดง VAT บนเอกสาร",
      },
      withholdingTaxSettings: {
        title: "ตั้งค่าภาษีหัก ณ ที่จ่าย",
        helper: "ตั้งค่าการแสดงภาษีหัก ณ ที่จ่ายและการหัก ณ ที่จ่ายแยกรายการ",
      },
      taxWithholding: {
        title: "ภาษีและหัก ณ ที่จ่าย",
        helper: "ตั้งค่าภาษีมูลค่าเพิ่มและภาษีหัก ณ ที่จ่ายสำหรับเอกสาร",
      },
      discountsAdjustments: {
        title: "ส่วนลดและรายการปรับยอด",
        helper: "ตั้งค่าส่วนลดรายบรรทัดและการแสดงรายการปรับยอดในใบเสร็จ",
      },
      brandingAssets: {
        title: "ไฟล์แบรนด์เอกสาร",
        helper: "อัปโหลดโลโก้ ตราประทับ และลายเซ็นที่ใช้บนเอกสาร",
      },
      documentColor: {
        title: "สีเอกสาร",
        helper: "เลือกสีหลักของเอกสารหรือกำหนดสีเอง",
      },
    },
    color: {
      presetColors: "สีสำเร็จรูป",
      selectColor: "เลือกสี",
      selectedColor: "สีที่เลือก",
    },
    logo: "โลโก้",
    stamp: "ตราประทับ",
    signature: "ลายเซ็น",
    uploadAsset: "อัปโหลด",
    uploaded: "อัปโหลดและบันทึกในระบบแล้ว",
    noUpload: "ยังไม่มีไฟล์",
    signatureLabel: "ป้ายกำกับลายเซ็น",
    stampLabel: "ป้ายกำกับตราประทับ",
    documentTagline: "ข้อความใต้ชื่อบริษัท",
    accentColor: "สีหลักของเอกสาร",
    enable: "ใช้งานฟังก์ชั่น",
    disable: "ไม่ใช้งาน",
    vatExclusive: "ราคาไม่รวมภาษี",
    vatInclusive: "ราคารวมภาษี",
    vatDisabled: "ปิดการตั้งค่า VAT เพราะบริษัทนี้ไม่ได้จดทะเบียนภาษีมูลค่าเพิ่ม",
    cancel: "ยกเลิก",
    save: "บันทึกการเปลี่ยนแปลง",
    saved: "บันทึกการตั้งค่าเอกสารแล้ว",
    discarded: "ยกเลิกการเปลี่ยนแปลงแล้ว",
    rows: {
      showWhtFooter: {
        title: "แสดงหัก ณ ที่จ่ายท้ายเอกสาร",
        description:
          "การแสดงยอดภาษีหัก ณ ที่จ่ายท้ายเอกสาร เพื่อความสะดวกในการแจ้งยอดชำระหลังหักภาษี เหมาะสำหรับธุรกิจให้บริการ",
      },
      taxMode: {
        title: "การตั้งค่า ราคารวมหรือราคาไม่รวมภาษี",
        description:
          "แสดงราคาสินค้าหรือบริการในเอกสาร ให้เป็นราคาที่รวมภาษี หรือราคาไม่รวมภาษี",
      },
      perLineVat: {
        title: "ภาษีมูลค่าเพิ่ม แยกรายการ",
        description:
          "สำหรับการเปิดเอกสารที่มีรายการสินค้าหรือบริการ มีภาษีมูลค่าเพิ่มไม่เท่ากันในแต่ละรายการ",
      },
      perLineDiscount: {
        title: "ส่วนลดแยกรายการ",
        description:
          "ส่วนลดแยกรายการ สำหรับกรณีรายการสินค้าหรือบริการต้องการแสดงส่วนลดในมูลค่าที่ไม่เท่ากัน",
      },
      perLineWithholdingTax: {
        title: "หัก ณ ที่จ่ายแยกรายการ",
        description: "ให้แต่ละรายการกำหนดอัตราภาษีหัก ณ ที่จ่ายได้ต่างกัน",
      },
      receiptAdjustmentFooter: {
        title: "แสดงรายการปรับลดท้ายเอกสารใบเสร็จรับเงิน",
        description:
          "แสดงรายการท้ายเอกสารของส่วนปรับลด ทั้งนี้ท้ายใบเสร็จรับเงิน เพื่อได้ยอดชำระที่เรียกเก็บเงินจริง",
      },
    },
  },
} as const;

const resolveCompanyProfileForm = (company: CompanySettings): CompanyProfileForm => {
  const savedProfile = (company as CompanySettings & { businessProfile?: Partial<CompanyProfileForm> }).businessProfile;

  if (savedProfile) {
    return {
      ...emptyCompanyProfileForm,
      ...savedProfile,
      branchType: savedProfile.branchType === "branch" ? "branch" : "head_office",
      addEnglishInfo: Boolean(savedProfile.addEnglishInfo),
    };
  }

  const branchText = String(company.branch || "");
  const isBranch = /branch|สาขา/i.test(branchText) && !/head office|สำนักงานใหญ่/i.test(branchText);
  return {
    ...emptyCompanyProfileForm,
    vatRegistration: company.vatRegistrationMode || "",
    businessName: company.name || "",
    address: company.address || "",
    taxId: company.taxId || "",
    branchType: isBranch ? "branch" : "head_office",
    branchCode: isBranch ? branchText.match(/\d{5}/)?.[0] ?? "" : "",
    branchName: isBranch ? branchText.replace(/\(?\d{5}\)?/g, "").replace(/branch|สาขา/gi, "").trim() : "",
    officePhone: company.phone || "",
    website: company.website || "",
    email: company.email || "",
  };
};

const Settings = () => {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const nav = useNavigate();
  const [settingsState, setSettingsState] = useState<ManagedSettingsState>(emptyManagedSettings);
  const [initialSettings, setInitialSettings] = useState<ManagedSettingsState>(emptyManagedSettings);
  const [companyProfileForm, setCompanyProfileForm] = useState<CompanyProfileForm>(emptyCompanyProfileForm);
  const [initialCompanyProfileForm, setInitialCompanyProfileForm] = useState<CompanyProfileForm>(emptyCompanyProfileForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assetUploading, setAssetUploading] = useState<"logo" | "signature" | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const activeSection = useMemo<VisibleSettingsSection>(() => {
    const match = sections.find((section) => location.pathname === section.to);
    return match?.id ?? "company";
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname === "/settings") {
      nav("/settings/company", { replace: true });
    }
  }, [location.pathname, nav]);

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      try {
        setLoading(true);
        const results = await Promise.all(
          managedSections.map(async (section) => [section, await fetchSettingsSection(section)] as const)
        );

        const next = results.reduce((acc, [section, value]) => {
          return { ...acc, [section]: value };
        }, emptyManagedSettings) as ManagedSettingsState;
        next.users = {
          ...next.users,
          members: next.users.members.map(normalizeTeamMember),
        };

        if (!cancelled) {
          const companyProfile = resolveCompanyProfileForm(next.company);
          setSettingsState(next);
          setInitialSettings(next);
          setCompanyProfileForm(companyProfile);
          setInitialCompanyProfileForm(companyProfile);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Unable to load settings.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeManagedSection = activeSection;
  const activeLabel = sections.find((section) => section.id === activeSection)?.label ?? "Settings";
  const companyLanguage = i18n.language?.startsWith("th") ? "th" : "en";
  const companyText = companyProfileCopy[companyLanguage];
  const documentText = documentSettingsCopy[companyLanguage];
  const usersText = usersSettingsCopy[companyLanguage];
  const companyVatRegistered = settingsState.company.vatRegistrationMode !== "not_registered";
  const currentMember = settingsState.users.members.find(
    (member) => member.email.toLowerCase() === (user?.email ?? "").toLowerCase()
  );
  const canManageUsers = normalizeUserRole(currentMember?.role ?? user?.role) === "owner";

  const isDirty = activeManagedSection
    ? activeManagedSection === "company"
      ? JSON.stringify(companyProfileForm) !== JSON.stringify(initialCompanyProfileForm)
      : activeManagedSection === "documents"
        ? JSON.stringify(settingsState.documents) !== JSON.stringify(initialSettings.documents) ||
          JSON.stringify(settingsState.branding) !== JSON.stringify(initialSettings.branding)
      : JSON.stringify(settingsState[activeManagedSection]) !== JSON.stringify(initialSettings[activeManagedSection])
    : false;

  const persistSection = async <T extends ManagedSection>(
    section: T,
    payload: ManagedSettingsState[T],
    successLabel?: string
  ) => {
    const saved = (await saveSettingsSection(section as SettingsSection, payload as never)) as ManagedSettingsState[T];
    setSettingsState((previous) => ({ ...previous, [section]: saved }));
    setInitialSettings((previous) => ({ ...previous, [section]: saved }));
    if (successLabel) {
      toast.success(successLabel);
    }
    return saved;
  };

  const handleSave = async () => {
    if (!activeManagedSection) {
      return;
    }

    setSaving(true);
    try {
      if (activeManagedSection === "company") {
        const companyPayload = {
          ...settingsState.company,
          name: companyProfileForm.businessName,
          taxId: companyProfileForm.taxId,
          branch:
            companyProfileForm.branchType === "head_office"
              ? "Head Office"
              : [companyProfileForm.branchCode, companyProfileForm.branchName].filter(Boolean).join(" "),
          address: companyProfileForm.address,
          phone: companyProfileForm.officePhone || companyProfileForm.mobilePhone,
          email: companyProfileForm.email,
          contactName: "",
          website: companyProfileForm.website,
          vatRegistrationMode:
            companyProfileForm.vatRegistration === "registered" ? "registered" : "not_registered",
          businessProfile: companyProfileForm,
        } as CompanySettings;

        console.log("Company profile form data", companyProfileForm);
        await persistSection("company", companyPayload, companyText.saved);
        if (companyPayload.vatRegistrationMode === "not_registered") {
          const sanitizedDocuments = sanitizeDocumentSettingsForCompany(settingsState.documents, false);
          if (JSON.stringify(sanitizedDocuments) !== JSON.stringify(settingsState.documents)) {
            await persistSection("documents", sanitizedDocuments, undefined);
          }
        }
        setInitialCompanyProfileForm(companyProfileForm);
        return;
      }

      if (activeManagedSection === "documents") {
        const nextDocuments = sanitizeDocumentSettingsForCompany(settingsState.documents);
        const documentsChanged = JSON.stringify(nextDocuments) !== JSON.stringify(initialSettings.documents);
        const brandingChanged = JSON.stringify(settingsState.branding) !== JSON.stringify(initialSettings.branding);
        if (documentsChanged) {
          await persistSection("documents", nextDocuments, undefined);
        }
        if (brandingChanged) {
          await persistSection("branding", settingsState.branding, undefined);
        }
        toast.success(documentText.saved);
        return;
      }

      const nonCompanySection = activeManagedSection as Exclude<ManagedSection, "company">;
      let payload = settingsState[nonCompanySection] as ManagedSettingsState[typeof nonCompanySection];
      if (activeManagedSection === "currency") {
        const enabledCurrencies = Array.from(
          new Set([settingsState.currency.baseCurrency, ...settingsState.currency.enabledCurrencies])
        );
        payload = {
          ...settingsState.currency,
          enabledCurrencies,
          multiCurrencyEnabled: enabledCurrencies.length > 1,
        } as ManagedSettingsState[typeof activeManagedSection];
      }

      await persistSection(
        nonCompanySection,
        payload,
        activeManagedSection === "users" ? usersText.saved : `${activeLabel} saved`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (!activeManagedSection) {
      return;
    }
    if (activeManagedSection === "company") {
      setCompanyProfileForm(initialCompanyProfileForm);
      toast.success(companyText.discarded);
      return;
    }
    if (activeManagedSection === "documents") {
      setSettingsState((previous) => ({
        ...previous,
        documents: initialSettings.documents,
        branding: initialSettings.branding,
      }));
      toast.success(documentText.discarded);
      return;
    }
    setSettingsState((previous) => ({
      ...previous,
      [activeManagedSection]: initialSettings[activeManagedSection],
    }));
    toast.success(activeManagedSection === "users" ? usersText.changesDiscarded : "Changes discarded");
  };

  const updateCompanyProfileForm = (patch: Partial<CompanyProfileForm>) => {
    setCompanyProfileForm((previous) => ({ ...previous, ...patch }));
  };

  const updateSection = <T extends keyof ManagedSettingsState>(
    section: T,
    patch: Partial<ManagedSettingsState[T]>
  ) => {
    setSettingsState((previous) => ({
      ...previous,
      [section]: {
        ...previous[section],
        ...patch,
      },
    }));
  };

  const updateNestedSection = <
    T extends keyof ManagedSettingsState,
    K extends keyof ManagedSettingsState[T] & string,
  >(
    section: T,
    key: K,
    patch: ManagedSettingsState[T][K] extends object ? Partial<ManagedSettingsState[T][K]> : never
  ) => {
    setSettingsState((previous) => ({
      ...previous,
      [section]: {
        ...previous[section],
        [key]: {
          ...(previous[section][key] as object),
          ...(patch as object),
        },
      },
    }));
  };

  const sanitizeDocumentSettingsForCompany = (documents: DocumentSettings, vatRegistered = companyVatRegistered) =>
    vatRegistered
      ? documents
      : {
          ...documents,
          taxMode: "exclusive" as DocumentSettings["taxMode"],
          perLineVat: false,
        };

  const handleBrandingUpload = async (assetKey: "logo" | "signature", file?: File) => {
    if (!file) {
      return;
    }

    setAssetUploading(assetKey);
    try {
      const saved = await uploadBrandingAsset(assetKey, file);
      setSettingsState((previous) => ({ ...previous, branding: saved }));
      setInitialSettings((previous) => ({ ...previous, branding: saved }));
      toast.success(`${assetKey[0].toUpperCase()}${assetKey.slice(1)} uploaded`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Unable to upload ${assetKey}.`);
    } finally {
      setAssetUploading(null);
    }
  };

  const handleInviteUser = async (member: TeamMember) => {
    if (!canManageUsers) {
      toast.error(usersText.inviteDenied);
      return;
    }
    const role = normalizeUserRole(member.role || "employee");
    const nextUsers: UsersSettings = {
      ...settingsState.users,
      members: [
        {
          ...member,
          role,
          permissions: ROLE_PERMISSION_PRESETS[role],
          inviteToken: member.inviteToken || `invite-${member.id.toLowerCase()}`,
          inviteUrl: member.inviteUrl || `/auth/register?invite=${encodeURIComponent(member.id)}`,
        },
        ...settingsState.users.members,
      ],
    };
    await persistSection("users", nextUsers, usersText.invitationSaved);
  };

  const updateMember = (memberId: string, patch: Partial<TeamMember>) => {
    updateSection("users", {
      members: settingsState.users.members.map((member) =>
        member.id === memberId
          ? {
              ...member,
              ...patch,
            }
          : member
      ),
    });
  };

  const updateMemberRole = (member: TeamMember, role: UserRole) => {
    const normalizedRole = normalizeUserRole(role);
    updateMember(member.id, { role: normalizedRole, permissions: ROLE_PERMISSION_PRESETS[normalizedRole] });
  };

  const toggleMemberPermission = (member: TeamMember, permission: UserPermission, checked: boolean) => {
    const role = normalizeUserRole(member.role);
    if (role === "owner") {
      updateMember(member.id, { role, permissions: ROLE_PERMISSION_PRESETS.owner });
      return;
    }
    const existing = normalizeUserPermissions(role, member.permissions);
    const permissions = checked
      ? Array.from(new Set([...existing, permission]))
      : existing.filter((item) => item !== permission);
    updateMember(member.id, { permissions });
  };

  const removeMember = (memberId: string) => {
    updateSection("users", {
      members: settingsState.users.members.map((member) =>
        member.id === memberId ? { ...member, status: "inactive" } : member
      ),
    });
  };

  const copyInviteLink = async (member: TeamMember) => {
    const inviteUrl = member.inviteUrl || `/auth/register?invite=${encodeURIComponent(member.id)}`;
    const absoluteUrl = typeof window === "undefined" ? inviteUrl : new URL(inviteUrl, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      toast.success(usersText.inviteLinkCopied);
    } catch {
      toast.error(usersText.inviteLinkError);
    }
  };

  const previewTitle = companyLanguage === "th" ? "ตัวอย่างเอกสาร" : "Document preview";
  const previewDescription =
    companyLanguage === "th"
      ? "ตัวอย่างนี้ใช้เทมเพลตเดียวกับเอกสารจริง"
      : "Preview uses the real document template.";

  const previewDocumentData: SalesDocumentTemplateData = {
    title: companyLanguage === "th" ? "ใบแจ้งหนี้" : "Invoice",
    titleEn: "Invoice",
    documentTypes: ["invoice"],
    copyGeneration: "original",
    language: companyLanguage,
    status: "approved",
    documentNumber: "INV-2026-0400001",
    seller: {
      name: settingsState.company.name || "Your Company Co., Ltd.",
      address: settingsState.company.address || "123 Business Road, Bangkok",
      taxId: settingsState.company.taxId || "0105559000000",
      branch: settingsState.company.branch || "Head Office",
      phone: settingsState.company.phone || "02-000-0000",
      email: settingsState.company.email || "billing@example.com",
      website: settingsState.company.website || "www.example.com",
    },
    customer: {
      code: "C-001",
      name: "Bangkok Foods Co., Ltd.",
      address: "88 Sukhumvit Road, Bangkok",
      taxId: "0105560000000",
      branch: "Head Office",
      contactPerson: "Purchasing Team",
      phone: "02-111-2222",
      email: "ap@bangkokfoods.example",
    },
    branding: settingsState.branding,
    documentSettingsSnapshot: settingsState.documents,
    issueDate: "2026-04-19",
    dueDate: "2026-05-03",
    creditTerms: "14",
    reference: "PO-2026-0001",
    relatedDocument: "QT-2026-0400001",
    documentContact: "Aimmy Admin",
    sellerUser: { name: "Aimmy Admin", email: "admin@example.com" },
    lines: [
      {
        id: "1",
        sku: "CONSULT-01",
        displayCode: "CONSULT-01",
        desc: "Monthly accounting support",
        details: "Document template preview sample",
        qty: 1,
        unit: "month",
        price: 18000,
        discount: settingsState.documents.perLineDiscount ? 5 : 0,
        tax: 7,
        vatRate: 7,
        withholdingRate: settingsState.documents.perLineWithholdingTax ? 3 : 0,
        withholdingAmount: settingsState.documents.perLineWithholdingTax ? 513 : 0,
      },
    ],
    totals: {
      subtotalBeforeDiscount: 18000,
      totalDiscount: settingsState.documents.perLineDiscount ? 900 : 0,
      amountBeforeVat: settingsState.documents.perLineDiscount ? 17100 : 18000,
      vatAmount: settingsState.documents.perLineDiscount ? 1197 : 1260,
      grandTotal: settingsState.documents.perLineDiscount ? 18297 : 19260,
      withholdingAmount: settingsState.documents.showWhtFooter ? 513 : 0,
      amountPaid: 0,
      remainingDue: settingsState.documents.perLineDiscount ? 17784 : 19260,
    },
    discountRate: settingsState.documents.perLineDiscount ? 5 : 0,
    withholdingRate: settingsState.documents.showWhtFooter ? 3 : 0,
    currency: settingsState.currency.baseCurrency || "THB",
    paymentMethod: "Bank Transfer",
    paymentDetails: {},
    selectedBankAccount: settingsState.company.bankAccounts?.[0] ?? {
      bankName: "Bangkok Bank",
      accountName: settingsState.company.name || "Your Company Co., Ltd.",
      accountNumber: "123-4-56789-0",
      branch: "Sukhumvit",
      swiftCode: "BKKBTBKK",
    },
    paymentTerms: "Net 14",
    notes: companyLanguage === "th" ? "ขอบคุณที่ใช้บริการ" : "Thank you for your business.",
    amountWordsThai: "หนึ่งหมื่นเจ็ดพันเจ็ดร้อยแปดสิบสี่บาทถ้วน",
    amountWordsEnglish: "Seventeen thousand seven hundred eighty-four baht only",
    showAmountPaid: false,
  };

  const renderManagedSection = () => {
    switch (activeSection) {
      case "company":
        return (
          <div className="mx-auto w-full max-w-6xl">
            <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
              <section className="mb-6 border-b border-border/60 pb-6">
                <div className="mb-4">
                  <h2 className="font-display text-lg font-semibold">{companyText.businessInformation}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{companyText.helper}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>{companyText.businessType}</Label>
                    <Select
                      value={companyProfileForm.businessType || "none"}
                      onValueChange={(value) =>
                        updateCompanyProfileForm({ businessType: value === "none" ? "" : value })
                      }
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder={companyText.selectPlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{companyText.selectPlaceholder}</SelectItem>
                        <SelectItem value="company">{companyText.businessTypes.company}</SelectItem>
                        <SelectItem value="partnership">{companyText.businessTypes.partnership}</SelectItem>
                        <SelectItem value="sole_proprietor">{companyText.businessTypes.soleProprietor}</SelectItem>
                        <SelectItem value="individual">{companyText.businessTypes.individual}</SelectItem>
                        <SelectItem value="other">{companyText.businessTypes.other}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{companyText.vatRegistration}</Label>
                    <Select
                      value={companyProfileForm.vatRegistration || "none"}
                      onValueChange={(value) =>
                        updateCompanyProfileForm({ vatRegistration: value === "none" ? "" : value })
                      }
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder={companyText.selectPlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{companyText.selectPlaceholder}</SelectItem>
                        <SelectItem value="registered">{companyText.vatOptions.registered}</SelectItem>
                        <SelectItem value="not_registered">{companyText.vatOptions.notRegistered}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              <section className="mb-6 border-b border-border/60 pb-6">
                <div className="mb-4">
                  <h2 className="font-display text-lg font-semibold">{companyText.businessDetails}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{companyText.helper}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="company-business-name">{companyText.businessName}</Label>
                    <Input
                      id="company-business-name"
                      value={companyProfileForm.businessName}
                      placeholder={companyText.businessName}
                      onChange={(event) => updateCompanyProfileForm({ businessName: event.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="company-tax-id">{companyText.taxId}</Label>
                    <Input
                      id="company-tax-id"
                      value={companyProfileForm.taxId}
                      placeholder={companyText.taxId}
                      onChange={(event) => updateCompanyProfileForm({ taxId: event.target.value })}
                      className="mt-1.5 font-mono"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="company-address">{companyText.address}</Label>
                    <Textarea
                      id="company-address"
                      value={companyProfileForm.address}
                      placeholder={companyText.address}
                      onChange={(event) => updateCompanyProfileForm({ address: event.target.value })}
                      className="mt-1.5 min-h-[96px]"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>{`${companyText.headOffice} / ${companyText.branch}`}</Label>
                    <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
                      {(["head_office", "branch"] as const).map((branchType) => {
                        const selected = companyProfileForm.branchType === branchType;
                        return (
                          <label
                            key={branchType}
                            className={cn(
                              "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition",
                              selected
                                ? "border-primary bg-primary/5 text-foreground shadow-sm"
                                : "border-border/60 bg-background hover:border-primary/40 hover:bg-secondary/40"
                            )}
                          >
                            <input
                              type="radio"
                              name="company-branch-type"
                              checked={selected}
                              onChange={() => updateCompanyProfileForm({ branchType })}
                              className="h-4 w-4 accent-primary"
                            />
                            <span className="font-medium">
                              {branchType === "head_office" ? companyText.headOffice : companyText.branch}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="company-branch-code">{companyText.branchCode}</Label>
                    <Input
                      id="company-branch-code"
                      value={companyProfileForm.branchCode}
                      placeholder={companyText.branchCode}
                      disabled={companyProfileForm.branchType === "head_office"}
                      onChange={(event) => updateCompanyProfileForm({ branchCode: event.target.value })}
                      className="mt-1.5 disabled:bg-secondary/50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="company-branch-name">{companyText.branchName}</Label>
                    <Input
                      id="company-branch-name"
                      value={companyProfileForm.branchName}
                      placeholder={companyText.branchName}
                      disabled={companyProfileForm.branchType === "head_office"}
                      onChange={(event) => updateCompanyProfileForm({ branchName: event.target.value })}
                      className="mt-1.5 disabled:bg-secondary/50"
                    />
                  </div>
                </div>
              </section>

              <section className="mb-6 border-b border-border/60 pb-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="font-display text-lg font-semibold">{companyText.englishInformation}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{companyText.helper}</p>
                  </div>
                  <label className="flex w-fit cursor-pointer items-center gap-3 rounded-xl border border-border/60 bg-background px-4 py-2 text-sm font-medium">
                    <Checkbox
                      checked={companyProfileForm.addEnglishInfo}
                      onCheckedChange={(checked) => updateCompanyProfileForm({ addEnglishInfo: Boolean(checked) })}
                    />
                    <span>{companyText.addEnglishInformation}</span>
                  </label>
                </div>
                {companyProfileForm.addEnglishInfo ? (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="company-english-name">{companyText.businessName}</Label>
                      <Input
                        id="company-english-name"
                        value={companyProfileForm.englishBusinessName}
                        placeholder={companyText.businessName}
                        onChange={(event) => updateCompanyProfileForm({ englishBusinessName: event.target.value })}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="company-english-tax-id">{companyText.taxId}</Label>
                      <Input
                        id="company-english-tax-id"
                        value={companyProfileForm.englishTaxId}
                        placeholder={companyText.taxId}
                        onChange={(event) => updateCompanyProfileForm({ englishTaxId: event.target.value })}
                        className="mt-1.5 font-mono"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="company-english-address">{companyText.address}</Label>
                      <Textarea
                        id="company-english-address"
                        value={companyProfileForm.englishAddress}
                        placeholder={companyText.address}
                        onChange={(event) => updateCompanyProfileForm({ englishAddress: event.target.value })}
                        className="mt-1.5 min-h-[96px]"
                      />
                    </div>
                    <div>
                      <Label htmlFor="company-english-branch-code">{companyText.branchCode}</Label>
                      <Input
                        id="company-english-branch-code"
                        value={companyProfileForm.englishBranchCode}
                        placeholder={companyText.branchCode}
                        onChange={(event) => updateCompanyProfileForm({ englishBranchCode: event.target.value })}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="company-english-branch-name">{companyText.branchName}</Label>
                      <Input
                        id="company-english-branch-name"
                        value={companyProfileForm.englishBranchName}
                        placeholder={companyText.branchName}
                        onChange={(event) => updateCompanyProfileForm({ englishBranchName: event.target.value })}
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="mb-0 border-b-0 pb-0">
                <div className="mb-4">
                  <h2 className="font-display text-lg font-semibold">{companyText.contactInformation}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{companyText.helper}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="company-office-phone">{companyText.officePhone}</Label>
                    <Input
                      id="company-office-phone"
                      value={companyProfileForm.officePhone}
                      placeholder={companyText.officePhone}
                      onChange={(event) => updateCompanyProfileForm({ officePhone: event.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="company-mobile-phone">{companyText.mobilePhone}</Label>
                    <Input
                      id="company-mobile-phone"
                      value={companyProfileForm.mobilePhone}
                      placeholder={companyText.mobilePhone}
                      onChange={(event) => updateCompanyProfileForm({ mobilePhone: event.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="company-fax-number">{companyText.faxNumber}</Label>
                    <Input
                      id="company-fax-number"
                      value={companyProfileForm.faxNumber}
                      placeholder={companyText.faxNumber}
                      onChange={(event) => updateCompanyProfileForm({ faxNumber: event.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="company-website">{companyText.website}</Label>
                    <Input
                      id="company-website"
                      value={companyProfileForm.website}
                      placeholder={companyText.website}
                      onChange={(event) => updateCompanyProfileForm({ website: event.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="company-email">{companyText.email}</Label>
                    <Input
                      id="company-email"
                      type="email"
                      value={companyProfileForm.email}
                      placeholder={companyText.email}
                      onChange={(event) => updateCompanyProfileForm({ email: event.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </section>
            </div>
          </div>
        );
      case "users":
        return (
          <div>
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="mb-1 text-lg font-display font-semibold">{usersText.pageTitle}</h2>
                <p className="text-sm text-muted-foreground">
                  {settingsState.users.inviteMessage || usersText.inviteMessage}
                </p>
                {!canManageUsers ? (
                  <p className="mt-2 text-xs font-medium text-muted-foreground">
                    {usersText.manageHelper}
                  </p>
                ) : null}
              </div>
              <Button
                className="gap-1.5 border-0 bg-gradient-brand text-primary-foreground shadow-brand"
                onClick={() => setInviteOpen(true)}
                disabled={!canManageUsers}
              >
                <Users className="h-4 w-4" /> {usersText.inviteUser}
              </Button>
            </div>

            <div className="space-y-4">
              {settingsState.users.members.map((rawMember) => {
                const member = normalizeTeamMember(rawMember);
                const isOwner = member.role === "owner";
                const memberPermissions = isOwner
                  ? ROLE_PERMISSION_PRESETS.owner
                  : normalizeUserPermissions(member.role, member.permissions);
                const permissionLocked = !canManageUsers || isOwner;
                return (
                <div key={member.id} className="rounded-2xl border border-border/60 bg-card p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{member.name}</p>
                        <StatusBadge status={member.status === "pending" ? "pending" : member.status} />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{member.email}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {usersText.lastSeen}: {member.lastSeen}
                      </p>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                      <Select
                        value={member.role}
                        onValueChange={(value) => updateMemberRole(member, value as UserRole)}
                        disabled={!canManageUsers || isOwner}
                      >
                        <SelectTrigger className="w-full sm:w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {USER_ROLES.map((role) => (
                            <SelectItem key={role.value} value={role.value}>
                              {usersText.roleLabels[role.value]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-border/60 bg-background p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold">{usersText.permissionsTitle}</h3>
                        <p className="text-xs text-muted-foreground">
                          {isOwner ? usersText.ownerFullAccess : usersText.employeeApproval}
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {USER_PERMISSIONS.map((permission) => {
                        const checked = memberPermissions.includes(permission.value);
                        const permissionCopy = usersText.permissions[permission.titleKey];
                        return (
                          <label
                            key={permission.value}
                            className={cn(
                              "flex min-h-[84px] items-start gap-3 rounded-xl border border-border/60 px-3 py-3 text-sm transition",
                              !permissionLocked
                                ? "cursor-pointer bg-card hover:border-primary/40"
                                : "bg-secondary/30 text-muted-foreground"
                            )}
                          >
                            <Checkbox
                              className="mt-0.5"
                              checked={checked}
                              disabled={permissionLocked}
                              onCheckedChange={(value) => toggleMemberPermission(member, permission.value, Boolean(value))}
                            />
                            <span>
                              <span className="block font-medium text-foreground">{permissionCopy.title}</span>
                              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                                {permissionCopy.description}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    {member.status === "pending" ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => void copyInviteLink(member)}
                          disabled={!canManageUsers}
                        >
                          <Copy className="h-4 w-4" /> {usersText.copyInviteLink}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          disabled
                          title={usersText.resendUnavailable}
                        >
                          <Mail className="h-4 w-4" /> {usersText.resendInvite}
                        </Button>
                      </>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => removeMember(member.id)}
                      disabled={!canManageUsers || isOwner || member.status === "inactive"}
                    >
                      <Trash2 className="h-4 w-4" /> {usersText.removeUser}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="border-0 bg-gradient-brand text-primary-foreground shadow-brand"
                      onClick={() => void handleSave()}
                      disabled={!canManageUsers || !isDirty || saving}
                    >
                      {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                      {usersText.saveChanges}
                    </Button>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        );
      case "documents":
        return (
          <div className="mx-auto w-full max-w-7xl">
            <div className="mb-5">
              <h2 className="font-display text-xl font-semibold">{documentText.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{documentText.description}</p>
            </div>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-6">
                <DocumentSettingsGroup
                  title={documentText.sections.vatSettings.title}
                  helper={documentText.sections.vatSettings.helper}
                  highlighted
                >
                  <DocumentSettingRow
                    title={documentText.rows.taxMode.title}
                    description={documentText.rows.taxMode.description}
                    options={[
                      { label: documentText.vatExclusive, value: "exclusive" },
                      { label: documentText.vatInclusive, value: "inclusive" },
                    ]}
                    value={companyVatRegistered ? settingsState.documents.taxMode ?? "exclusive" : "exclusive"}
                    onChange={(value) => updateSection("documents", { taxMode: value as DocumentSettings["taxMode"] })}
                    disabled={!companyVatRegistered}
                    helper={!companyVatRegistered ? documentText.vatDisabled : undefined}
                  />
                  <DocumentSettingRow
                    title={documentText.rows.perLineVat.title}
                    description={documentText.rows.perLineVat.description}
                    options={[
                      { label: documentText.enable, value: "true" },
                      { label: documentText.disable, value: "false" },
                    ]}
                    value={String(companyVatRegistered && Boolean(settingsState.documents.perLineVat))}
                    onChange={(value) => updateSection("documents", { perLineVat: value === "true" })}
                    disabled={!companyVatRegistered}
                    helper={!companyVatRegistered ? documentText.vatDisabled : undefined}
                    isLast
                  />
                </DocumentSettingsGroup>

                <DocumentSettingsGroup
                  title={documentText.sections.withholdingTaxSettings.title}
                  helper={documentText.sections.withholdingTaxSettings.helper}
                >
                  <DocumentSettingRow
                    title={documentText.rows.showWhtFooter.title}
                    description={documentText.rows.showWhtFooter.description}
                    options={[
                      { label: documentText.enable, value: "true" },
                      { label: documentText.disable, value: "false" },
                    ]}
                    value={String(Boolean(settingsState.documents.showWhtFooter))}
                    onChange={(value) => updateSection("documents", { showWhtFooter: value === "true" })}
                  />
                  <DocumentSettingRow
                    title={documentText.rows.perLineWithholdingTax.title}
                    description={documentText.rows.perLineWithholdingTax.description}
                    options={[
                      { label: documentText.enable, value: "true" },
                      { label: documentText.disable, value: "false" },
                    ]}
                    value={String(Boolean(settingsState.documents.perLineWithholdingTax))}
                    onChange={(value) => updateSection("documents", { perLineWithholdingTax: value === "true" })}
                    isLast
                  />
                </DocumentSettingsGroup>

                <DocumentSettingsGroup
                  title={documentText.sections.discountsAdjustments.title}
                  helper={documentText.sections.discountsAdjustments.helper}
                >
                  <DocumentSettingRow
                    title={documentText.rows.perLineDiscount.title}
                    description={documentText.rows.perLineDiscount.description}
                    options={[
                      { label: documentText.enable, value: "true" },
                      { label: documentText.disable, value: "false" },
                    ]}
                    value={String(Boolean(settingsState.documents.perLineDiscount))}
                    onChange={(value) => updateSection("documents", { perLineDiscount: value === "true" })}
                  />
                  <DocumentSettingRow
                    title={documentText.rows.receiptAdjustmentFooter.title}
                    description={documentText.rows.receiptAdjustmentFooter.description}
                    options={[
                      { label: documentText.enable, value: "true" },
                      { label: documentText.disable, value: "false" },
                    ]}
                    value={String(Boolean(settingsState.documents.receiptAdjustmentFooter))}
                    onChange={(value) => updateSection("documents", { receiptAdjustmentFooter: value === "true" })}
                    isLast
                  />
                </DocumentSettingsGroup>

                <section className="rounded-2xl border border-border/60 bg-card p-5">
                  <div className="mb-4">
                    <h3 className="font-display text-lg font-semibold">{documentText.sections.brandingAssets.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{documentText.sections.brandingAssets.helper}</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {[
                      ["logo", documentText.logo, settingsState.branding.logoUrl],
                      ["signature", documentText.signature, settingsState.branding.signatureUrl],
                    ].map(([assetKey, label, currentUrl]) => (
                      <BrandingAssetUpload
                        key={assetKey}
                        assetKey={assetKey as "logo" | "signature"}
                        label={label}
                        currentUrl={currentUrl}
                        uploading={assetUploading === assetKey}
                        uploadText={documentText.uploadAsset}
                        uploadedText={documentText.uploaded}
                        emptyText={documentText.noUpload}
                        onUpload={handleBrandingUpload}
                      />
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-border/60 bg-card p-5">
                  <div className="mb-4">
                    <h3 className="font-display text-lg font-semibold">{documentText.sections.documentColor.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{documentText.sections.documentColor.helper}</p>
                  </div>
                  <DocumentColorSelector
                    value={settingsState.branding.accentColor || emptyBrandingSettings.accentColor}
                    labels={documentText.color}
                    onChange={(accentColor) => updateSection("branding", { accentColor })}
                  />
                </section>
              </div>
              <aside className="hidden xl:block xl:self-start xl:sticky xl:top-24">
                <DocumentPreviewPanel
                  document={previewDocumentData}
                  title={previewTitle}
                  description={previewDescription}
                  onOpen={() => setPreviewOpen(true)}
                />
              </aside>
            </div>
          </div>
        );
      case "currency":
        return (
          <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
            <div className="space-y-5">
              <div>
                <h2 className="mb-1 text-lg font-display font-semibold">Currency</h2>
                <p className="mb-4 text-sm text-muted-foreground">Control base currency, enabled currencies, and document exchange-rate snapshots.</p>
              </div>
              <div>
                <Label htmlFor="currency-base">Base currency</Label>
                <Input id="currency-base" value={settingsState.currency.baseCurrency} onChange={(event) => updateSection("currency", { baseCurrency: event.target.value.toUpperCase() })} className="mt-1.5" />
              </div>
              <div className="rounded-xl border border-border/60 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Enable additional currencies</p>
                    <p className="text-xs text-muted-foreground">Pick the currencies allowed for future multi-currency documents.</p>
                  </div>
                  <Switch checked={settingsState.currency.multiCurrencyEnabled} onCheckedChange={(checked) => updateSection("currency", { multiCurrencyEnabled: checked })} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {CURRENCY_OPTIONS.map((currencyCode) => {
                    const checked = settingsState.currency.enabledCurrencies.includes(currencyCode);
                    return (
                      <label key={currencyCode} className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => {
                            const nextEnabled = value
                              ? Array.from(new Set([...settingsState.currency.enabledCurrencies, currencyCode]))
                              : settingsState.currency.enabledCurrencies.filter((item) => item !== currencyCode);
                            updateSection("currency", { enabledCurrencies: nextEnabled });
                          }}
                        />
                        <span>{currencyCode}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label>Exchange-rate source</Label>
                <Select value={settingsState.currency.exchangeRateSource} onValueChange={(value) => updateSection("currency", { exchangeRateSource: value as CurrencySettings["exchangeRateSource"] })}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="bank_of_thailand">Bank of Thailand shell</SelectItem>
                    <SelectItem value="custom">Custom source shell</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <Card className="card-premium p-5">
                <h3 className="font-display font-semibold">Manual rates</h3>
                <div className="mt-4 space-y-3">
                  {Object.entries(settingsState.currency.manualRates).map(([code, rate]) => (
                    <div key={code} className="flex items-center gap-3">
                      <div className="w-14 rounded-lg bg-secondary px-3 py-2 text-center text-sm font-semibold">{code}</div>
                      <Input
                        type="number"
                        value={rate}
                        onChange={(event) =>
                          updateNestedSection("currency", "manualRates", {
                            [code]: Number(event.target.value || 0),
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="card-premium p-5">
                <h3 className="font-display font-semibold">Document snapshot object</h3>
                <div className="mt-4 space-y-4">
                  <div className="flex items-center justify-between rounded-xl border border-border/60 p-4">
                    <div>
                      <p className="text-sm font-semibold">Use document date for snapshots</p>
                      <p className="text-xs text-muted-foreground">Applies when creating new foreign-currency documents.</p>
                    </div>
                    <Switch checked={settingsState.currency.documentSnapshot.useDocumentDate} onCheckedChange={(checked) => updateNestedSection("currency", "documentSnapshot", { useDocumentDate: checked })} />
                  </div>
                  <div>
                    <Label htmlFor="currency-fallback-rate">Fallback rate</Label>
                    <Input id="currency-fallback-rate" type="number" value={settingsState.currency.documentSnapshot.fallbackRate} onChange={(event) => updateNestedSection("currency", "documentSnapshot", { fallbackRate: Number(event.target.value || 0) })} className="mt-1.5" />
                  </div>
                  <div>
                    <Label htmlFor="currency-snapshot-note">Snapshot note</Label>
                    <Textarea id="currency-snapshot-note" value={settingsState.currency.documentSnapshot.note} onChange={(event) => updateNestedSection("currency", "documentSnapshot", { note: event.target.value })} className="mt-1.5 min-h-[84px]" />
                  </div>
                </div>
              </Card>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <AppShell>
      <PageHeader
        title={
          activeManagedSection === "documents"
            ? documentText.title
            : activeManagedSection === "users"
              ? usersText.title
              : "Settings"
        }
        description={
          activeManagedSection === "documents"
            ? documentText.description
            : activeManagedSection === "users"
              ? usersText.description
            : "Configure your company, team, document settings, and currency."
        }
        breadcrumbs={[
          { label: "Settings" },
          {
            label:
              activeManagedSection === "documents"
                ? documentText.title
                : activeManagedSection === "users"
                  ? usersText.title
                  : activeLabel,
          },
        ]}
      />

      <Card className="card-premium p-6">
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading settings...</div>
          ) : (
            <>
              {renderManagedSection()}
              {activeManagedSection ? (
                <div className="mt-6 flex justify-end gap-2">
                  <Button variant="outline" onClick={handleCancel} disabled={!isDirty || saving}>
                    {activeManagedSection === "company"
                      ? companyText.cancel
                      : activeManagedSection === "documents"
                        ? documentText.cancel
                        : activeManagedSection === "users"
                          ? usersText.cancel
                        : "Cancel"}
                  </Button>
                  <Button
                    className="gap-1.5 border-0 bg-gradient-brand text-primary-foreground shadow-brand"
                    onClick={() => void handleSave()}
                    disabled={!isDirty || saving || (activeManagedSection === "users" && !canManageUsers)}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {activeManagedSection === "company"
                      ? companyText.save
                      : activeManagedSection === "documents"
                        ? documentText.save
                        : activeManagedSection === "users"
                          ? usersText.saveChanges
                        : "Save changes"}
                  </Button>
                </div>
              ) : null}
            </>
          )}
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[min(1100px,calc(100vw-2rem))] p-0">
          <DialogHeader className="border-b border-border/60 px-5 py-4">
            <DialogTitle>{previewTitle}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[80vh] overflow-auto bg-slate-100 p-4">
            <SalesDocumentTemplate data={previewDocumentData} />
          </div>
        </DialogContent>
      </Dialog>

      <UserAccessModal kind="invite_user" open={inviteOpen} onOpenChange={setInviteOpen} onInvite={handleInviteUser} />
    </AppShell>
  );
};

const DocumentSettingsGroup = ({
  title,
  helper,
  highlighted = false,
  children,
}: {
  title: string;
  helper: string;
  highlighted?: boolean;
  children: ReactNode;
}) => (
  <section
    className={cn(
      "overflow-hidden rounded-2xl border bg-card shadow-sm",
      highlighted ? "border-teal-200 bg-teal-50/30" : "border-border/60"
    )}
  >
    <div className={cn("px-5 py-4", highlighted && "bg-teal-50/60")}>
      <div className="flex items-center gap-2">
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        <HelpHint content={helper} />
      </div>
    </div>
    <div className="border-t border-border/60 bg-card">{children}</div>
  </section>
);

const DocumentSettingRow = ({
  title,
  description,
  options,
  value,
  onChange,
  disabled = false,
  helper,
  isLast = false,
}: {
  title: string;
  description: string;
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  helper?: string;
  isLast?: boolean;
}) => (
  <div className={cn("grid gap-4 p-5 md:grid-cols-[1fr_360px] md:items-center", !isLast && "border-b border-border/60")}>
    <div>
      <div className="flex items-center gap-2">
        <h3 className="font-medium text-foreground">{title}</h3>
        <HelpHint content={description} />
      </div>
      {helper ? <p className="mt-2 text-xs font-medium text-amber-700">{helper}</p> : null}
    </div>
    <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
      {options.map((option) => {
        const checked = value === option.value;
        return (
          <label
            key={option.value}
            className={cn(
              "flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition",
              checked
                ? "border-primary bg-primary/5 font-medium text-foreground shadow-sm"
                : "border-border/60 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
              disabled && "cursor-not-allowed opacity-55 hover:border-border/60 hover:text-muted-foreground"
            )}
          >
            <input
              type="radio"
              checked={checked}
              disabled={disabled}
              onChange={() => !disabled && onChange(option.value)}
              className="h-4 w-4 accent-primary"
            />
            <span>{option.label}</span>
          </label>
        );
      })}
    </div>
  </div>
);

const DocumentColorSelector = ({
  value,
  labels,
  onChange,
}: {
  value: string;
  labels: ColorSelectorCopy;
  onChange: (value: string) => void;
}) => {
  const normalizedValue = BRANDING_COLOR_PRESETS.some((color) => color.hex === value.toUpperCase())
    ? value.toUpperCase()
    : emptyBrandingSettings.accentColor.toUpperCase();
  const selectedColor = BRANDING_COLOR_PRESETS.find((color) => color.hex === normalizedValue) ?? BRANDING_COLOR_PRESETS[0];

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-end">
      <div>
        <Label>{labels.presetColors}</Label>
        <Select value={selectedColor.hex} onValueChange={onChange}>
          <SelectTrigger className="mt-1.5 h-11" aria-label={labels.selectColor}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BRANDING_COLOR_PRESETS.map((color) => (
              <SelectItem key={color.hex} value={color.hex}>
                <span className="inline-flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ backgroundColor: color.hex }} />
                  <span>{color.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{color.hex}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
        <div className="rounded-xl border border-border/60 bg-background p-3">
          <p className="text-xs font-medium text-muted-foreground">{labels.selectedColor}</p>
          <div className="mt-2 flex items-center gap-3">
            <span
              className="h-10 w-10 rounded-full border border-black/10"
              style={{ backgroundColor: normalizedValue }}
            />
            <span className="font-mono text-sm font-semibold">{normalizedValue}</span>
          </div>
        </div>
    </div>
  );
};

const DocumentPreviewPanel = ({
  document,
  title,
  description,
  onOpen,
}: {
  document: SalesDocumentTemplateData;
  title: string;
  description: string;
  onOpen: () => void;
}) => (
  <Card className="card-premium overflow-hidden p-5">
    <div className="mb-4">
      <h3 className="font-display font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
    <button
      type="button"
      className="group relative block w-full cursor-zoom-in overflow-hidden rounded-xl border border-border/60 bg-slate-100 p-3 text-left outline-none transition hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onOpen}
      aria-label={title}
    >
      <div className="mx-auto h-[450px] w-[282px] overflow-hidden rounded-lg bg-white shadow-sm">
        <div className="pointer-events-none origin-top-left scale-[0.36] select-none">
          <SalesDocumentTemplate data={document} />
        </div>
      </div>
      <span className="pointer-events-none absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-primary opacity-0 shadow-sm transition group-hover:opacity-100 group-focus-visible:opacity-100">
        <ZoomIn className="h-4 w-4" aria-hidden="true" />
      </span>
    </button>
  </Card>
);

const BrandingAssetUpload = ({
  assetKey,
  label,
  currentUrl,
  uploading,
  uploadText,
  uploadedText,
  emptyText,
  onUpload,
}: {
  assetKey: "logo" | "signature";
  label: string;
  currentUrl?: string;
  uploading: boolean;
  uploadText: string;
  uploadedText: string;
  emptyText: string;
  onUpload: (assetKey: "logo" | "signature", file?: File) => void;
}) => (
  <div className="rounded-xl border border-border/60 p-4">
    <div className="flex flex-col gap-4">
      <div className="flex min-h-[58px] items-center gap-3 rounded-lg bg-secondary/30 p-3">
        <div
          className={cn(
            "flex flex-none items-center justify-center rounded-md border border-border/60 bg-background",
            assetKey === "signature" ? "h-12 w-24" : "h-12 w-[72px]"
          )}
        >
          {currentUrl ? (
            <img
              src={resolveDocumentAssetUrl(currentUrl)}
              alt={label}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="h-6 w-6 rounded border border-dashed border-muted-foreground/40" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{label}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{currentUrl ? uploadedText : emptyText}</p>
        </div>
      </div>
      <div className="flex justify-end">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploadText}
          <input
            type="file"
            className="hidden"
            accept="image/*"
            onChange={(event) => onUpload(assetKey, event.target.files?.[0])}
          />
        </label>
      </div>
    </div>
  </div>
);

export default Settings;

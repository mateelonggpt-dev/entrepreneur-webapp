from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .enums import (
    AccountingEventType,
    DocumentStatus,
    DocumentType,
    FinancialAccountType,
    NumberingMode,
    PaymentMethod,
    PaymentStatus,
    StockAdjustmentType,
    TaxMode,
)


@dataclass(frozen=True)
class Contact:
    id: str
    name: str
    email: str = ""
    phone: str = ""
    tax_id: str = ""
    address: str = ""
    contact_person: str = ""


@dataclass(frozen=True)
class Customer(Contact):
    balance: float = 0.0
    status: DocumentStatus = DocumentStatus.ACTIVE


@dataclass(frozen=True)
class Vendor(Contact):
    balance: float = 0.0
    status: DocumentStatus = DocumentStatus.ACTIVE


@dataclass(frozen=True)
class Product:
    sku: str
    name: str
    product_type: str
    price: float
    stock: int | None = None
    status: DocumentStatus = DocumentStatus.ACTIVE


@dataclass(frozen=True)
class InventoryItem:
    sku: str
    on_hand: int
    reserved: int = 0
    available: int = 0
    adjustment_type: StockAdjustmentType = StockAdjustmentType.MANUAL


@dataclass(frozen=True)
class FinancialAccount:
    name: str
    number: str
    balance: float
    account_type: FinancialAccountType = FinancialAccountType.BANK
    primary: bool = False


@dataclass(frozen=True)
class Project:
    id: str
    name: str
    code: str = ""
    status: str = "active"


@dataclass(frozen=True)
class Currency:
    code: str
    exchange_rate: float = 1.0
    base: bool = False
    snapshot_date: str = ""


@dataclass(frozen=True)
class DocumentLine:
    id: str
    desc: str
    qty: float
    price: float
    tax: float = 0.0
    vat_rate: float = 0.0
    vat_amount: float = 0.0
    withholding_rate: float = 0.0
    withholding_amount: float = 0.0
    discount: float = 0.0
    discount_mode: TaxMode = TaxMode.EXCLUSIVE
    amount: float = 0.0


@dataclass(frozen=True)
class TaxRateGroup:
    rate: float
    taxable_base: float
    tax_amount: float


@dataclass(frozen=True)
class SalesDocument:
    id: str
    document_type: DocumentType
    status: DocumentStatus
    customer: str
    date: str
    currency: str
    amount: float
    subtotal: float = 0.0
    tax_amount: float = 0.0
    due: str = ""
    reference: str = ""
    payment_terms: str = ""
    notes: str = ""
    lines: tuple[DocumentLine, ...] = ()


@dataclass(frozen=True)
class PurchaseDocument:
    id: str
    document_type: DocumentType
    status: DocumentStatus
    vendor: str
    date: str
    currency: str
    amount: float
    subtotal: float = 0.0
    tax_amount: float = 0.0
    due: str = ""
    reference: str = ""
    payment_terms: str = ""
    notes: str = ""
    lines: tuple[DocumentLine, ...] = ()


@dataclass(frozen=True)
class Payment:
    id: str
    payment_method: PaymentMethod
    payment_status: PaymentStatus
    amount: float
    currency: str
    payment_date: str
    source_document_id: str = ""
    source_document_type: DocumentType | None = None
    cheque_date: str = ""


@dataclass(frozen=True)
class WithholdingTaxDocument:
    id: str
    rate: float
    amount: float
    source_document_id: str
    filing_period: str = ""


@dataclass(frozen=True)
class JournalLine:
    account: str
    side: str
    amount: float


@dataclass(frozen=True)
class JournalEntry:
    id: str
    date: str
    source_type: str
    source_id: str
    description: str
    currency: str
    amount: float
    lines: tuple[JournalLine, ...]


@dataclass(frozen=True)
class Attachment:
    id: str
    entity_type: str
    entity_id: str
    name: str
    category: str
    content_type: str
    size_bytes: int
    relative_path: str


@dataclass(frozen=True)
class TimelineEvent:
    who: str
    what: str
    event_type: str
    time: str
    amount: float | None = None


@dataclass(frozen=True)
class AmountSummary:
    subtotal: float
    discount_amount: float
    tax_amount: float
    withholding_amount: float
    total: float
    total_withholding_tax: float = 0.0
    grand_total: float = 0.0
    remaining_due: float = 0.0
    vat_groups: tuple[TaxRateGroup, ...] = ()
    withholding_groups: tuple[TaxRateGroup, ...] = ()


@dataclass(frozen=True)
class TaxSummary:
    mode: TaxMode
    rate: float
    taxable_base: float
    tax_amount: float
    withholding_rate: float = 0.0
    withholding_amount: float = 0.0


@dataclass(frozen=True)
class AccountingEvent:
    source_document_id: str
    source_type: DocumentType
    event_type: AccountingEventType
    event_date: str
    amount_summary: AmountSummary
    tax_summary: TaxSummary
    linked_project_id: str = ""
    linked_contact_id: str = ""
    linked_account_id: str = ""
    linked_document_ids: tuple[str, ...] = ()
    journal_payload: tuple[dict[str, Any], ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class NumberingPolicy:
    mode: NumberingMode
    prefix: str
    start_at: int

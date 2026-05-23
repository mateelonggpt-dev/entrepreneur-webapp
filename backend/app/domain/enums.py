from __future__ import annotations

from enum import Enum


class DocumentType(str, Enum):
    QUOTATION = "quotation"
    INVOICE = "invoice"
    RECEIPT = "receipt"
    BILLING = "billing"
    CREDIT_NOTE = "credit_note"
    DEBIT_NOTE = "debit_note"
    DEPOSIT = "deposit"
    PURCHASE_ORDER = "purchase_order"
    RECEIVE = "receive"
    EXPENSE = "expense"
    WITHHOLDING_TAX = "withholding_tax"


class DocumentStatus(str, Enum):
    ACTIVE = "active"
    APPROVED = "approved"
    BILLED = "billed"
    CANCELLED = "cancelled"
    DRAFT = "draft"
    INACTIVE = "inactive"
    INVOICED = "invoiced"
    OVERDUE = "overdue"
    PAID = "paid"
    PARTIAL = "partial"
    PENDING_BILL = "pending_bill"
    PENDING = "pending"
    REJECTED = "rejected"
    SENT = "sent"
    VOID = "void"


class PaymentMethod(str, Enum):
    BANK_TRANSFER = "Bank transfer"
    CASH = "Cash"
    PETTY_CASH = "Petty Cash"
    CHEQUE = "Cheque"
    CREDIT_CARD = "Credit Card"
    CARD = "Card"
    PROMPTPAY = "PromptPay"


class PaymentStatus(str, Enum):
    UNPAID = "unpaid"
    PARTIAL = "partial"
    PAID = "paid"
    OVERDUE = "overdue"
    REFUNDED = "refunded"
    VOID = "void"


class FinancialAccountType(str, Enum):
    BANK = "bank"
    PETTY_CASH = "petty_cash"
    CHEQUE_PAYABLE = "cheque_payable"
    CREDIT_CARD_PAYABLE = "credit_card_payable"
    PAYMENT_GATEWAY = "payment_gateway"


class StockAdjustmentType(str, Enum):
    SALE = "sale"
    PURCHASE = "purchase"
    RETURN = "return"
    WRITE_OFF = "write_off"
    MANUAL = "manual"
    TRANSFER = "transfer"


class TaxMode(str, Enum):
    EXCLUSIVE = "exclusive"
    INCLUSIVE = "inclusive"
    EXEMPT = "exempt"


class NumberingMode(str, Enum):
    CONTINUOUS = "continuous"
    YEAR_MONTH_RESET = "year_month_reset"
    YEARLY_RESET = "yearly_reset"


class AccountingEventType(str, Enum):
    DOCUMENT_ISSUED = "document_issued"
    PAYMENT_RECORDED = "payment_recorded"
    EXPENSE_APPROVED = "expense_approved"
    RECEIVE_CAPTURED = "receive_captured"
    STATUS_CHANGED = "status_changed"

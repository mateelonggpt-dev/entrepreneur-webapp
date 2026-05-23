from __future__ import annotations

from collections import defaultdict
from typing import Any


def build_linked_document_graph(data: dict[str, Any]) -> dict[str, list[str]]:
    graph: dict[str, list[str]] = defaultdict(list)

    def link(from_id: str | None, to_id: str | None) -> None:
        if not from_id or not to_id:
            return
        graph[from_id].append(to_id)
        graph[to_id].append(from_id)

    collections = (
        "invoices",
        "quotations",
        "receipts",
        "billings",
        "creditNotes",
        "debitNotes",
        "deposits",
        "purchaseOrders",
        "receives",
        "expenses",
        "withholdingTaxDocuments",
    )

    for collection_name in collections:
        for record in data.get(collection_name, []):
            record_id = record.get("id")
            link(record_id, record.get("relatedInvoice"))
            link(record_id, record.get("relatedDocument"))
            link(record_id, record.get("relatedBilling"))
            link(record_id, record.get("sourceDocumentId"))
            link(record_id, record.get("sourceBillingId"))
            link(record_id, record.get("parentQuotationId"))
            link(record_id, record.get("installmentSourceId"))
            link(record_id, record.get("relatedExpenseId"))
            link(record_id, record.get("relatedPaymentId"))

            for linked_id in record.get("linkedDocumentIds", []) or []:
                link(record_id, linked_id)

            for related_id in record.get("relatedDocumentIds", []) or []:
                link(record_id, related_id)

            for source_invoice_id in record.get("sourceInvoiceIds", []) or []:
                link(record_id, source_invoice_id)

            for reference in record.get("referenceDocuments", []) or []:
                if isinstance(reference, dict):
                    link(record_id, reference.get("id"))

    for payment in data.get("payments", []):
        payment_id = payment.get("id")
        for source_id in payment.get("sourceDocumentIds", []) or []:
            link(payment_id, source_id)
        for allocation in payment.get("allocations", []) or []:
            link(payment_id, allocation.get("documentId"))
        link(payment_id, payment.get("withholdingTaxId"))

    for attachment in data.get("attachments", []):
        entity_id = attachment.get("entityId")
        attachment_id = attachment.get("id")
        if entity_id and attachment_id:
            graph[entity_id].append(attachment_id)

    return {key: sorted(set(values)) for key, values in graph.items()}

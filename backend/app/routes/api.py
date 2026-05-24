from flask import Blueprint, abort, jsonify, request, send_file, session
from flask_login import current_user

from ..services.data_service import (
    adjust_inventory_stock,
    approve_expense,
    attach_files,
    build_import_template,
    build_report_export,
    build_attachment_download,
    build_document_pdf,
    build_preview_document_pdf,
    build_preview_image_pdf,
    build_expense_receipt,
    build_resource_export,
    build_withholding_tax_download,
    can_manage_users,
    create_document,
    create_customer,
    create_expense,
    create_finance_account,
    create_finance_movement,
    create_payment,
    create_project,
    create_product,
    create_vendor,
    create_withholding_tax_document,
    convert_document,
    delete_attachment,
    delete_project,
    confirm_import,
    get_accounting_overview,
    get_branding_asset,
    get_document,
    get_document_next_actions,
    get_document_workflow_rules,
    get_bootstrap_data,
    get_company_settings,
    get_expense,
    get_invoice,
    list_payables,
    list_payments,
    list_withholding_tax_documents,
    get_report_data,
    get_settings_section,
    list_attachments,
    list_customers,
    list_vendors,
    list_document_summaries,
    list_expenses,
    list_finance_accounts,
    list_finance_account_movements,
    list_inventory_movements,
    list_inventory_snapshot,
    list_invoices,
    list_journal_entries,
    list_projects,
    list_products,
    list_reports,
    preview_import,
    save_settings_section,
    save_company_settings,
    save_branding_asset,
    send_payment_reminders,
    send_invoice,
    update_customer,
    update_expense,
    update_finance_account,
    update_payment,
    update_project,
    update_product,
    update_vendor,
    link_document_records,
    override_workflow_warning,
    validate_document_flow,
)
from ..services.payroll_service import (
    build_payroll_export,
    create_payroll_run,
    get_payroll_settings,
    list_employees,
    list_payroll_runs,
    save_employee,
    save_payroll_settings,
)
from ..services.support_service import (
    request_password_reset,
    reset_password,
    submit_support_request,
)
from ..services.auth_service import (
    clear_auth_session,
    create_auth_session,
    get_auth_session,
)
from ..services.onboarding_service import (
    complete_onboarding,
    get_onboarding_state,
    save_onboarding_draft,
)
from ..services.tax_service import (
    build_tax_filing_download,
    create_tax_filing,
    get_tax_overview,
    list_tax_filings,
)

api_blueprint = Blueprint("api", __name__)


@api_blueprint.get("/health")
def health_check():
    return jsonify({"status": "ok"})


@api_blueprint.get("/auth/session")
def auth_session():
    return jsonify(get_auth_session(session))


@api_blueprint.post("/auth/session")
def auth_session_create():
    payload = request.get_json(silent=True) or {}
    return jsonify(create_auth_session(session, payload)), 201


@api_blueprint.delete("/auth/session")
def auth_session_delete():
    return jsonify(clear_auth_session(session))


@api_blueprint.get("/bootstrap")
def bootstrap():
    return jsonify(get_bootstrap_data())


@api_blueprint.get("/onboarding/draft")
def onboarding_draft():
    return jsonify(get_onboarding_state())


@api_blueprint.put("/onboarding/draft")
def save_onboarding_draft_endpoint():
    payload = request.get_json(silent=True) or {}
    return jsonify(save_onboarding_draft(payload))


@api_blueprint.post("/onboarding/complete")
def complete_onboarding_endpoint():
    payload = request.get_json(silent=True) or {}
    return jsonify(complete_onboarding(payload))


@api_blueprint.get("/accounting/overview")
def accounting_overview():
    return jsonify(get_accounting_overview())


@api_blueprint.get("/accounting/journal")
def accounting_journal():
    return jsonify(list_journal_entries())


@api_blueprint.get("/invoices")
def invoices():
    return jsonify(list_invoices())


@api_blueprint.get("/invoices/<invoice_id>")
def invoice_detail(invoice_id: str):
    invoice = get_invoice(invoice_id)
    if not invoice:
        abort(404, description="Invoice not found.")
    return jsonify(invoice)


@api_blueprint.get("/expenses")
def expenses():
    return jsonify(list_expenses())


@api_blueprint.post("/expenses")
def create_expense_endpoint():
    payload = request.get_json(silent=True) or {}
    return jsonify(create_expense(payload)), 201


@api_blueprint.get("/expenses/<expense_id>")
def expense_detail(expense_id: str):
    expense = get_expense(expense_id)
    if not expense:
        abort(404, description="Expense not found.")
    return jsonify(expense)


@api_blueprint.put("/expenses/<expense_id>")
def update_expense_endpoint(expense_id: str):
    payload = request.get_json(silent=True) or {}
    try:
        expense = update_expense(expense_id, payload)
    except ValueError as exc:
        abort(400, description=str(exc))
    if not expense:
        abort(404, description="Expense not found.")
    return jsonify(expense)


@api_blueprint.post("/invoices/<invoice_id>/send")
def send_invoice_to_customer(invoice_id: str):
    invoice = send_invoice(invoice_id)
    if not invoice:
        abort(404, description="Invoice not found.")
    return jsonify(invoice)


@api_blueprint.post("/invoices/reminders")
def invoice_reminders():
    return jsonify(send_payment_reminders())


@api_blueprint.get("/customers")
def customers():
    return jsonify(list_customers())


@api_blueprint.post("/customers")
def create_customer_endpoint():
    payload = request.get_json(silent=True) or {}
    return jsonify(create_customer(payload)), 201


@api_blueprint.put("/customers/<customer_id>")
def update_customer_endpoint(customer_id: str):
    payload = request.get_json(silent=True) or {}
    customer = update_customer(customer_id, payload)
    if not customer:
        abort(404, description="Customer not found.")
    return jsonify(customer)


@api_blueprint.get("/vendors")
def vendors():
    return jsonify(list_vendors())


@api_blueprint.post("/vendors")
def create_vendor_endpoint():
    payload = request.get_json(silent=True) or {}
    return jsonify(create_vendor(payload)), 201


@api_blueprint.put("/vendors/<vendor_id>")
def update_vendor_endpoint(vendor_id: str):
    payload = request.get_json(silent=True) or {}
    vendor = update_vendor(vendor_id, payload)
    if not vendor:
        abort(404, description="Vendor not found.")
    return jsonify(vendor)


@api_blueprint.get("/products")
def products():
    return jsonify(list_products())


@api_blueprint.post("/products")
def create_product_endpoint():
    payload = request.get_json(silent=True) or {}
    try:
        return jsonify(create_product(payload)), 201
    except ValueError as exc:
        abort(400, description=str(exc))


@api_blueprint.put("/products/<sku>")
def update_product_endpoint(sku: str):
    payload = request.get_json(silent=True) or {}
    try:
        product = update_product(sku, payload)
    except ValueError as exc:
        abort(400, description=str(exc))
    if not product:
        abort(404, description="Product not found.")
    return jsonify(product)


@api_blueprint.get("/inventory")
def inventory_snapshot():
    return jsonify(list_inventory_snapshot())


@api_blueprint.get("/inventory/movements")
def inventory_movements():
    sku = request.args.get("sku", "").strip() or None
    return jsonify(list_inventory_movements(sku))


@api_blueprint.post("/inventory/adjustments")
def inventory_adjustment():
    payload = request.get_json(silent=True) or {}
    try:
        return jsonify(adjust_inventory_stock(payload)), 201
    except ValueError as exc:
        abort(400, description=str(exc))


@api_blueprint.get("/import/templates/<mode>")
def import_template(mode: str):
    try:
        payload = build_import_template(mode)
    except ValueError as exc:
        abort(404, description=str(exc))
    return send_file(payload["path"], as_attachment=True, download_name=payload["download_name"], mimetype=payload["mimetype"])


@api_blueprint.post("/import/preview")
def import_preview():
    mode = request.form.get("mode", "").strip()
    file = request.files.get("file")
    if not mode:
        abort(400, description="mode is required.")
    if not file:
        abort(400, description="file is required.")
    try:
        return jsonify(preview_import(mode, file))
    except ValueError as exc:
        abort(400, description=str(exc))


@api_blueprint.post("/import/confirm")
def import_confirm():
    payload = request.get_json(silent=True) or {}
    mode = str(payload.get("mode", "")).strip()
    rows = payload.get("rows", [])
    if not mode:
        abort(400, description="mode is required.")
    if not isinstance(rows, list):
        abort(400, description="rows must be an array.")
    try:
        return jsonify(confirm_import(mode, rows)), 201
    except ValueError as exc:
        abort(400, description=str(exc))


@api_blueprint.get("/finance/accounts")
def finance_accounts():
    return jsonify(list_finance_accounts())


@api_blueprint.post("/finance/accounts")
def create_finance_account_endpoint():
    payload = request.get_json(silent=True) or {}
    return jsonify(create_finance_account(payload)), 201


@api_blueprint.put("/finance/accounts/<path:account_number>")
def update_finance_account_endpoint(account_number: str):
    payload = request.get_json(silent=True) or {}
    account = update_finance_account(account_number, payload)
    if not account:
        abort(404, description="Finance account not found.")
    return jsonify(account)


@api_blueprint.get("/finance/movements")
def finance_movements():
    account_number = request.args.get("accountNumber", "").strip() or None
    return jsonify(list_finance_account_movements(account_number))


@api_blueprint.post("/finance/movements")
def create_finance_movement_endpoint():
    payload = request.get_json(silent=True) or {}
    try:
        return jsonify(create_finance_movement(payload)), 201
    except ValueError as exc:
        abort(400, description=str(exc))


@api_blueprint.get("/projects")
def projects():
    return jsonify(list_projects())


@api_blueprint.post("/projects")
def create_project_endpoint():
    payload = request.get_json(silent=True) or {}
    try:
        return jsonify(create_project(payload)), 201
    except ValueError as exc:
        abort(400, description=str(exc))


@api_blueprint.put("/projects/<project_id>")
def update_project_endpoint(project_id: str):
    payload = request.get_json(silent=True) or {}
    try:
        project = update_project(project_id, payload)
    except ValueError as exc:
        abort(400, description=str(exc))
    if not project:
        abort(404, description="Project not found.")
    return jsonify(project)


@api_blueprint.delete("/projects/<project_id>")
def delete_project_endpoint(project_id: str):
    try:
        deleted = delete_project(project_id)
    except ValueError as exc:
        abort(400, description=str(exc))
    if not deleted:
        abort(404, description="Project not found.")
    return jsonify({"ok": True})


@api_blueprint.get("/reports")
def reports():
    return jsonify(list_reports())


@api_blueprint.get("/reports/<report_key>")
def report_detail(report_key: str):
    try:
        rows = get_report_data(report_key)
    except ValueError as exc:
        abort(404, description=str(exc))
    return jsonify({"key": report_key, "rows": rows})


@api_blueprint.get("/reports/<report_key>/download")
def report_download(report_key: str):
    payload = build_report_export(report_key)
    if not payload:
        abort(404, description="Report not found.")
    return send_file(payload["path"], as_attachment=True, download_name=payload["download_name"], mimetype=payload["mimetype"])


@api_blueprint.get("/tax/overview")
def tax_overview():
    return jsonify(get_tax_overview())


@api_blueprint.get("/tax/filings")
def tax_filings():
    return jsonify(list_tax_filings())


@api_blueprint.post("/tax/filings")
def create_tax_filing_endpoint():
    payload = request.get_json(silent=True) or {}
    try:
        return jsonify(create_tax_filing(payload)), 201
    except ValueError as exc:
        abort(400, description=str(exc))


@api_blueprint.get("/tax/filings/<filing_id>/download")
def download_tax_filing(filing_id: str):
    payload = build_tax_filing_download(filing_id)
    if not payload:
        abort(404, description="Tax filing not found.")
    return send_file(payload["path"], as_attachment=True, download_name=payload["download_name"], mimetype=payload["mimetype"])


@api_blueprint.get("/settings/company")
def company_settings():
    return jsonify(get_company_settings())


@api_blueprint.put("/settings/company")
def save_company_settings_endpoint():
    payload = request.get_json(silent=True) or {}
    return jsonify(save_company_settings(payload))


@api_blueprint.get("/settings/<section>")
def settings_section_detail(section: str):
    if section == "company":
        return jsonify(get_company_settings())
    try:
        return jsonify(get_settings_section(section))
    except ValueError as exc:
        abort(404, description=str(exc))


@api_blueprint.put("/settings/<section>")
def save_settings_section_endpoint(section: str):
    payload = request.get_json(silent=True) or {}
    if section == "company":
        return jsonify(save_company_settings(payload))
    if section == "users":
        current_email = getattr(current_user, "email", None) if getattr(current_user, "is_authenticated", False) else None
        current_email = current_email or (session.get("auth_user") or {}).get("email")
        if not can_manage_users(current_email):
            abort(403, description="Only owners can manage users and permissions.")
    try:
        return jsonify(save_settings_section(section, payload))
    except ValueError as exc:
        abort(404, description=str(exc))


@api_blueprint.post("/settings/branding/assets/<asset_key>")
def upload_branding_asset_endpoint(asset_key: str):
    file = request.files.get("file")
    if not file:
        abort(400, description="file is required.")
    try:
        return jsonify(save_branding_asset(asset_key, file)), 201
    except ValueError as exc:
        abort(404, description=str(exc))


@api_blueprint.get("/settings/branding/assets/<asset_key>")
def branding_asset_endpoint(asset_key: str):
    try:
        payload = get_branding_asset(asset_key)
    except ValueError as exc:
        abort(404, description=str(exc))
    if not payload:
        abort(404, description="Branding asset not found.")
    return send_file(payload["path"], mimetype=payload["mimetype"])


@api_blueprint.get("/payroll/settings")
def payroll_settings():
    return jsonify(get_payroll_settings())


@api_blueprint.put("/payroll/settings")
def save_payroll_settings_endpoint():
    payload = request.get_json(silent=True) or {}
    try:
        return jsonify(save_payroll_settings(payload))
    except ValueError as exc:
        abort(400, description=str(exc))


@api_blueprint.get("/payroll/employees")
def payroll_employees():
    return jsonify(list_employees())


@api_blueprint.post("/payroll/employees")
def save_employee_endpoint():
    payload = request.get_json(silent=True) or {}
    try:
        return jsonify(save_employee(payload)), 201
    except ValueError as exc:
        abort(400, description=str(exc))


@api_blueprint.get("/payroll/runs")
def payroll_runs():
    return jsonify(list_payroll_runs())


@api_blueprint.post("/payroll/runs")
def create_payroll_run_endpoint():
    payload = request.get_json(silent=True) or {}
    try:
        return jsonify(create_payroll_run(payload)), 201
    except ValueError as exc:
        abort(400, description=str(exc))


@api_blueprint.get("/payroll/runs/<run_id>/download")
def download_payroll_run(run_id: str):
    payload = build_payroll_export(run_id)
    if not payload:
        abort(404, description="Payroll run not found.")
    return send_file(payload["path"], as_attachment=True, download_name=payload["download_name"], mimetype=payload["mimetype"])


@api_blueprint.post("/expenses/<expense_id>/approve")
def approve_expense_endpoint(expense_id: str):
    expense = approve_expense(expense_id)
    if not expense:
        abort(404, description="Expense not found.")
    return jsonify(expense)


@api_blueprint.get("/payables")
def payables():
    return jsonify(list_payables())


@api_blueprint.get("/payments")
def payments():
    return jsonify(list_payments())


@api_blueprint.post("/payments")
def create_payment_endpoint():
    payload = request.get_json(silent=True) or {}
    try:
        return jsonify(create_payment(payload)), 201
    except ValueError as exc:
        abort(400, description=str(exc))


@api_blueprint.put("/payments/<payment_id>")
def update_payment_endpoint(payment_id: str):
    payload = request.get_json(silent=True) or {}
    try:
        payment = update_payment(payment_id, payload)
    except ValueError as exc:
        abort(400, description=str(exc))
    if not payment:
        abort(404, description="Payment not found.")
    return jsonify(payment)


@api_blueprint.get("/withholding-tax")
def withholding_tax_documents():
    return jsonify(list_withholding_tax_documents())


@api_blueprint.post("/withholding-tax")
def create_withholding_tax_endpoint():
    payload = request.get_json(silent=True) or {}
    try:
        return jsonify(create_withholding_tax_document(payload)), 201
    except ValueError as exc:
        abort(400, description=str(exc))


@api_blueprint.get("/withholding-tax/<document_id>/download")
def download_withholding_tax(document_id: str):
    payload = build_withholding_tax_download(document_id)
    if not payload:
        abort(404, description="Withholding tax document not found.")
    return send_file(payload["path"], as_attachment=True, download_name=payload["download_name"], mimetype=payload["mimetype"])


@api_blueprint.get("/expenses/<expense_id>/receipt")
def expense_receipt(expense_id: str):
    payload = build_expense_receipt(expense_id)
    if not payload:
        abort(404, description="Expense not found.")
    return send_file(payload["path"], as_attachment=True, download_name=payload["download_name"], mimetype=payload["mimetype"])


@api_blueprint.get("/documents/<kind>")
def documents(kind: str):
    try:
        return jsonify(list_document_summaries(kind))
    except ValueError as exc:
        abort(404, description=str(exc))


@api_blueprint.post("/documents/<kind>")
def create_document_endpoint(kind: str):
    payload = request.get_json(silent=True) or {}
    current_email = getattr(current_user, "email", None) if getattr(current_user, "is_authenticated", False) else None
    current_email = current_email or (session.get("auth_user") or {}).get("email")
    try:
        created = create_document(kind, payload, actor_email=current_email)
    except ValueError as exc:
        abort(400, description=str(exc))
    return jsonify(created), 201


@api_blueprint.get("/document-workflow/rules")
def document_workflow_rules():
    return jsonify(get_document_workflow_rules())


@api_blueprint.post("/documents/<kind>/validate-flow")
def validate_document_flow_endpoint(kind: str):
    payload = request.get_json(silent=True) or {}
    return jsonify(validate_document_flow(kind, payload))


@api_blueprint.get("/documents/<kind>/<document_id>")
def document_detail(kind: str, document_id: str):
    try:
        record = get_document(kind, document_id)
    except ValueError as exc:
        abort(404, description=str(exc))
    if not record:
        abort(404, description="Document not found.")
    return jsonify(record)


@api_blueprint.get("/documents/<kind>/<document_id>/next-actions")
def document_next_actions(kind: str, document_id: str):
    try:
        payload = get_document_next_actions(kind, document_id)
    except ValueError as exc:
        abort(404, description=str(exc))
    if not payload:
        abort(404, description="Document not found.")
    return jsonify(payload)


@api_blueprint.post("/documents/<kind>/<document_id>/convert")
def convert_document_endpoint(kind: str, document_id: str):
    payload = request.get_json(silent=True) or {}
    current_email = getattr(current_user, "email", None) if getattr(current_user, "is_authenticated", False) else None
    current_email = current_email or (session.get("auth_user") or {}).get("email")
    try:
        converted = convert_document(kind, document_id, payload, actor_email=current_email)
    except ValueError as exc:
        abort(400, description=str(exc))
    return jsonify(converted), 201


@api_blueprint.post("/documents/<kind>/<document_id>/link")
def link_document_endpoint(kind: str, document_id: str):
    payload = request.get_json(silent=True) or {}
    try:
        linked = link_document_records(kind, document_id, payload)
    except ValueError as exc:
        abort(400, description=str(exc))
    if not linked:
        abort(404, description="Document not found.")
    return jsonify(linked)


@api_blueprint.post("/documents/<kind>/<document_id>/override-workflow-warning")
def override_workflow_warning_endpoint(kind: str, document_id: str):
    payload = request.get_json(silent=True) or {}
    current_email = getattr(current_user, "email", None) if getattr(current_user, "is_authenticated", False) else None
    current_email = current_email or (session.get("auth_user") or {}).get("email")
    try:
        record = override_workflow_warning(kind, document_id, payload, actor_email=current_email)
    except ValueError as exc:
        abort(400, description=str(exc))
    if not record:
        abort(404, description="Document not found.")
    return jsonify(record)


@api_blueprint.get("/documents/<kind>/<document_id>/pdf")
def document_pdf(kind: str, document_id: str):
    try:
        payload = build_document_pdf(kind, document_id)
    except ValueError as exc:
        abort(404, description=str(exc))
    if not payload:
        abort(404, description="Document not found.")
    return send_file(payload["path"], as_attachment=True, download_name=payload["download_name"], mimetype=payload["mimetype"])


@api_blueprint.post("/documents/<kind>/preview-pdf")
def document_preview_pdf(kind: str):
    payload = request.get_json(silent=True) or {}
    try:
        document = build_preview_document_pdf(kind, payload)
    except ValueError as exc:
        abort(404, description=str(exc))
    return send_file(document["path"], as_attachment=True, download_name=document["download_name"], mimetype=document["mimetype"])


@api_blueprint.post("/documents/preview-image-pdf")
def document_preview_image_pdf():
    payload = request.get_json(silent=True) or {}
    try:
        document = build_preview_image_pdf(payload)
    except ValueError as exc:
        abort(400, description=str(exc))
    return send_file(document["path"], as_attachment=True, download_name=document["download_name"], mimetype=document["mimetype"])


@api_blueprint.get("/exports/<resource>.csv")
def export_resource(resource: str):
    payload = build_resource_export(resource)
    if not payload:
        abort(404, description="Export not found.")
    return send_file(payload["path"], as_attachment=True, download_name=payload["download_name"], mimetype=payload["mimetype"])


@api_blueprint.get("/attachments")
def attachments():
    entity_type = request.args.get("entityType", "").strip()
    entity_id = request.args.get("entityId", "").strip()
    if not entity_type or not entity_id:
        abort(400, description="entityType and entityId are required.")
    return jsonify(list_attachments(entity_type, entity_id))


@api_blueprint.post("/attachments")
def upload_attachments():
    entity_type = request.form.get("entityType", "").strip()
    entity_id = request.form.get("entityId", "").strip()
    category = request.form.get("category", "supporting-document")
    note = request.form.get("note", "")
    attached_by = request.form.get("attachedBy", "System")
    tags = [tag.strip() for tag in request.form.get("tags", "").split(",") if tag.strip()]
    files = request.files.getlist("files")

    if not entity_type or not entity_id:
        abort(400, description="entityType and entityId are required.")
    if not files:
        abort(400, description="At least one file is required.")

    created = attach_files(
        entity_type,
        entity_id,
        files,
        category=category,
        note=note,
        attached_by=attached_by,
        tags=tags,
    )
    return jsonify(created), 201


@api_blueprint.get("/files/<attachment_id>/download")
def download_attachment(attachment_id: str):
    payload = build_attachment_download(attachment_id)
    if not payload:
        abort(404, description="Attachment not found.")
    return send_file(payload["path"], as_attachment=True, download_name=payload["download_name"], mimetype=payload["mimetype"])


@api_blueprint.delete("/attachments/<attachment_id>")
def delete_attachment_endpoint(attachment_id: str):
    deleted = delete_attachment(attachment_id)
    if not deleted:
        abort(404, description="Attachment not found.")
    return jsonify({"ok": True})


@api_blueprint.post("/support/contact")
def submit_contact():
    payload = request.get_json(silent=True) or {}
    try:
        return jsonify(submit_support_request(payload, request_type="contact")), 201
    except ValueError as exc:
        abort(400, description=str(exc))


@api_blueprint.post("/support/demo")
def submit_demo():
    payload = request.get_json(silent=True) or {}
    try:
        return jsonify(submit_support_request(payload, request_type="demo")), 201
    except ValueError as exc:
        abort(400, description=str(exc))


@api_blueprint.post("/auth/forgot-password")
def forgot_password():
    payload = request.get_json(silent=True) or {}
    try:
        return jsonify(request_password_reset(payload)), 201
    except ValueError as exc:
        abort(400, description=str(exc))


@api_blueprint.post("/auth/reset-password")
def reset_password_endpoint():
    payload = request.get_json(silent=True) or {}
    try:
        return jsonify(reset_password(payload))
    except ValueError as exc:
        abort(400, description=str(exc))

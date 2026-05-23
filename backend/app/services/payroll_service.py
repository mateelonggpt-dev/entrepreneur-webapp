from __future__ import annotations

import csv
from copy import deepcopy
from datetime import datetime
from typing import Any

from .data_service import SEED_DATABASE
from .storage_service import (
    build_generated_path,
    clone_seed,
    load_database,
    mutate_database,
    next_counter,
)


DEFAULT_EMPLOYEES = [
    {
        "id": "EMP-001",
        "name": "Pimchanok Sae-Lim",
        "email": "pimchanok@example.com",
        "department": "Finance",
        "position": "Staff Accountant",
        "baseSalary": 32000.0,
        "paymentMethod": "bank_transfer",
        "bankAccountHint": "BBL 123-4-56789-0",
        "status": "active",
    },
    {
        "id": "EMP-002",
        "name": "Narin Kongsiri",
        "email": "narin@example.com",
        "department": "Operations",
        "position": "Operations Lead",
        "baseSalary": 42000.0,
        "paymentMethod": "bank_transfer",
        "bankAccountHint": "SCB 987-6-54321-0",
        "status": "active",
    },
]

DEFAULT_PAYROLL_SETTINGS = {
    "defaultPayDate": "2026-04-30",
    "salaryExpenseAccount": "Payroll Expense",
    "salaryPayableAccount": "Accrued Payroll",
    "withholdingEnabled": True,
    "socialSecurityEnabled": True,
    "socialSecurityRate": 5.0,
    "notes": "Payroll foundation shell for salary setup, payment runs, and payslip exports.",
}


def _seed_database() -> dict[str, Any]:
    return clone_seed(SEED_DATABASE)


def _db() -> dict[str, Any]:
    data = load_database(_seed_database)
    _normalize_database_shape(data)
    return data


def _mutate(mutator):
    def wrapped(data: dict[str, Any]):
        _normalize_database_shape(data)
        return mutator(data)

    return mutate_database(_seed_database, wrapped)


def _normalize_database_shape(data: dict[str, Any]) -> None:
    data.setdefault("employees", deepcopy(DEFAULT_EMPLOYEES))
    data.setdefault("payrollSettings", deepcopy(DEFAULT_PAYROLL_SETTINGS))
    data.setdefault("payrollRuns", [])
    data.setdefault("recentActivity", [])


def _push_activity(data: dict[str, Any], who: str, what: str, kind: str) -> None:
    data.setdefault("recentActivity", []).insert(
        0,
        {
            "who": who,
            "what": what,
            "time": "just now",
            "type": kind,
        },
    )
    data["recentActivity"] = data["recentActivity"][:20]


def list_employees() -> list[dict[str, Any]]:
    return deepcopy(_db().get("employees", []))


def save_employee(payload: dict[str, Any]) -> dict[str, Any]:
    employee_id = str(payload.get("id", "")).strip()
    name = str(payload.get("name", "")).strip()
    email = str(payload.get("email", "")).strip()
    if not name:
        raise ValueError("Employee name is required.")
    if not email:
        raise ValueError("Employee email is required.")

    def mutator(data: dict[str, Any]) -> dict[str, Any]:
        employees = data.setdefault("employees", [])
        existing = next((row for row in employees if row.get("id") == employee_id), None) if employee_id else None
        if existing is None:
            employee_id_value = employee_id or f"EMP-{next_counter(data, 'employee', len(employees) + 1):03d}"
            record = {
                "id": employee_id_value,
                "name": name,
                "email": email,
                "department": str(payload.get("department", "")).strip(),
                "position": str(payload.get("position", "")).strip(),
                "baseSalary": float(payload.get("baseSalary", 0) or 0),
                "paymentMethod": str(payload.get("paymentMethod", "bank_transfer")).strip() or "bank_transfer",
                "bankAccountHint": str(payload.get("bankAccountHint", "")).strip(),
                "status": str(payload.get("status", "active")).strip() or "active",
            }
            employees.insert(0, record)
            _push_activity(data, "Payroll", f"added employee {employee_id_value}", "payroll")
            return deepcopy(record)

        existing.update(
            {
                "name": name,
                "email": email,
                "department": str(payload.get("department", "")).strip(),
                "position": str(payload.get("position", "")).strip(),
                "baseSalary": float(payload.get("baseSalary", 0) or 0),
                "paymentMethod": str(payload.get("paymentMethod", "bank_transfer")).strip() or "bank_transfer",
                "bankAccountHint": str(payload.get("bankAccountHint", "")).strip(),
                "status": str(payload.get("status", "active")).strip() or "active",
            }
        )
        _push_activity(data, "Payroll", f"updated employee {existing.get('id', '')}", "payroll")
        return deepcopy(existing)

    return _mutate(mutator)


def get_payroll_settings() -> dict[str, Any]:
    return deepcopy(_db().get("payrollSettings", deepcopy(DEFAULT_PAYROLL_SETTINGS)))


def save_payroll_settings(payload: dict[str, Any]) -> dict[str, Any]:
    def mutator(data: dict[str, Any]) -> dict[str, Any]:
        current = deepcopy(DEFAULT_PAYROLL_SETTINGS)
        current.update(deepcopy(data.get("payrollSettings", {})))
        current.update(
            {
                "defaultPayDate": str(payload.get("defaultPayDate", current["defaultPayDate"])).strip() or current["defaultPayDate"],
                "salaryExpenseAccount": str(payload.get("salaryExpenseAccount", current["salaryExpenseAccount"])).strip() or current["salaryExpenseAccount"],
                "salaryPayableAccount": str(payload.get("salaryPayableAccount", current["salaryPayableAccount"])).strip() or current["salaryPayableAccount"],
                "withholdingEnabled": bool(payload.get("withholdingEnabled", current["withholdingEnabled"])),
                "socialSecurityEnabled": bool(payload.get("socialSecurityEnabled", current["socialSecurityEnabled"])),
                "socialSecurityRate": float(payload.get("socialSecurityRate", current["socialSecurityRate"]) or 0),
                "notes": str(payload.get("notes", current["notes"])).strip(),
            }
        )
        data["payrollSettings"] = current
        _push_activity(data, "Payroll", "updated payroll settings", "payroll")
        return deepcopy(current)

    return _mutate(mutator)


def list_payroll_runs() -> list[dict[str, Any]]:
    return deepcopy(_db().get("payrollRuns", []))


def create_payroll_run(payload: dict[str, Any]) -> dict[str, Any]:
    period = str(payload.get("period", "")).strip()
    if not period:
        raise ValueError("Payroll period is required.")

    def mutator(data: dict[str, Any]) -> dict[str, Any]:
        employees = [
            row
            for row in data.get("employees", [])
            if row.get("status", "active") == "active"
            and (
                not payload.get("employeeIds")
                or row.get("id") in payload.get("employeeIds", [])
            )
        ]
        if not employees:
            raise ValueError("No active employees selected for payroll.")

        settings = deepcopy(data.get("payrollSettings", DEFAULT_PAYROLL_SETTINGS))
        ss_rate = float(settings.get("socialSecurityRate", 0) or 0) / 100
        lines = []
        gross_total = 0.0
        deduction_total = 0.0
        net_total = 0.0

        for employee in employees:
            gross = round(float(employee.get("baseSalary", 0) or 0), 2)
            social_security = round(gross * ss_rate, 2) if settings.get("socialSecurityEnabled") else 0.0
            withholding = round(gross * 0.03, 2) if settings.get("withholdingEnabled") else 0.0
            net = round(gross - social_security - withholding, 2)
            lines.append(
                {
                    "employeeId": employee.get("id", ""),
                    "employeeName": employee.get("name", ""),
                    "grossPay": gross,
                    "socialSecurity": social_security,
                    "withholdingTax": withholding,
                    "netPay": net,
                }
            )
            gross_total += gross
            deduction_total += social_security + withholding
            net_total += net

        run_id = f"PAYRUN-{period.replace('-', '')}-{next_counter(data, 'payrollRun', len(data.get('payrollRuns', [])) + 1):03d}"
        record = {
            "id": run_id,
            "period": period,
            "status": str(payload.get("status", "draft")).strip() or "draft",
            "payDate": str(payload.get("payDate", settings.get("defaultPayDate", ""))).strip(),
            "notes": str(payload.get("notes", "")).strip(),
            "createdAt": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "employeeCount": len(lines),
            "grossPay": round(gross_total, 2),
            "deductions": round(deduction_total, 2),
            "netPay": round(net_total, 2),
            "lines": lines,
        }
        data.setdefault("payrollRuns", []).insert(0, record)
        _push_activity(data, "Payroll", f"created payroll run {run_id}", "payroll")
        return deepcopy(record)

    return _mutate(mutator)


def build_payroll_export(run_id: str) -> dict[str, Any] | None:
    run = next((row for row in _db().get("payrollRuns", []) if row.get("id") == run_id), None)
    if not run:
        return None

    path = build_generated_path(f"payroll-{run_id}", "csv")
    with path.open("w", newline="", encoding="utf-8") as handle:
        lines = run.get("lines", [])
        fieldnames = ["employeeId", "employeeName", "grossPay", "socialSecurity", "withholdingTax", "netPay"]
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(lines)

    return {
        "path": path,
        "download_name": f"{run_id}.csv",
        "mimetype": "text/csv",
    }

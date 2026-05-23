from __future__ import annotations

from copy import deepcopy
from datetime import datetime
from typing import Any
from uuid import uuid4

from .data_service import SEED_DATABASE
from .storage_service import clone_seed, load_database, mutate_database, next_counter


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
    data.setdefault("supportRequests", [])
    data.setdefault("passwordResetRequests", [])
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


def _timestamp() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def submit_support_request(payload: dict[str, Any], *, request_type: str = "contact") -> dict[str, Any]:
    first_name = str(payload.get("firstName", "")).strip()
    last_name = str(payload.get("lastName", "")).strip()
    email = str(payload.get("email", "")).strip()
    message = str(payload.get("message", "")).strip()

    if not first_name:
        raise ValueError("First name is required.")
    if not email:
        raise ValueError("Email is required.")
    if not message:
        raise ValueError("Message is required.")

    def mutator(data: dict[str, Any]) -> dict[str, Any]:
        request_id = f"SUP-{next_counter(data, 'supportRequest', len(data.get('supportRequests', [])) + 1):04d}"
        record = {
            "id": request_id,
            "type": request_type,
            "firstName": first_name,
            "lastName": last_name,
            "email": email,
            "company": str(payload.get("company", "")).strip(),
            "phone": str(payload.get("phone", "")).strip(),
            "topic": str(payload.get("topic", "")).strip() or ("Book a demo" if request_type == "demo" else "General inquiry"),
            "message": message,
            "status": "new",
            "createdAt": _timestamp(),
        }
        data.setdefault("supportRequests", []).insert(0, record)
        _push_activity(
            data,
            "Support",
            f"logged {request_type.replace('_', ' ')} request {request_id}",
            "support",
        )
        return deepcopy(record)

    return _mutate(mutator)


def request_password_reset(payload: dict[str, Any]) -> dict[str, Any]:
    email = str(payload.get("email", "")).strip()
    if not email:
        raise ValueError("Email is required.")

    def mutator(data: dict[str, Any]) -> dict[str, Any]:
        request_id = f"RST-{next_counter(data, 'passwordReset', len(data.get('passwordResetRequests', [])) + 1):04d}"
        token = f"reset-{uuid4().hex[:10]}"
        record = {
            "id": request_id,
            "email": email,
            "token": token,
            "status": "pending",
            "createdAt": _timestamp(),
        }
        data.setdefault("passwordResetRequests", []).insert(0, record)
        _push_activity(data, "Auth", f"created password reset request for {email}", "auth")
        return {
            "ok": True,
            "supported": True,
            "email": email,
            "resetToken": token,
            "message": "Password reset shell created. Use the token below in this local workspace.",
        }

    return _mutate(mutator)


def reset_password(payload: dict[str, Any]) -> dict[str, Any]:
    token = str(payload.get("token", "")).strip()
    password = str(payload.get("password", "")).strip()

    if not token:
        raise ValueError("Reset token is required.")
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters.")

    def mutator(data: dict[str, Any]) -> dict[str, Any]:
        request_record = next(
            (
                item
                for item in data.get("passwordResetRequests", [])
                if item.get("token") == token and item.get("status") == "pending"
            ),
            None,
        )
        if not request_record:
            raise ValueError("Reset token is invalid or already used.")

        request_record["status"] = "completed"
        request_record["completedAt"] = _timestamp()
        _push_activity(data, "Auth", f"completed password reset for {request_record.get('email', '')}", "auth")
        return {
            "ok": True,
            "supported": True,
            "email": request_record.get("email", ""),
            "message": "Password updated in the local auth shell.",
        }

    return _mutate(mutator)


def list_support_requests() -> list[dict[str, Any]]:
    return deepcopy(_db().get("supportRequests", []))

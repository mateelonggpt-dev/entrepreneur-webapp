from __future__ import annotations

from copy import deepcopy
from typing import Any

from flask_login import current_user, login_user, logout_user

from ..extensions import db
from ..models import User
from .data_service import get_settings_user_by_email


DEFAULT_AUTH_USER = {
    "name": "Somchai Bunnak",
    "email": "somchai@siamtech.co.th",
    "company": "Siam Tech Co., Ltd.",
}


def _normalized_user(payload: dict[str, Any] | None = None) -> dict[str, str]:
    raw = payload or {}
    email = str(raw.get("email") or DEFAULT_AUTH_USER["email"]).strip() or DEFAULT_AUTH_USER["email"]
    name = str(raw.get("name") or DEFAULT_AUTH_USER["name"]).strip() or DEFAULT_AUTH_USER["name"]
    company = str(raw.get("company") or DEFAULT_AUTH_USER["company"]).strip() or DEFAULT_AUTH_USER["company"]
    return {
        "name": name,
        "email": email,
        "company": company,
    }


def get_auth_session(session_store: dict[str, Any]) -> dict[str, Any]:
    if getattr(current_user, "is_authenticated", False):
        member = get_settings_user_by_email(current_user.email)
        return {
            "user": {
                "name": current_user.name,
                "email": current_user.email,
                "company": current_user.company,
                "role": member.get("role") if member else "employee",
                "permissions": member.get("permissions", []) if member else [],
            },
            "isAuthed": True,
        }

    user = session_store.get("auth_user")
    if isinstance(user, dict):
        member = get_settings_user_by_email(user.get("email"))
        user = {
            **user,
            "role": member.get("role") if member else "employee",
            "permissions": member.get("permissions", []) if member else [],
        }
    return {
        "user": deepcopy(user) if isinstance(user, dict) else None,
        "isAuthed": isinstance(user, dict),
    }


def create_auth_session(session_store: dict[str, Any], payload: dict[str, Any] | None = None) -> dict[str, Any]:
    user = _normalized_user(payload)
    db_user = User.query.filter_by(email=user["email"]).first()
    if db_user is None:
        db_user = User(
            email=user["email"],
            name=user["name"],
            company=user["company"],
        )
        db.session.add(db_user)
    else:
        db_user.name = user["name"]
        db_user.company = user["company"]
    db.session.commit()
    login_user(db_user, remember=True)
    member = get_settings_user_by_email(user["email"])
    user = {
        **user,
        "role": member.get("role") if member else "employee",
        "permissions": member.get("permissions", []) if member else [],
    }
    session_store["auth_user"] = user
    return {
        "user": deepcopy(user),
        "isAuthed": True,
    }


def clear_auth_session(session_store: dict[str, Any]) -> dict[str, Any]:
    if getattr(current_user, "is_authenticated", False):
        logout_user()
    session_store.pop("auth_user", None)
    return {
        "user": None,
        "isAuthed": False,
    }

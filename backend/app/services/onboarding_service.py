from __future__ import annotations

from copy import deepcopy
from datetime import datetime
from typing import Any

from ..extensions import db
from ..models import OnboardingState


DEFAULT_ONBOARDING_DRAFT = {
    "step": 0,
    "companyName": "",
    "companyTaxId": "",
    "companyBranch": "",
    "companyAddress": "",
    "logoName": "",
    "vatRegistration": "Registered (7%)",
    "vatRate": "7",
    "taxFrequency": "Monthly (P.P.30)",
    "issueWht": True,
    "customerName": "",
    "customerTaxId": "",
    "customerEmail": "",
    "productType": "Service",
    "productSku": "",
    "productName": "",
    "productPrice": "",
    "bankName": "Bangkok Bank",
    "bankAccountName": "",
    "bankAccountNumber": "",
    "invites": [
        {"email": "", "role": "Accountant"},
        {"email": "", "role": "Manager"},
    ],
}


def _timestamp() -> datetime:
    return datetime.utcnow().replace(microsecond=0)


def _format_timestamp(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat() + "Z"


def _normalize_invites(invites: Any) -> list[dict[str, str]]:
    normalized: list[dict[str, str]] = []
    if isinstance(invites, list):
        for item in invites:
            if not isinstance(item, dict):
                continue
            normalized.append(
                {
                    "email": str(item.get("email", "")).strip(),
                    "role": str(item.get("role", "Staff") or "Staff").strip() or "Staff",
                }
            )

    return normalized or deepcopy(DEFAULT_ONBOARDING_DRAFT["invites"])


def normalize_onboarding_draft(payload: dict[str, Any] | None) -> dict[str, Any]:
    draft = deepcopy(DEFAULT_ONBOARDING_DRAFT)
    source = payload if isinstance(payload, dict) else {}

    string_fields = (
        "companyName",
        "companyTaxId",
        "companyBranch",
        "companyAddress",
        "logoName",
        "vatRegistration",
        "vatRate",
        "taxFrequency",
        "customerName",
        "customerTaxId",
        "customerEmail",
        "productType",
        "productSku",
        "productName",
        "productPrice",
        "bankName",
        "bankAccountName",
        "bankAccountNumber",
    )
    for field in string_fields:
        draft[field] = str(source.get(field, draft[field]) or "").strip()

    try:
        step = int(source.get("step", draft["step"]))
    except (TypeError, ValueError):
        step = draft["step"]
    draft["step"] = max(0, min(step, 8))

    draft["issueWht"] = bool(source.get("issueWht", draft["issueWht"]))
    draft["invites"] = _normalize_invites(source.get("invites"))
    return draft


def _get_or_create_state() -> OnboardingState:
    state = db.session.get(OnboardingState, 1)
    if state is not None:
        return state

    state = OnboardingState(
        id=1,
        draft=deepcopy(DEFAULT_ONBOARDING_DRAFT),
        completed=False,
        updated_at=_timestamp(),
    )
    db.session.add(state)
    db.session.commit()
    return state


def _serialize_state(state: OnboardingState) -> dict[str, Any]:
    return {
        "draft": normalize_onboarding_draft(state.draft),
        "completed": bool(state.completed),
        "completedAt": _format_timestamp(state.completed_at),
        "updatedAt": _format_timestamp(state.updated_at),
    }


def get_onboarding_state() -> dict[str, Any]:
    state = _get_or_create_state()
    return _serialize_state(state)


def save_onboarding_draft(payload: dict[str, Any] | None) -> dict[str, Any]:
    state = _get_or_create_state()
    state.draft = normalize_onboarding_draft(payload)
    state.updated_at = _timestamp()
    db.session.commit()
    return _serialize_state(state)


def complete_onboarding(payload: dict[str, Any] | None) -> dict[str, Any]:
    state = _get_or_create_state()
    state.draft = normalize_onboarding_draft(payload or state.draft)
    state.completed = True
    state.updated_at = _timestamp()
    state.completed_at = state.updated_at
    db.session.commit()
    return _serialize_state(state)

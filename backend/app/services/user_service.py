from __future__ import annotations

from ..config.settings import get_settings
from ..extensions import db
from ..models import User


def ensure_default_user() -> User:
    settings = get_settings()
    user = User.query.filter_by(email=settings.default_auth_email).first()
    if user:
        return user

    user = User(
        email=settings.default_auth_email,
        name=settings.default_auth_name,
        company=settings.default_auth_company,
    )
    db.session.add(user)
    db.session.commit()
    return user

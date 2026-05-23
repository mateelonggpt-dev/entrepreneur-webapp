from __future__ import annotations

from datetime import datetime

from ..extensions import db


class OnboardingState(db.Model):
    __tablename__ = "onboarding_state"

    id = db.Column(db.Integer, primary_key=True, default=1)
    draft = db.Column(db.JSON, nullable=False, default=dict)
    completed = db.Column(db.Boolean, nullable=False, default=False)
    completed_at = db.Column(db.DateTime, nullable=True)
    updated_at = db.Column(db.DateTime, nullable=True, default=datetime.utcnow)

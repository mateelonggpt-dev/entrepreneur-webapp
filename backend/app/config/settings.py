from dataclasses import dataclass
import os
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    frontend_origins: tuple[str, ...]
    secret_key: str
    database_url: str
    default_auth_email: str
    default_auth_name: str
    default_auth_company: str


def get_settings() -> Settings:
    raw_origins = os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    )
    origins = tuple(origin.strip() for origin in raw_origins.split(",") if origin.strip())
    secret_key = os.getenv("FLASK_SECRET_KEY", "matter-acc-local-dev-secret")
    backend_dir = Path(__file__).resolve().parents[2]
    default_db_path = backend_dir / "storage" / "app.db"
    database_url = os.getenv("DATABASE_URL", f"sqlite:///{default_db_path.as_posix()}")
    default_auth_email = os.getenv("DEFAULT_AUTH_EMAIL", "somchai@siamtech.co.th")
    default_auth_name = os.getenv("DEFAULT_AUTH_NAME", "Somchai Bunnak")
    default_auth_company = os.getenv("DEFAULT_AUTH_COMPANY", "Siam Tech Co., Ltd.")

    return Settings(
        frontend_origins=origins,
        secret_key=secret_key,
        database_url=database_url,
        default_auth_email=default_auth_email,
        default_auth_name=default_auth_name,
        default_auth_company=default_auth_company,
    )

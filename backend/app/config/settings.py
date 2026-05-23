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


def _resolve_sqlite_url(database_url: str, backend_dir: Path) -> str:
    sqlite_prefix = "sqlite:///"
    if not database_url.startswith(sqlite_prefix):
        return database_url

    raw_path = database_url[len(sqlite_prefix) :]
    if raw_path == ":memory:":
        return database_url

    db_path = Path(raw_path)
    if not db_path.is_absolute():
        db_path = backend_dir / raw_path

    db_path.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{db_path.as_posix()}"


def get_settings() -> Settings:
    raw_origins = os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    )
    origins = tuple(origin.strip() for origin in raw_origins.split(",") if origin.strip())
    secret_key = os.getenv("FLASK_SECRET_KEY", "matter-acc-local-dev-secret")
    backend_dir = Path(__file__).resolve().parents[2]
    default_db_path = backend_dir / "storage" / "app.db"
    database_url = _resolve_sqlite_url(
        os.getenv("DATABASE_URL", f"sqlite:///{default_db_path.as_posix()}"),
        backend_dir,
    )
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

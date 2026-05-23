from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from threading import RLock
from typing import Any, Callable, TypeVar
from uuid import uuid4

from werkzeug.datastructures import FileStorage


T = TypeVar("T")

BACKEND_DIR = Path(__file__).resolve().parents[2]
STORAGE_DIR = BACKEND_DIR / "storage"
UPLOADS_DIR = STORAGE_DIR / "uploads"
GENERATED_DIR = STORAGE_DIR / "generated"
DB_PATH = STORAGE_DIR / "database.json"
DB_LOCK = RLock()


SeedFactory = Callable[[], dict[str, Any]]


def _ensure_storage() -> None:
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)


def load_database(seed_factory: SeedFactory) -> dict[str, Any]:
    _ensure_storage()

    if not DB_PATH.exists():
        save_database(seed_factory())

    with DB_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def save_database(data: dict[str, Any]) -> None:
    _ensure_storage()
    with DB_PATH.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)


def mutate_database(seed_factory: SeedFactory, mutator: Callable[[dict[str, Any]], T]) -> T:
    with DB_LOCK:
        data = load_database(seed_factory)
        result = mutator(data)
        save_database(data)
        return result


def clone_seed(data: dict[str, Any]) -> dict[str, Any]:
    return deepcopy(data)


def next_counter(data: dict[str, Any], key: str, start_at: int) -> int:
    counters = data.setdefault("counters", {})
    current = int(counters.get(key, start_at))
    counters[key] = current + 1
    return current


def save_upload(file_storage: FileStorage, prefix: str) -> dict[str, Any]:
    _ensure_storage()

    original_name = file_storage.filename or "attachment"
    suffix = Path(original_name).suffix.lower()
    stored_name = f"{prefix}-{uuid4().hex}{suffix}"
    path = UPLOADS_DIR / stored_name

    file_storage.save(path)

    return {
        "storedName": stored_name,
        "relativePath": path.relative_to(STORAGE_DIR).as_posix(),
        "contentType": file_storage.mimetype or "application/octet-stream",
        "sizeBytes": path.stat().st_size,
    }


def build_generated_path(prefix: str, extension: str) -> Path:
    _ensure_storage()
    safe_extension = extension.lstrip(".")
    return GENERATED_DIR / f"{prefix}-{uuid4().hex}.{safe_extension}"


def resolve_storage_path(relative_path: str) -> Path:
    return STORAGE_DIR / relative_path

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Settings:
    database_path: Path
    api_key: str
    device_stale_seconds: int


def load_settings() -> Settings:
    database_path = Path(
        os.getenv("DATABASE_PATH", "data/room-monitor.db")
    ).resolve()
    return Settings(
        database_path=database_path,
        api_key=os.getenv("API_KEY", "local-development-key"),
        device_stale_seconds=int(os.getenv("DEVICE_STALE_SECONDS", "180")),
    )


settings = load_settings()

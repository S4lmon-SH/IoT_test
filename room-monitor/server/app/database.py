from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .config import settings
from .schemas import ReadingCreate


RANGES: dict[str, tuple[int, int]] = {
    "1h": (1, 60),
    "24h": (24, 600),
    "7d": (24 * 7, 3600),
    "30d": (24 * 30, 21600),
}


def _connect(path: Path | None = None) -> sqlite3.Connection:
    database_path = path or settings.database_path
    database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database_path, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("PRAGMA foreign_keys=ON")
    return connection


def init_db() -> None:
    with _connect() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS readings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT NOT NULL,
                temperature REAL NOT NULL,
                humidity REAL NOT NULL,
                motion INTEGER NOT NULL DEFAULT 0,
                recorded_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_readings_device_time
            ON readings(device_id, recorded_at DESC);
            """
        )


def utc_now_text() -> str:
    return (
        datetime.now(timezone.utc)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z")
    )


def insert_reading(
    reading: ReadingCreate, recorded_at: str | None = None
) -> dict[str, Any]:
    timestamp = recorded_at or utc_now_text()
    with _connect() as connection:
        cursor = connection.execute(
            """
            INSERT INTO readings (
                device_id, temperature, humidity, motion, recorded_at
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                reading.device_id,
                reading.temperature,
                reading.humidity,
                int(reading.motion),
                timestamp,
            ),
        )
        row = connection.execute(
            "SELECT * FROM readings WHERE id = ?", (cursor.lastrowid,)
        ).fetchone()
    return _serialize_reading(row)


def get_current(device_id: str) -> dict[str, Any] | None:
    with _connect() as connection:
        row = connection.execute(
            """
            SELECT *
            FROM readings
            WHERE device_id = ?
            ORDER BY recorded_at DESC
            LIMIT 1
            """,
            (device_id,),
        ).fetchone()
    return _serialize_reading(row) if row else None


def get_summary(device_id: str, hours: int = 24) -> dict[str, Any]:
    modifier = f"-{hours} hours"
    with _connect() as connection:
        row = connection.execute(
            """
            SELECT
                COUNT(*) AS sample_count,
                MIN(temperature) AS temperature_min,
                MAX(temperature) AS temperature_max,
                AVG(temperature) AS temperature_avg,
                MIN(humidity) AS humidity_min,
                MAX(humidity) AS humidity_max,
                AVG(humidity) AS humidity_avg,
                SUM(motion) AS motion_count
            FROM readings
            WHERE device_id = ?
              AND recorded_at >= strftime(
                    '%Y-%m-%dT%H:%M:%SZ', 'now', ?
                  )
            """,
            (device_id, modifier),
        ).fetchone()

    result = dict(row)
    for key, value in result.items():
        if isinstance(value, float):
            result[key] = round(value, 2)
    return {"hours": hours, **result}


def get_history(device_id: str, range_code: str) -> dict[str, Any]:
    hours, bucket_seconds = RANGES[range_code]
    modifier = f"-{hours} hours"
    with _connect() as connection:
        rows = connection.execute(
            """
            SELECT
                (
                    CAST(strftime('%s', recorded_at) AS INTEGER) / ?
                ) * ? AS bucket_epoch,
                AVG(temperature) AS temperature,
                AVG(humidity) AS humidity,
                MAX(motion) AS motion
            FROM readings
            WHERE device_id = ?
              AND recorded_at >= strftime(
                    '%Y-%m-%dT%H:%M:%SZ', 'now', ?
                  )
            GROUP BY bucket_epoch
            ORDER BY bucket_epoch
            """,
            (bucket_seconds, bucket_seconds, device_id, modifier),
        ).fetchall()

    points = [
        {
            "recorded_at": datetime.fromtimestamp(
                row["bucket_epoch"], tz=timezone.utc
            )
            .isoformat(timespec="seconds")
            .replace("+00:00", "Z"),
            "temperature": round(row["temperature"], 2),
            "humidity": round(row["humidity"], 2),
            "motion": bool(row["motion"]),
        }
        for row in rows
    ]
    return {
        "range": range_code,
        "bucket_seconds": bucket_seconds,
        "points": points,
    }


def database_is_ready() -> bool:
    try:
        with _connect() as connection:
            connection.execute("SELECT 1").fetchone()
        return True
    except sqlite3.Error:
        return False


def _serialize_reading(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "device_id": row["device_id"],
        "temperature": row["temperature"],
        "humidity": row["humidity"],
        "motion": bool(row["motion"]),
        "recorded_at": row["recorded_at"],
    }

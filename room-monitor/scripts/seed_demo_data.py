from __future__ import annotations

import argparse
import math
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from server.app.config import settings  # noqa: E402
from server.app.database import init_db, insert_reading  # noqa: E402
from server.app.schemas import ReadingCreate  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="대시보드 확인용 예제 데이터 생성")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="기존 데이터베이스를 지운 뒤 생성",
    )
    args = parser.parse_args()

    if args.reset and settings.database_path.exists():
        settings.database_path.unlink()

    init_db()
    random.seed(41)
    now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    start = now - timedelta(hours=24)

    for index in range(145):
        timestamp = start + timedelta(minutes=index * 10)
        day_progress = index / 144
        temperature = (
            23.2
            + 2.4 * math.sin(day_progress * math.tau - 1.5)
            + random.uniform(-0.18, 0.18)
        )
        humidity = (
            54.0
            - 7.2 * math.sin(day_progress * math.tau - 1.5)
            + random.uniform(-0.8, 0.8)
        )
        insert_reading(
            ReadingCreate(
                device_id="room-uno-r4",
                temperature=round(temperature, 1),
                humidity=round(humidity, 1),
                motion=index % 17 == 0,
            ),
            recorded_at=timestamp.isoformat(timespec="seconds").replace(
                "+00:00", "Z"
            ),
        )

    print(f"예제 데이터 145개 생성: {settings.database_path}")


if __name__ == "__main__":
    main()


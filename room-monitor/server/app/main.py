from __future__ import annotations

import secrets
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, Query, status
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .database import (
    RANGES,
    database_is_ready,
    get_current,
    get_history,
    get_summary,
    init_db,
    insert_reading,
)
from .schemas import Reading, ReadingCreate


STATIC_DIR = Path(__file__).resolve().parent / "static"


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Room Environment Monitor",
    version="1.0.0",
    lifespan=lifespan,
)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


def require_device_key(
    x_api_key: Annotated[str | None, Header()] = None,
) -> None:
    if x_api_key is None or not secrets.compare_digest(
        x_api_key, settings.api_key
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효한 장치 API 키가 필요합니다.",
        )


@app.get("/", include_in_schema=False)
def dashboard() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/health")
def health() -> dict[str, str]:
    if not database_is_ready():
        raise HTTPException(status_code=503, detail="데이터베이스 오류")
    return {"status": "ok"}


@app.post(
    "/api/v1/readings",
    response_model=Reading,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_device_key)],
)
def create_reading(reading: ReadingCreate) -> dict:
    return insert_reading(reading)


@app.get("/api/v1/current", response_model=Reading)
def current(
    device_id: str = Query(default="room-uno-r4", max_length=64),
) -> dict:
    reading = get_current(device_id)
    if reading is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="아직 수신된 측정값이 없습니다.",
        )
    return reading


@app.get("/api/v1/summary")
def summary(
    device_id: str = Query(default="room-uno-r4", max_length=64),
    hours: int = Query(default=24, ge=1, le=24 * 365),
) -> dict:
    return get_summary(device_id, hours)


@app.get("/api/v1/history")
def history(
    device_id: str = Query(default="room-uno-r4", max_length=64),
    range_code: str = Query(default="1h", alias="range"),
) -> dict:
    if range_code not in RANGES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="range는 1h, 24h, 7d, 30d 중 하나여야 합니다.",
        )
    return get_history(device_id, range_code)

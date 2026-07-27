from __future__ import annotations

from pydantic import BaseModel, Field


class ReadingCreate(BaseModel):
    device_id: str = Field(
        default="room-uno-r4",
        min_length=1,
        max_length=64,
        pattern=r"^[A-Za-z0-9._-]+$",
    )
    temperature: float = Field(ge=-40, le=80)
    humidity: float = Field(ge=0, le=100)
    motion: bool = False


class Reading(BaseModel):
    id: int
    device_id: str
    temperature: float
    humidity: float
    motion: bool
    recorded_at: str


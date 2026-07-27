from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from server.app.config import settings
from server.app.database import insert_reading
from server.app.main import app
from server.app.schemas import ReadingCreate


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "database_path", tmp_path / "test.db")
    with TestClient(app) as test_client:
        yield test_client


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_dashboard_assets_are_served(client):
    page = client.get("/")
    assert page.status_code == 200
    assert "ROOM / 01" in page.text
    assert "/static/styles.css" in page.text

    stylesheet = client.get("/static/styles.css")
    script = client.get("/static/app.js")
    assert stylesheet.status_code == 200
    assert script.status_code == 200
    assert "renderChart" in script.text


def test_reading_requires_api_key(client):
    response = client.post(
        "/api/v1/readings",
        json={"temperature": 24.5, "humidity": 52},
    )
    assert response.status_code == 401


def test_reading_round_trip(client):
    created = client.post(
        "/api/v1/readings",
        headers={"X-API-Key": "local-development-key"},
        json={
            "device_id": "room-uno-r4",
            "temperature": 24.5,
            "humidity": 52,
            "motion": True,
        },
    )
    assert created.status_code == 201
    assert created.json()["temperature"] == 24.5
    assert created.json()["motion"] is True

    current = client.get("/api/v1/current")
    assert current.status_code == 200
    assert current.json()["humidity"] == 52

    history = client.get("/api/v1/history?range=24h")
    assert history.status_code == 200
    assert len(history.json()["points"]) == 1

    summary = client.get("/api/v1/summary")
    assert summary.status_code == 200
    assert summary.json()["sample_count"] == 1
    assert summary.json()["temperature_avg"] == 24.5


@pytest.mark.parametrize(
    ("payload", "expected_status"),
    [
        ({"temperature": 100, "humidity": 50}, 422),
        ({"temperature": 20, "humidity": -1}, 422),
        ({"device_id": "bad id", "temperature": 20, "humidity": 50}, 422),
    ],
)
def test_validation(client, payload, expected_status):
    response = client.post(
        "/api/v1/readings",
        headers={"X-API-Key": "local-development-key"},
        json=payload,
    )
    assert response.status_code == expected_status


def test_invalid_history_range(client):
    response = client.get("/api/v1/history?range=1y")
    assert response.status_code == 422


def test_one_minute_history_resolution(client):
    minute = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    first = (minute - timedelta(minutes=2)).isoformat().replace("+00:00", "Z")
    second = (minute - timedelta(minutes=1)).isoformat().replace("+00:00", "Z")

    insert_reading(
        ReadingCreate(temperature=24.1, humidity=51),
        recorded_at=first,
    )
    insert_reading(
        ReadingCreate(temperature=24.3, humidity=52),
        recorded_at=second,
    )

    response = client.get("/api/v1/history?range=1h")
    assert response.status_code == 200
    payload = response.json()
    assert payload["bucket_seconds"] == 60
    assert [point["temperature"] for point in payload["points"]] == [24.1, 24.3]

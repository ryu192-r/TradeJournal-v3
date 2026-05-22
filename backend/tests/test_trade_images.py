"""Trade chart image deletion regressions."""

from datetime import datetime
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.db.database import Base, SessionLocal
from app.db.database import engine as real_engine
from app.models.trade import Trade
from app.routers.trades import delete_chart_image


@pytest.fixture
def db_session():
    Base.metadata.drop_all(bind=real_engine)
    Base.metadata.create_all(bind=real_engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=real_engine)


@pytest.fixture
def upload_dir(tmp_path, monkeypatch):
    path = tmp_path / "uploads" / "charts"
    path.mkdir(parents=True)
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(path))
    return path


def _trade(chart_images: list[str]):
    return Trade(
        symbol="RELIANCE",
        direction="LONG",
        entry_price=Decimal("100.00"),
        quantity=Decimal("10"),
        entry_time=datetime.fromisoformat("2025-01-13T09:30:00"),
        status="open",
        chart_images=chart_images,
    )


def test_delete_chart_image_removes_expected_file(db_session, upload_dir):
    image_dir = upload_dir / "1"
    image_dir.mkdir()
    image_path = image_dir / "1_chart.png"
    image_path.write_bytes(b"png")

    trade = _trade(["/uploads/1/1_chart.png"])
    db_session.add(trade)
    db_session.commit()
    db_session.refresh(trade)

    result = delete_chart_image(trade.id, "/uploads/1/1_chart.png", db_session)

    assert result == {"images": []}
    assert not image_path.exists()
    db_session.refresh(trade)
    assert trade.chart_images == []


@pytest.mark.parametrize("url", ["1/1_chart.png", "/bad/1/1_chart.png"])
def test_delete_chart_image_rejects_non_upload_urls(db_session, upload_dir, url):
    trade = _trade([url])
    db_session.add(trade)
    db_session.commit()

    with pytest.raises(HTTPException) as exc:
        delete_chart_image(trade.id, url, db_session)

    assert exc.value.status_code == 400
    assert exc.value.detail == "Invalid upload URL"


def test_delete_chart_image_rejects_path_traversal(db_session, upload_dir):
    url = "/uploads/../outside.png"
    trade = _trade([url])
    db_session.add(trade)
    db_session.commit()

    with pytest.raises(HTTPException) as exc:
        delete_chart_image(trade.id, url, db_session)

    assert exc.value.status_code == 400
    assert exc.value.detail == "Invalid upload URL"

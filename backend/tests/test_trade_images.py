"""Trade chart image upload/deletion regressions."""

from datetime import datetime
from decimal import Decimal
from itertools import count
import io

import pytest
from fastapi import HTTPException, status

from app.core.security import get_password_hash
from app.core.config import settings
from app.db.database import Base, SessionLocal
from app.db.database import engine as real_engine
from app.models.trade import Trade
from app.models.user import User
from app.models.account import Account
from app.routers.trades import delete_chart_image, upload_chart_image
from PIL import Image

_email_counter = count(1)


def _make_user(db_session):
    user = User(
        email=f"test_{next(_email_counter)}@example.com",
        full_name="Test User",
        hashed_password=get_password_hash("test123"),
    )
    db_session.add(user)
    db_session.flush()
    return user


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


def _trade(chart_images: list[str], user_id: int):
    return Trade(
        symbol="RELIANCE",
        direction="LONG",
        entry_price=Decimal("100.00"),
        quantity=Decimal("10"),
        entry_time=datetime.fromisoformat("2025-01-13T09:30:00"),
        status="open",
        chart_images=chart_images,
        user_id=user_id,
    )


def _make_png_bytes() -> bytes:
    img = Image.new("RGB", (1, 1), color=(255, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _make_jpeg_bytes() -> bytes:
    img = Image.new("RGB", (1, 1), color=(255, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


# ── Delete tests ──


def test_delete_chart_image_removes_expected_file(db_session, upload_dir):
    user = _make_user(db_session)
    image_dir = upload_dir / "1"
    image_dir.mkdir()
    image_path = image_dir / "1_chart.png"
    image_path.write_bytes(b"png")

    trade = _trade(["/uploads/1/1_chart.png"], user.id)
    db_session.add(trade)
    db_session.commit()
    db_session.refresh(trade)

    result = delete_chart_image(trade.id, "/uploads/1/1_chart.png", db_session, current_user=user)

    assert result == {"images": []}
    assert not image_path.exists()
    db_session.refresh(trade)
    assert trade.chart_images == []


@pytest.mark.parametrize("url", ["1/1_chart.png", "/bad/1/1_chart.png"])
def test_delete_chart_image_rejects_non_upload_urls(db_session, upload_dir, url):
    user = _make_user(db_session)
    trade = _trade([url], user.id)
    db_session.add(trade)
    db_session.commit()

    with pytest.raises(HTTPException) as exc:
        delete_chart_image(trade.id, url, db_session, current_user=user)

    assert exc.value.status_code == 400
    assert exc.value.detail == "Invalid upload URL"


def test_delete_chart_image_rejects_path_traversal(db_session, upload_dir):
    user = _make_user(db_session)
    url = "/uploads/../outside.png"
    trade = _trade([url], user.id)
    db_session.add(trade)
    db_session.commit()

    with pytest.raises(HTTPException) as exc:
        delete_chart_image(trade.id, url, db_session, current_user=user)

    assert exc.value.status_code == 400
    assert exc.value.detail == "Invalid upload URL"


# ── Upload tests ──


def test_upload_rejects_oversized_file(db_session, upload_dir):
    user = _make_user(db_session)
    trade = _trade([], user.id)
    db_session.add(trade)
    db_session.commit()
    db_session.refresh(trade)

    from fastapi import UploadFile

    oversized = _make_png_bytes() + b"\x00" * (settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024 + 1)
    fake_file = UploadFile(filename="test.png", file=io.BytesIO(oversized))

    with pytest.raises(HTTPException) as exc:
        upload_chart_image(trade.id, fake_file, db_session, current_user=user)

    assert exc.value.status_code == status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
    assert "too large" in exc.value.detail.lower()


def test_upload_rejects_fake_image(db_session, upload_dir):
    user = _make_user(db_session)
    trade = _trade([], user.id)
    db_session.add(trade)
    db_session.commit()
    db_session.refresh(trade)

    from fastapi import UploadFile

    fake_file = UploadFile(filename="chart.png", file=io.BytesIO(b"not an image"))

    with pytest.raises(HTTPException) as exc:
        upload_chart_image(trade.id, fake_file, db_session, current_user=user)

    assert exc.value.status_code == status.HTTP_400_BAD_REQUEST
    assert "valid image format" in exc.value.detail.lower()


def test_upload_rejects_bad_extension(db_session, upload_dir):
    user = _make_user(db_session)
    trade = _trade([], user.id)
    db_session.add(trade)
    db_session.commit()
    db_session.refresh(trade)

    from fastapi import UploadFile

    fake_file = UploadFile(filename="chart.svg", file=io.BytesIO(b"<svg></svg>"))

    with pytest.raises(HTTPException) as exc:
        upload_chart_image(trade.id, fake_file, db_session, current_user=user)

    assert exc.value.status_code == status.HTTP_400_BAD_REQUEST
    assert "not allowed" in exc.value.detail.lower()


def test_upload_accepts_valid_png(db_session, upload_dir):
    user = _make_user(db_session)
    trade = _trade([], user.id)
    db_session.add(trade)
    db_session.commit()
    db_session.refresh(trade)

    from fastapi import UploadFile

    png_bytes = _make_png_bytes()
    valid_file = UploadFile(filename="chart.png", file=io.BytesIO(png_bytes))

    result = upload_chart_image(trade.id, valid_file, db_session, current_user=user)

    assert result["url"].startswith("/api/v1/trades/")
    assert len(result["images"]) == 1

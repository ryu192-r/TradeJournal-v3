import os
import subprocess
import sys
from pathlib import Path

import pytest

import app.main as main_module

BACKEND_ROOT = Path(__file__).resolve().parents[1]


def _fresh_db_env(db_path: Path) -> dict[str, str]:
    env = os.environ.copy()
    env.update(
        {
            "DATABASE_URL": f"sqlite:///{db_path}",
            "SECRET_KEY": "test-startup-secret",
            "JWT_SECRET_KEY": "test-startup-jwt-secret",
            "DEBUG": "false",
            "RATE_LIMIT_OFF": "true",
        }
    )
    return env


def test_fresh_empty_database_alembic_upgrade_head(tmp_path):
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND_ROOT,
        env=_fresh_db_env(tmp_path / "fresh-alembic.db"),
        capture_output=True,
        text=True,
        timeout=60,
    )

    assert result.returncode == 0, result.stdout + result.stderr


def test_debug_false_startup_runs_migrations_on_fresh_database(tmp_path):
    result = subprocess.run(
        [sys.executable, "-c", "import app.main; print('startup-ok')"],
        cwd=BACKEND_ROOT,
        env=_fresh_db_env(tmp_path / "fresh-startup.db"),
        capture_output=True,
        text=True,
        timeout=60,
    )

    assert result.returncode == 0, result.stdout + result.stderr
    assert "startup-ok" in result.stdout


def test_run_migrations_raises_on_prod_migration_failure(monkeypatch):
    def fail_upgrade(*args, **kwargs):
        raise RuntimeError("migration drift")

    monkeypatch.setattr(main_module.settings, "DEBUG", False)
    monkeypatch.setattr(main_module, "_is_test_mode", lambda: False)
    monkeypatch.setattr(main_module.command, "upgrade", fail_upgrade)

    with pytest.raises(RuntimeError, match="migration drift"):
        main_module.run_migrations()


def test_run_migrations_uses_create_all_only_in_dev_fallback(monkeypatch):
    calls = {"create_all": 0}

    def fail_upgrade(*args, **kwargs):
        raise RuntimeError("dev migration drift")

    def fake_create_all(*args, **kwargs):
        calls["create_all"] += 1

    monkeypatch.setattr(main_module.settings, "DEBUG", True)
    monkeypatch.setattr(main_module, "_is_test_mode", lambda: False)
    monkeypatch.setattr(main_module.command, "upgrade", fail_upgrade)
    monkeypatch.setattr(main_module.Base.metadata, "create_all", fake_create_all)

    main_module.run_migrations()

    assert calls["create_all"] == 1


def test_import_db_startup_tasks_skipped_under_pytest(monkeypatch):
    monkeypatch.setattr(main_module, "_is_test_mode", lambda: True)

    assert main_module._should_run_import_db_startup_tasks() is False


def test_import_db_startup_tasks_run_outside_pytest(monkeypatch):
    monkeypatch.setattr(main_module, "_is_test_mode", lambda: False)

    assert main_module._should_run_import_db_startup_tasks() is True

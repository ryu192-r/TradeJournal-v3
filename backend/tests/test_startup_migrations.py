import pytest

import app.main as main_module


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

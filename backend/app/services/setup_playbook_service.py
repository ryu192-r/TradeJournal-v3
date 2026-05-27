"""Setup Playbook service for business logic."""
from sqlalchemy.orm import Session

from app.models.trade import Trade
from app.models.setup_playbook import SetupPlaybook


def _update_setup_stats(db: Session, setup_name: str | None, user_id: int | None = None):
    """Recompute trade_count, win_rate, avg_r for a setup playbook.

    This helper intentionally does not commit; callers own transaction boundaries.
    """
    if not setup_name:
        return
    playbook = db.query(SetupPlaybook).filter(SetupPlaybook.name == setup_name).first()
    if not playbook:
        return
    filters = [Trade.setup == setup_name, Trade.status != "deleted"]
    if user_id is not None:
        filters.append(Trade.user_id == user_id)
    trades = db.query(Trade).filter(*filters).all()
    closed = [t for t in trades if t.pnl is not None]
    wins = [t for t in closed if t.pnl > 0]
    playbook.trade_count = len(trades)
    playbook.win_rate = f"{round(len(wins) / len(closed) * 100, 1)}%" if closed else None
    r_values = [t.r_multiple for t in closed if t.r_multiple is not None]
    playbook.avg_r = f"{round(sum(float(r) for r in r_values) / len(r_values), 2)}" if r_values else None

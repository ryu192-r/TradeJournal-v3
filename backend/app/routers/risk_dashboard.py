from decimal import Decimal
from typing import Optional
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_serializer
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.account import Account
from app.models.capital_event import CapitalEvent
from app.models.trade import Trade
from app.models.partial_exit import PartialExit
from app.utils.decimal_utils import ensure_decimal


router = APIRouter(prefix="/risk-dashboard", tags=["risk-dashboard"])


class RiskBucketOut(BaseModel):
    name: str
    open_risk: Decimal
    deployed_capital: Decimal
    exposure_pct: Optional[float] = None
    position_count: int

    @field_serializer("open_risk", "deployed_capital")
    def serialize_decimal(self, v: Decimal) -> str:
        return str(v)


class RiskTradeOut(BaseModel):
    trade_id: int
    symbol: str
    setup: Optional[str] = None
    entry_price: Decimal
    stop_price: Optional[Decimal] = None
    quantity: Decimal
    deployed_capital: Decimal
    open_risk: Decimal
    risk_pct: Optional[float] = None

    @field_serializer("entry_price", "stop_price", "quantity", "deployed_capital", "open_risk")
    def serialize_decimal(self, v: Optional[Decimal]) -> Optional[str]:
        return str(v) if v is not None else None


class RiskWarningOut(BaseModel):
    severity: str
    code: str
    message: str
    trade_id: Optional[int] = None
    symbol: Optional[str] = None


class RiskDashboardResponse(BaseModel):
    account_id: int
    account_name: str
    net_equity: Decimal
    open_positions: int
    deployed_capital: Decimal
    available_capital: Decimal
    open_risk: Decimal
    portfolio_heat_pct: Optional[float] = None
    deployed_capital_pct: Optional[float] = None
    positions_without_stop: int
    largest_position: Optional[RiskTradeOut] = None
    largest_risk_position: Optional[RiskTradeOut] = None
    risk_by_setup: list[RiskBucketOut]
    risk_by_symbol: list[RiskBucketOut]
    warnings: list[RiskWarningOut]

    @field_serializer("net_equity", "deployed_capital", "available_capital", "open_risk")
    def serialize_decimal(self, v: Decimal) -> str:
        return str(v)


def _remaining_qty(trade: Trade, pe_map: dict[int, list]) -> Decimal:
    total_exited = sum(pe.qty for pe in pe_map.get(trade.id, []))
    return trade.quantity - total_exited


def _compute_net_equity(account: Account, db: Session, pe_map: dict[int, list]) -> Decimal:
    initial_balance = ensure_decimal(account.initial_balance)
    events = db.query(CapitalEvent).filter(CapitalEvent.account_id == account.id).all()
    total_deposits = Decimal("0")
    total_withdrawals = Decimal("0")
    for evt in events:
        amt = ensure_decimal(evt.amount)
        if evt.event_type == "deposit":
            total_deposits += amt
        elif evt.event_type == "withdrawal":
            total_withdrawals += abs(amt)
    capital_net = total_deposits - total_withdrawals

    realized_pnl = Decimal("0")
    for t in db.query(Trade).filter(Trade.pnl.isnot(None), Trade.status != "deleted").all():
        realized_pnl += ensure_decimal(t.pnl)
    for t in db.query(Trade).filter(Trade.exit_price.is_(None), Trade.status != "deleted").all():
        for pe in pe_map.get(t.id, []):
            if pe.realized_pnl:
                realized_pnl += ensure_decimal(pe.realized_pnl)
    return initial_balance + capital_net + realized_pnl


def _trade_deployed_capital(trade: Trade, pe_map: dict[int, list]) -> Decimal:
    rem = _remaining_qty(trade, pe_map)
    return ensure_decimal(trade.entry_price) * rem


def _trade_open_risk(trade: Trade, pe_map: dict[int, list]) -> Decimal:
    if trade.stop_price is None:
        return Decimal("0")
    entry = ensure_decimal(trade.entry_price)
    stop = ensure_decimal(trade.stop_price)
    rem = _remaining_qty(trade, pe_map)
    return (entry - stop) * rem


def _risk_trade_out(trade: Trade, net_equity: Decimal, pe_map: dict[int, list]) -> RiskTradeOut:
    deployed = _trade_deployed_capital(trade, pe_map)
    risk = _trade_open_risk(trade, pe_map)
    rem = _remaining_qty(trade, pe_map)
    risk_pct = round(float((risk / net_equity) * 100), 2) if net_equity > 0 else None
    return RiskTradeOut(
        trade_id=trade.id,
        symbol=trade.symbol,
        setup=trade.setup,
        entry_price=ensure_decimal(trade.entry_price),
        stop_price=ensure_decimal(trade.stop_price) if trade.stop_price is not None else None,
        quantity=rem,
        deployed_capital=deployed,
        open_risk=risk,
        risk_pct=risk_pct,
    )


def _bucket(name: str, trades: list[Trade], net_equity: Decimal, pe_map: dict[int, list]) -> RiskBucketOut:
    deployed = sum((_trade_deployed_capital(t, pe_map) for t in trades), Decimal("0"))
    risk = sum((_trade_open_risk(t, pe_map) for t in trades), Decimal("0"))
    exposure_pct = round(float((deployed / net_equity) * 100), 2) if net_equity > 0 else None
    return RiskBucketOut(
        name=name,
        open_risk=risk,
        deployed_capital=deployed,
        exposure_pct=exposure_pct,
        position_count=len(trades),
    )


@router.get("/", response_model=RiskDashboardResponse)
def get_risk_dashboard(db: Session = Depends(get_db)):
    account = db.query(Account).order_by(Account.id).first()
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No accounts found. Create an account first.",
        )

    open_trades = (
        db.query(Trade)
        .filter(Trade.status != "deleted", Trade.exit_price.is_(None))
        .order_by(Trade.entry_time.desc())
        .all()
    )

    # Load partial exits for all open trades
    all_pe = db.query(PartialExit).order_by(PartialExit.exit_time.asc()).all()
    pe_map: dict[int, list[PartialExit]] = defaultdict(list)
    for pe in all_pe:
        pe_map[pe.trade_id].append(pe)

    net_equity = _compute_net_equity(account, db, pe_map)
    deployed_capital = sum((_trade_deployed_capital(t, pe_map) for t in open_trades), Decimal("0"))
    available_capital = net_equity - deployed_capital
    open_risk = sum((_trade_open_risk(t, pe_map) for t in open_trades), Decimal("0"))
    positions_without_stop = sum(1 for t in open_trades if t.stop_price is None)

    portfolio_heat_pct = round(float((open_risk / net_equity) * 100), 2) if net_equity > 0 else None
    deployed_capital_pct = round(float((deployed_capital / net_equity) * 100), 2) if net_equity > 0 else None

    largest_position_trade = max(open_trades, key=lambda t: _trade_deployed_capital(t, pe_map), default=None)
    largest_risk_trade = max(open_trades, key=lambda t: _trade_open_risk(t, pe_map), default=None)

    by_setup: dict[str, list[Trade]] = defaultdict(list)
    by_symbol: dict[str, list[Trade]] = defaultdict(list)
    for trade in open_trades:
        by_setup[trade.setup or "Uncategorised"].append(trade)
        by_symbol[trade.symbol].append(trade)

    risk_by_setup = sorted(
        (_bucket(name, trades, net_equity, pe_map) for name, trades in by_setup.items()),
        key=lambda b: b.open_risk,
        reverse=True,
    )
    risk_by_symbol = sorted(
        (_bucket(name, trades, net_equity, pe_map) for name, trades in by_symbol.items()),
        key=lambda b: b.deployed_capital,
        reverse=True,
    )

    warnings: list[RiskWarningOut] = []
    for trade in open_trades:
        if trade.stop_price is None:
            warnings.append(RiskWarningOut(
                severity="high",
                code="missing_stop",
                message=f"{trade.symbol} has no stop loss set.",
                trade_id=trade.id,
                symbol=trade.symbol,
            ))

    if portfolio_heat_pct is not None and portfolio_heat_pct > 6:
        warnings.append(RiskWarningOut(
            severity="high",
            code="portfolio_heat_high",
            message=f"Portfolio heat is {portfolio_heat_pct}%, above the 6% caution level.",
        ))
    elif portfolio_heat_pct is not None and portfolio_heat_pct > 4:
        warnings.append(RiskWarningOut(
            severity="medium",
            code="portfolio_heat_elevated",
            message=f"Portfolio heat is {portfolio_heat_pct}%, above the 4% watch level.",
        ))

    if deployed_capital_pct is not None and deployed_capital_pct > 80:
        warnings.append(RiskWarningOut(
            severity="medium",
            code="capital_deployment_high",
            message=f"Capital deployment is {deployed_capital_pct}%, leaving limited cash buffer.",
        ))

    for bucket in risk_by_setup:
        if bucket.exposure_pct is not None and bucket.exposure_pct > 35:
            warnings.append(RiskWarningOut(
                severity="medium",
                code="setup_concentration",
                message=f"{bucket.name} setup exposure is {bucket.exposure_pct}% of equity.",
            ))

    return RiskDashboardResponse(
        account_id=account.id,
        account_name=account.name,
        net_equity=net_equity,
        open_positions=len(open_trades),
        deployed_capital=deployed_capital,
        available_capital=available_capital,
        open_risk=open_risk,
        portfolio_heat_pct=portfolio_heat_pct,
        deployed_capital_pct=deployed_capital_pct,
        positions_without_stop=positions_without_stop,
        largest_position=_risk_trade_out(largest_position_trade, net_equity, pe_map) if largest_position_trade else None,
        largest_risk_position=_risk_trade_out(largest_risk_trade, net_equity, pe_map) if largest_risk_trade else None,
        risk_by_setup=risk_by_setup,
        risk_by_symbol=risk_by_symbol,
        warnings=warnings,
    )
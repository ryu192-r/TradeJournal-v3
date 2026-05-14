from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import Field, field_validator, field_serializer

from app.schemas.base import BaseSchema
from app.utils.decimal_utils import ensure_decimal


class AccountCreate(BaseSchema):
    name: str = Field(..., max_length=100, description="Display name for the account")
    broker: Optional[str] = Field(None, max_length=100, description="Broker name (e.g. Dhan, Zerodha)")
    account_number: Optional[str] = Field(None, max_length=50, description="Broker account number")
    initial_balance: Decimal = Field(default=Decimal("0"), description="Starting balance")
    currency: str = Field(default="INR", max_length=10, description="Currency code")

    @field_validator("initial_balance", mode="before")
    @classmethod
    def validate_initial_balance(cls, v):
        return ensure_decimal(v)


class AccountUpdate(BaseSchema):
    name: Optional[str] = Field(None, max_length=100)
    broker: Optional[str] = Field(None, max_length=100)
    account_number: Optional[str] = Field(None, max_length=50)
    initial_balance: Optional[Decimal] = Field(None)
    currency: Optional[str] = Field(None, max_length=10)

    @field_validator("initial_balance", mode="before")
    @classmethod
    def validate_initial_balance(cls, v):
        return ensure_decimal(v)


class AccountResponse(BaseSchema):
    id: int
    name: str
    broker: Optional[str] = None
    account_number: Optional[str] = None
    initial_balance: Decimal
    current_balance: Decimal
    currency: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @field_serializer("initial_balance", "current_balance")
    def serialize_balance(self, v: Decimal) -> str:
        return str(v)


class AccountListResponse(BaseSchema):
    total: int
    items: list[AccountResponse]


class EquityCurvePoint(BaseSchema):
    """A single point in the equity curve."""
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    equity: Decimal = Field(..., description="Equity value at end of day")

    @field_serializer("equity")
    def serialize_equity(self, v: Decimal) -> str:
        return str(v)


class EquityCurveResponse(BaseSchema):
    """Full equity curve for an account."""
    account_id: int
    account_name: str
    initial_balance: Decimal
    current_equity: Decimal
    points: list[EquityCurvePoint]

    @field_serializer("initial_balance", "current_equity")
    def serialize_eq(self, v: Decimal) -> str:
        return str(v)

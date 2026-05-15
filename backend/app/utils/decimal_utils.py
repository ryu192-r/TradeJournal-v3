"""Shared decimal coercion utility for Pydantic validators."""
from decimal import Decimal
from sqlalchemy import String
from sqlalchemy.types import TypeDecorator


def ensure_decimal(v):
    """Coerce float/str to Decimal without precision loss.

    Returns v unchanged if already Decimal or None.
    """
    if v is None:
        return v
    if isinstance(v, float):
        return Decimal(str(v))
    if isinstance(v, str):
        return Decimal(v)
    return v


class TagsList(TypeDecorator):
    """Stores a list of tags as comma-separated string in the DB.

    At the ORM level, attributes using this type behave as list[str] or None.
    In the DB, they are stored as String(200) — comma-separated.
    """

    impl = String(200)

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, list):
            return ','.join(value)
        return value

    def process_result_value(self, value, dialect):
        if value is None or value == '':
            return None
        if isinstance(value, str):
            return [t.strip() for t in value.split(',') if t.strip()]
        return value

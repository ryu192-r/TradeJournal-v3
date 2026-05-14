"""Shared decimal coercion utility for Pydantic validators."""
from decimal import Decimal


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

from datetime import UTC, datetime


def utc(value: datetime) -> datetime:
    """Normalize SQLite's naive test timestamps and PostgreSQL timestamptz alike."""
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)

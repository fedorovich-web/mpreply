from sqlalchemy import Boolean, CheckConstraint, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class AnswerPackage(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "answer_packages"
    __table_args__ = (
        CheckConstraint("kind IN ('trial', 'paid', 'custom')", name="ck_answer_packages_kind"),
        CheckConstraint("answer_count IS NULL OR answer_count > 0", name="ck_answer_packages_answer_count_positive"),
        CheckConstraint("price_minor IS NULL OR price_minor >= 0", name="ck_answer_packages_price_non_negative"),
        CheckConstraint("validity_days IS NULL OR validity_days > 0", name="ck_answer_packages_validity_positive"),
        CheckConstraint("marketplace_limit IS NULL OR marketplace_limit > 0", name="ck_answer_packages_marketplace_limit_positive"),
    )

    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    answer_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    price_minor: Mapped[int | None] = mapped_column(Integer, nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="RUB", nullable=False)
    validity_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    marketplace_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    metadata_json: Mapped[dict[str, object]] = mapped_column(JSONB, default=dict, nullable=False)

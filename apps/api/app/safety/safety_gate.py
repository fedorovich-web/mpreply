from __future__ import annotations

import re
from enum import StrEnum
from typing import ClassVar

from pydantic import BaseModel, ConfigDict, Field


class SafetyDecision(StrEnum):
    ALLOW = "allow"
    MANUAL_REVIEW = "manual_review"
    BLOCK = "block"


class SafetyInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    draft_text: str = Field(min_length=1, max_length=12000)
    confidence_score: float = Field(ge=0.0, le=1.0)
    message_type: str = Field(min_length=1, max_length=32)
    rating: int | None = Field(default=None, ge=1, le=5)
    has_product_context: bool = True
    model_flags: list[str] = Field(default_factory=list, max_length=32)


class SafetyResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: SafetyDecision
    flags: list[str]
    reasons: list[str]
    auto_send_allowed: bool


class SafetyGate:
    """Deterministic post-generation guardrail for marketplace replies."""

    _PROMISE_PATTERNS = (
        re.compile(r"\bгарантир(?:уем|ую|овано)\b", re.IGNORECASE),
        re.compile(r"\bверн(?:ем|ём)\s+деньги\b", re.IGNORECASE),
        re.compile(r"\bобязательно\s+(?:доставим|заменим|компенсируем|решим)\b", re.IGNORECASE),
        re.compile(r"\bточно\s+(?:доставим|заменим|компенсируем|решим)\b", re.IGNORECASE),
        re.compile(r"\brefund\s+guaranteed\b", re.IGNORECASE),
        re.compile(r"\breplacement\s+guaranteed\b", re.IGNORECASE),
    )
    _MEDICAL_OR_LEGAL_PATTERNS = (
        re.compile(r"\bлечит\b", re.IGNORECASE),
        re.compile(r"\bвылечит\b", re.IGNORECASE),
        re.compile(r"\bгарантированно\s+устраняет\s+(?:болезнь|симптом)\b", re.IGNORECASE),
        re.compile(r"\bюридическ(?:ая|ую)\s+гаранти", re.IGNORECASE),
    )
    _PERSONAL_DATA_PATTERNS = (
        re.compile(r"\b\+?7[\s\-()]?\d{3}[\s\-()]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}\b"),
        re.compile(r"\b[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}\b"),
    )
    _BLOCK_FLAGS: ClassVar[frozenset[str]] = frozenset({"unsafe_instruction", "personal_data_exposure", "policy_violation"})
    _MANUAL_REVIEW_FLAGS: ClassVar[frozenset[str]] = frozenset({
        "missing_product_context",
        "low_confidence",
        "risky_promise",
        "medical_or_legal_claim",
        "unclear_customer_issue",
        "needs_manual_review",
        "sensitive_topic",
        "seller_prohibited_phrase",
    })

    def evaluate(self, payload: SafetyInput) -> SafetyResult:
        flags = {flag.strip() for flag in payload.model_flags if flag.strip()}
        reasons: list[str] = []

        if not payload.has_product_context:
            flags.add("missing_product_context")
            reasons.append("Product context is missing")

        if payload.confidence_score < 0.75:
            flags.add("low_confidence")
            reasons.append("AI confidence is below the auto-send threshold")

        if self._matches_any(payload.draft_text, self._PROMISE_PATTERNS):
            flags.add("risky_promise")
            reasons.append("Draft contains an unverified promise or guaranteed outcome")

        if self._matches_any(payload.draft_text, self._MEDICAL_OR_LEGAL_PATTERNS):
            flags.add("medical_or_legal_claim")
            reasons.append("Draft contains a medical or legal claim")

        if self._matches_any(payload.draft_text, self._PERSONAL_DATA_PATTERNS):
            flags.add("personal_data_exposure")
            reasons.append("Draft appears to contain personal contact data")

        if payload.rating is not None and payload.rating <= 3:
            flags.add("negative_review")

        if flags.intersection(self._BLOCK_FLAGS):
            decision = SafetyDecision.BLOCK
        elif flags.intersection(self._MANUAL_REVIEW_FLAGS):
            decision = SafetyDecision.MANUAL_REVIEW
        else:
            decision = SafetyDecision.ALLOW

        if "seller_prohibited_phrase" in flags:
            reasons.append("Draft contains a phrase prohibited by seller settings")
        if "needs_manual_review" in flags and not reasons:
            reasons.append("AI model requested manual review")

        return SafetyResult(
            decision=decision,
            flags=sorted(flags),
            reasons=reasons,
            auto_send_allowed=decision is SafetyDecision.ALLOW,
        )

    @staticmethod
    def _matches_any(value: str, patterns: tuple[re.Pattern[str], ...]) -> bool:
        return any(pattern.search(value) for pattern in patterns)

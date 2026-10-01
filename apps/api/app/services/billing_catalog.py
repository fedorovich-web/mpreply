from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from types import MappingProxyType

# Minor units, matching the product owner's approved catalogue. Clients cannot supply prices.
PLANS = MappingProxyType({"start": (129000, 300), "team": (349000, 800), "business": (699000, 1600)})
PACKS = MappingProxyType({
    50: 29900, 100: 54900, 250: 129000, 500: 249000, 1000: 479000, 2000: 929000,
    5000: 2249000, 10000: 4390000, 15000: 6540000, 20000: 8690000,
})
_MAX_DB_INTEGER = 2147483647


@dataclass(frozen=True, slots=True)
class PurchaseQuote:
    amount_minor: int
    currency: str
    monthly_credits: int
    addon_credits: int
    snapshot: dict[str, object]


def quote_purchase(
    *, kind: str, plan_code: str | None = None, months: int | None = None, packs: list[tuple[int, int]],
) -> PurchaseQuote:
    if kind == "plan":
        if plan_code is None or plan_code not in PLANS or type(months) is not int or months not in (1, 12) or packs:
            raise ValueError("Invalid tariff purchase")
        price, credits = PLANS[plan_code]
        total = price if months == 1 else price * 12 * 80 // 100
        return PurchaseQuote(total, "RUB", credits, 0, {"kind": kind, "plan_code": plan_code, "months": months})
    if kind != "addon" or plan_code is not None or months is not None or not packs:
        raise ValueError("Invalid reply pack purchase")
    counts: Counter[int] = Counter()
    for quantity, count in packs:
        if type(quantity) is not int or quantity not in PACKS or type(count) is not int or count <= 0:
            raise ValueError("Invalid reply pack")
        counts[quantity] += count
    total = sum(PACKS[quantity] * count for quantity, count in counts.items())
    credits = sum(quantity * count for quantity, count in counts.items())
    if total > _MAX_DB_INTEGER or credits > _MAX_DB_INTEGER:
        raise ValueError("Purchase exceeds supported amount")
    snapshot: dict[str, object] = {"kind": kind, "packs": [{"quantity": q, "count": counts[q]} for q in sorted(counts)]}
    return PurchaseQuote(total, "RUB", 0, credits, snapshot)

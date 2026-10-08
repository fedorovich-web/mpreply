from __future__ import annotations

import pytest

from app.services.billing_catalog import PACKS, PLANS, quote_purchase


@pytest.mark.parametrize("code,price,credits", [("start", 129000, 300), ("team", 349000, 800), ("business", 699000, 1600)])
def test_monthly_tariff_quote_uses_approved_server_prices(code: str, price: int, credits: int) -> None:
    quote = quote_purchase(kind="plan", plan_code=code, months=1, packs=[])
    assert (quote.amount_minor, quote.currency, quote.monthly_credits, quote.addon_credits) == (price, "RUB", credits, 0)
    assert quote.snapshot["months"] == 1


def test_annual_quote_has_discount_and_monthly_allowance() -> None:
    quote = quote_purchase(kind="plan", plan_code="start", months=12, packs=[])
    assert quote.amount_minor == 1238400
    assert quote.monthly_credits == 300
    assert quote.snapshot["months"] == 12


def test_pack_quote_combines_counts_and_never_changes_tariff() -> None:
    quote = quote_purchase(kind="addon", packs=[(50, 2), (100, 1)], plan_code=None, months=None)
    assert (quote.amount_minor, quote.addon_credits, quote.monthly_credits) == (114700, 200, 0)
    assert quote.snapshot["packs"] == [{"quantity": 50, "count": 2}, {"quantity": 100, "count": 1}]


def test_catalog_contains_exact_approved_pack_prices() -> None:
    assert dict(PACKS) == {50: 29900, 100: 54900, 250: 129000, 500: 249000, 1000: 479000, 2000: 929000,
                          5000: 2249000, 10000: 4390000, 15000: 6540000, 20000: 8690000}
    assert set(PLANS) == {"start", "team", "business"}


@pytest.mark.parametrize("kind,code,months,packs", [
    ("subscription", "start", 1, []), ("plan", "agency", 1, []), ("plan", "growth", 1, []),
    ("plan", "start", 2, []), ("plan", "start", True, []), ("plan", "start", 1, [(50, 1)]),
    ("addon", None, None, []), ("addon", None, None, [(51, 1)]), ("addon", None, None, [(50, -1)]),
    ("addon", None, None, [(50, 1.5)]), ("addon", None, None, [(50, True)]),
    ("addon", "start", None, [(50, 1)]), ("addon", None, 1, [(50, 1)]),
    ("addon", None, None, [(20000, 2147483647)]),
])
def test_invalid_purchase_cannot_be_priced(kind: str, code: str | None, months: int | None, packs: list[tuple[int, int]]) -> None:
    with pytest.raises(ValueError):
        quote_purchase(kind=kind, plan_code=code, months=months, packs=packs)


def test_canonical_cart_merges_duplicate_pack_rows_for_idempotency() -> None:
    first = quote_purchase(kind="addon", packs=[(100, 1), (50, 1), (50, 1)])
    second = quote_purchase(kind="addon", packs=[(50, 2), (100, 1)])
    assert first == second

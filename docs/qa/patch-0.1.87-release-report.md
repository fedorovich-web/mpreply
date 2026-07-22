# Respio 0.1.87 Pricing/Menu Visual Recovery Report

Patch `0.1.87` is a focused recovery patch after the 0.1.86 pricing/menu visual direction was rejected during manual screenshot review.

## Root cause

- The 0.1.86 public navigation introduced a visible central rail/background around menu items, but the accepted direction requires a clean menu without a surrounding capsule, border or background.
- The pricing H1 scale grew beyond the accepted internal-page typography contract and created broken Russian wrapping.
- The right trial card used an oversized `400 ответов` number and a decorative bottom gradient stripe that competed with the page heading.
- The calculator range controls used a blue progress stripe that did not match the calmer Respio design system.
- Mobile header actions were not force-hidden by the 0.1.86 override layer, causing logo/login/CTA/hamburger collision.

## Changes

- Added `0.1.87` recovery classes to the public header, pricing hero and answer-pack calculator.
- Removed the visible nav rail treatment through the 0.1.87 override layer.
- Replaced nav hover/active with a clean underline/dot microinteraction.
- Restored the accepted desktop typography ceiling: H1 `58px`, H2 `48px`, H3 `28px`.
- Reduced the pricing trial number scale and removed the bottom decorative stripe.
- Replaced range progress fill with a neutral track and calmer thumb styling.
- Forced mobile header to logo + hamburger only below the tablet breakpoint.
- Synchronized version contracts to `0.1.87`.

## Not changed

- Pricing economics and package values.
- Marketplace integration claims.
- AI model/provider routing.
- Billing backend semantics.
- Visual snapshots.
- Large append-only CSS consolidation.

## Required manual verification

- Inspect `/pricing` at desktop widths before accepting visual snapshots.
- Inspect mobile header at 390px and 360px widths.
- Do not update visual snapshots until the recovered header/pricing/mobile state is accepted.

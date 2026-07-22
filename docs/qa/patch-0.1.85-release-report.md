# MPReply 0.1.85 Hero Visual Recovery Report

Patch `0.1.85` fixes the desktop Hero composition exposed by the first local Playwright visual run. It does not approve visual snapshots and does not change pricing, marketplace claims, AI routing, billing, or backend behavior.

## Root cause

The accumulated public-site CSS collapsed the homepage Hero to a single column at `max-width: 1450px`. The visual baseline run at 1440px therefore placed the product-flow scene below the copy, left a large blank first-screen area and made the first fold look broken.

## Changes

- Kept the Hero in a two-column composition down to compact desktop widths.
- Reduced the product-flow scene, H1 and column gaps for 1440/1366/1280px desktop widths.
- Deferred the single-column Hero layout to tablet/mobile widths.
- Added CSS contract assertions so 1440px visual baseline cannot silently collapse again.
- Synchronized version contracts to `0.1.85`.

## Not changed

- No marketplace/backend support claims were changed.
- No AI model naming cleanup was included.
- No visual snapshots were generated or approved.
- No broad CSS consolidation was attempted.

## Required manual visual check

After applying this patch, rerun `npm run test:visual`. The first run may still report missing snapshots if none exist yet. Inspect the generated screenshots first. Only update snapshots after the Hero composition is manually accepted.

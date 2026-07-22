# MPReply 0.1.102 — Payment foundation

## Scope

Backend-only payment foundation for prepaid answer packages:

- payment orders with organization-scoped idempotency;
- YooKassa redirect payment creation;
- provider-side payment/refund revalidation;
- webhook IP allowlist with explicit trusted-proxy handling;
- streamed webhook body limit before JSON parsing;
- durable webhook inbox and duplicate suppression;
- answer credit grant only after verified `payment.succeeded`;
- revocation of unspent purchased credits after a verified successful refund;
- manual-review state for partial refunds, consumed credits or active reservations;
- migration `20260722_0014`;
- application version `0.1.102`.

## Security decisions

- Provider secrets remain server-side and are loaded through `SecretStr` settings.
- No raw payment webhook payload is persisted; only its SHA-256 and verified metadata are stored.
- Webhook notification bodies are not trusted as payment truth. The API retrieves the current object from YooKassa before changing balance or order status.
- Forwarded client IP is honored only when the immediate peer belongs to an explicitly configured trusted proxy network.
- Payment amounts use integer minor units and reject sub-kopeck or non-finite provider values.
- Duplicate payment requests and duplicate webhook deliveries are serialized and idempotent.
- A released reservation from a refunded grant is revoked rather than restored to the spendable balance.
- Downgrade is blocked when payment, refund, webhook or revocation records exist, preventing silent financial data loss.

## Refund boundary

After a verified successful refund, all currently unspent credits from the corresponding purchase grant are frozen and revoked. A full refund is finalized automatically only when the amount matches the original payment and no credits were consumed or reserved. Partial refunds, consumed credits and active reservations are marked `refund_review_required` for manual financial reconciliation.

## Explicitly not included

- initiating refunds from MPReply;
- receipt/fiscalization configuration required for a real merchant account;
- invoice and legal-document workflows;
- production YooKassa credentials;
- live PostgreSQL/YooKassa integration tests.

## Public UI

No public page, public component, CSS, asset or visual snapshot is changed by this patch. Web changes are limited to version metadata and the existing health response.

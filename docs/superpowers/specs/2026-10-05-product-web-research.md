# Product research before replies

The product owner approved searching the public product name, article and brand through Groq browser_search before manual and automatic AI replies. The existing Groq key is used; customer messages, credentials and tenant identifiers are not sent to the search model.

Research uses openai/gpt-oss-20b with the required browser_search tool, low reasoning effort and no structured-output mode. The existing reply model retains its strict JSON output contract. Only excerpts and public HTTPS URLs returned in executed tool results become product context; assistant-written links do not qualify as evidence. Article/model matches are checked before accepting sources. Missing or mismatched evidence forces human review.

A product-scoped database lease coalesces concurrent searches without holding a database lock across network I/O. Verified results are cached for 24 hours in internal product metadata. Negative/error results have a one-minute retry delay. Import refresh preserves research only while product identity is unchanged. The cache is organization/account/product scoped. One generation reserves and consumes one reply credit; research and writing token usage are combined, and replay does not repeat either provider call.

When pages were found but seller/manufacturer identity does not fully match, provider excerpts are retained with needs_review for 24 hours. They are candidate evidence for human review and never enable automatic sending. This prevents repeated browsing and preserves the information needed to evaluate seller-branded replacement parts.

Connection access and loading health remain separate: a valid marketplace key with a newer loading failure is shown as connected with a loading issue. Sync errors remain visible and successful-sync timestamps are not advanced for partial/failed imports.

Verification covers manual/automatic routing, exact model mismatch, tool-only sources, public URL validation, identity invalidation, one-credit replay, and native PostgreSQL concurrent research. Production evidence must include the deployed commit, health and a real product research result; local mocks alone do not certify live provider access.

# Auth Abuse and CSRF Closure Design

## Scope

Close three confirmed authentication risks without changing the public product surface:

- unsafe cookie-authenticated API requests currently have no server-enforced CSRF signal;
- registration and refresh endpoints are not covered by the distributed authentication rate limiter;
- duplicate registration reveals whether an email is already registered.

The change does not add dependencies, database migrations, provider calls, capabilities, or a version bump.

## Verified baseline

- Browser API calls use cookies through `credentials: "include"`.
- Production CORS rejects wildcard origins and uses an explicit allowlist.
- The API already allows the `X-CSRF-Token` request header, but neither the browser client nor the backend currently enforces it.
- Login throttling uses Redis fixed windows, SHA-256 bucket subjects, an account bucket and an IP bucket, and fails closed when Redis is unavailable.
- Registration hashes a password and writes a user/session without throttling.
- Refresh rotates a durable token without throttling.
- The YooKassa webhook is an unsafe API request whose authentication is provider-specific and cannot supply the browser CSRF header.

## Security contract

### CSRF

Every `POST`, `PUT`, `PATCH`, and `DELETE` request below `/api/` must carry exactly `X-CSRF-Token: 1`. Safe methods and CORS preflight remain unaffected. The exact path `/api/payments/webhooks/yookassa` is exempt because it is a non-browser provider callback with its own request and network validation.

The shared web API client adds the header automatically for unsafe methods. It does not add it to safe methods. The mechanism relies on credentialed CORS preflight plus the existing exact production origin allowlist, matching the OWASP custom-request-header pattern for AJAX APIs.

The middleware returns a generic `403` response and no internal details. CORS remains the outer middleware so rejected browser requests receive the correct CORS response headers.

### Authentication throttling

The existing fixed-window implementation becomes action-aware. Each action consumes two independent buckets and blocks on either bucket:

| Action | Subject bucket | Subject limit | IP limit | Window |
| --- | --- | ---: | ---: | ---: |
| Login | normalized email | 20 | 100 | 900 seconds |
| Registration | normalized email | 5 | 20 | 3600 seconds |
| Refresh | raw refresh token | 120 | 600 | 900 seconds |

All bucket subjects, including IP addresses and refresh tokens, are SHA-256 digests. The defaults are configurable operational guardrails, not product promises. Validation bounds prevent zero, negative, or unbounded settings. Store failures remain fail-closed with `503`; blocked requests return `429` with `Retry-After`.

Registration is checked before password hashing or database access. Refresh is checked after confirming the cookie exists but before token lookup or rotation. Logout remains unthrottled so a user can always revoke credentials.

### Account enumeration

A unique-email conflict rolls back the session and returns `400` with a generic registration failure message. The response does not confirm whether the email exists.

## Verification

- Backend behavior tests cover missing/wrong/correct CSRF headers, safe requests, preflight, and the webhook exemption.
- Rate-limit tests cover action-specific hashed keys, configured limits, fail-closed behavior, and route-level early rejection.
- Auth service tests cover rollback and the generic duplicate-registration response.
- Frontend unit tests cover unsafe-header injection and safe-method omission.
- Integrity and production configuration checks cover all rate-limit settings and the CSRF contract.
- One grouped targeted RED is required before implementation, followed by one grouped targeted GREEN and one final affected backend/frontend/security gate.

## References

- OWASP Authentication Cheat Sheet, Login Throttling
- OWASP Cross-Site Request Forgery Prevention Cheat Sheet, Custom Request Headers
- OWASP REST Security Cheat Sheet, `429 Too Many Requests`

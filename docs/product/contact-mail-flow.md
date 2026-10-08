# Contact messages

The user confirmed this delivery setup on 30 September 2026:

- Resend handles outgoing mail from `MPReply <no-reply@mpreply.ru>`, including registration, password reset and messages submitted from the website.
- `support@mpreply.ru` is the support mailbox at the user's separate mail service. Its domain/mailbox configuration is managed there.
- Contact form messages are addressed to that support mailbox. `Reply-To` contains the visitor's validated email address, so a support agent can reply from the mailbox.

The public form uses `POST /api/contact`, not a mailto submission. The backend validates name, email, topic, message, UUID request key and affirmative consent. It enforces the existing CSRF and configured rate-limit protections, escapes HTML, and sends via the shared Resend client. Delivery failures return HTTP 503, not a success response.

The browser retains input on failure, reuses the UUID for an unchanged retry, assigns a new UUID for changed content, and disables duplicate submissions while waiting. Consent links to the localized privacy policy. The form and FAQ use the standard public shell.

Deployment variables already in `.env.example` are `RESEND_API_KEY`, `TRANSACTIONAL_EMAIL_FROM` and `SUPPORT_EMAIL`. The latter two should be `MPReply <no-reply@mpreply.ru>` and `support@mpreply.ru` for the confirmed setup. Do not expose the Resend key to the frontend or add support mailbox passwords to the application.

The frontend build also needs `NEXT_PUBLIC_API_BASE_URL` pointing to the deployed backend. Missing production configuration blocks API requests; it does not fall back to a local server.

Local tests replace the provider transport. They prove the request/delivery contract and failure handling, not actual inbox receipt. Actual receipt remains a separate check against the configured deployment.

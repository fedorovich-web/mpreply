# Sprint 1 QA checklist — Auth, organizations, RBAC

## Backend

- [ ] `POST /api/auth/register` creates an active user.
- [ ] `POST /api/auth/login` rejects invalid credentials.
- [ ] `POST /api/auth/login` sets an HTTP-only cookie for valid credentials.
- [ ] `GET /api/auth/me` returns the authenticated user.
- [ ] `POST /api/auth/logout` clears the auth cookie.
- [ ] `POST /api/organizations` creates an organization with `default_response_mode=auto`.
- [ ] The organization creator receives the `owner` role.
- [ ] `GET /api/organizations` returns only organizations where the user is a member.
- [ ] `PATCH /api/organizations/{id}` requires `owner` or `admin`.
- [ ] User cannot access another organization's data.
- [ ] Audit logs are created for registration, login, organization creation and organization updates.

## Frontend

- [ ] `/auth/register` exists.
- [ ] `/auth/login` exists.
- [ ] `/app` explains Sprint 1 state and auto-first default.
- [ ] `/app/dashboard` exists.
- [ ] No hardcoded color/spacing/radius/shadow values are used outside CSS variables.

## Security

- [ ] No secret env variable is exposed as `NEXT_PUBLIC_*`.
- [ ] No API key or auth secret is committed to the repo.
- [ ] `.env.example` contains placeholders only.

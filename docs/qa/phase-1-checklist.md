# Phase 1 QA checklist

## Backend

- [ ] `/health` returns 200.
- [ ] settings load from environment.
- [ ] secrets are represented as secret values in settings.
- [ ] log scrubber redacts API keys.
- [ ] credential encryption service encrypts/decrypts with valid key.
- [ ] credential fingerprint does not expose the original key.

## Frontend

- [ ] landing page renders.
- [ ] app placeholder renders.
- [ ] all visual values come from CSS variables.
- [ ] focus-visible state is visible.
- [ ] mobile hero layout does not break.

## Docker

- [ ] postgres healthcheck passes.
- [ ] redis healthcheck passes.
- [ ] api healthcheck passes.
- [ ] web starts after api.

## Security

- [ ] `.env` is ignored.
- [ ] `.env.example` contains placeholders only.
- [ ] frontend env contains only `NEXT_PUBLIC_*` public values.
- [ ] no marketplace API key fixture is committed.

# Respio

Production-grade SaaS foundation for auto-first marketplace replies.

## Product baseline

Respio is an auto-first SaaS for marketplace sellers. The default response mode is automatic: Respio generates and sends replies through supported marketplace APIs when automation rules and safety checks allow it. Semi-automatic mode is available as an explicit option: AI prepares a draft, and a manager confirms sending.

## Security baseline

- Marketplace API credentials are backend-only.
- Credentials are stored encrypted at rest.
- Credentials are never returned to the frontend after creation.
- Credentials are never logged.
- OpenRouter API key is backend-only.
- Every critical action must be written to audit logs.

## Frontend baseline

All UI values must be tokenized via CSS variables from the first commit:
colors, gradients, typography, spacing, margins, paddings, gaps, radius, shadows, hover, active, focus, layout sizes and dashboard density values.

## Repository layout

```text
apps/
  api/          FastAPI backend
  web/          Next.js frontend
  worker/       background worker placeholder
  scheduler/    scheduler placeholder
packages/
  design-tokens/
  ui/
  contracts/
infra/
  docker/
  coolify/
docs/
  adr/
  security/
  architecture/
  api/
  product/
  qa/
  deployment/
```

## Local development target

```bash
cp .env.example .env
cd infra/docker
docker compose -f docker-compose.local.yml up --build
```

This foundation intentionally contains no production marketplace credentials, no OpenRouter keys, and no business secrets.

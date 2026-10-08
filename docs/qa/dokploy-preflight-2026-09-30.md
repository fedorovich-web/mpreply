# Dokploy preflight — 30 September 2026

The user supplied the Dokploy project and explicitly requested configuration through their open Brave tab. A Docker Compose service, GitHub source, public environment settings and three HTTPS domain records were saved. The user then explicitly confirmed PostgreSQL/Redis creation and creation of auth/encryption secrets. Both private database services were created and deployed; the MPReply Compose application has not been deployed. No DNS record or Git ref was changed.

## Saved Dokploy configuration

- Panel: `https://cp.flatero.ru` (Dokploy v0.30.8).
- Project: `MPReply`, ID `z24Eda-x52Bth6ya0-Dm2`.
- Environment: `production`, ID `msMn4v-cS4gNPg9_9VRRY`; originally empty.
- Compose service: `MPReply`, ID `V1n3_48m2Qk51ZMoBl6P9`, app name `mpreply-mpreply-8oaeli`.
- Server: Dokploy Server, public IP `5.175.211.212`.
- GitHub account: `Dokploy-2026-09-09-vljj73`; repository `fedorovich-web/mpreply`, branch `main`, path `./infra/docker/docker-compose.production.yml`.
- Autodeploy is disabled for MPReply. No Deploy, Rebuild or Start action was performed for the MPReply Compose application. PostgreSQL and Redis were deployed after the user's confirmation.
- `mpreply.ru` and `app.mpreply.ru` route to `web:3000`; `api.mpreply.ru` routes to `api:8000`. All use `/`, HTTPS and Let's Encrypt, without path stripping. The records take effect on deployment; certificate issuance is not yet verified.
- DNS A records for root, app, API and www were resolved locally and all returned `5.175.211.212`. No DNS modification was needed. The www redirect is still pending.
- Public environment values were saved: MPReply identity/version, three public URLs, frontend public URLs/contact address, mail sender/support address, secure/lax cookies, explicit CORS/allowed-host arrays, security headers, rate limiting and INFO logging. Internal database/Redis URLs and newly generated auth/encryption secrets were subsequently saved. Provider keys, trusted proxy network and deployment revision remain unset.

Remote Preview Compose returned the old `respio-production` manifest with `APP_NAME=Respio` and services `migrate`, `api`, `worker`, `web`; it lacks the current scheduler. This confirms that remote main is not the locally verified working tree. Do not deploy that old preview as the completed MPReply revision.

Evidence: [saved domains](dokploy-domains-2026-09-30.jpg), [prepared PostgreSQL form](dokploy-postgres-prepared-2026-09-30.jpg), [running private databases](dokploy-databases-running-2026-09-30.jpg).

- PostgreSQL ID `2zaqjwaUGIlnwfHO8Oa5J`, internal host `mpreply-postgres-prod-sowtfb`, database/user `mpreply`, image `postgres:18.1-bookworm`, port 5432. Persistent volume mounts `/var/lib/postgresql/18/docker`.
- Redis ID `cQsRVmPZ6FuVLWZgm5kzS`, internal host `mpreply-redis-prod-yrat0v`, image `redis:8.4.0-bookworm`, port 6379. Persistent volume mounts `/data`.
- Both join the default `dokploy-network`; external-port fields remain empty. Docker UI showed both running with container ports only, without published host-port bindings. PostgreSQL logs confirmed readiness after initialization; Redis logs confirmed readiness.
- Redis logs report `vm.overcommit_memory` is not enabled on the host. Host tuning, actual AOF/recovery behavior and backup/restore remain unverified. No host-wide setting was changed.
- PostgreSQL and Redis passwords were generated in Dokploy. The app auth secret uses 48 random bytes; the Fernet encryption key uses 32 random bytes with URL-safe Base64. No secret was written to repository files.

## Secret-handling correction

A diagnostic DOM snapshot inadvertently captured the masked environment editor's plaintext after navigation had not completed. This put the newly created connection passwords and auth/encryption values in tool output. The values are not repeated in this document. The user was informed; replace these initial secrets before application launch and update both internal connection URLs. Browser policy requires user handoff for credential changes.

The user confirmed PostgreSQL password replacement. Its updated internal connection URL contains a different password, and the new `DATABASE_URL` was saved to MPReply and checked after switching tabs. The password was read only into the browser session's variables, with no value printed. The URL encodes the password component so reserved characters cannot alter URL parsing or Compose interpolation. The rest of the environment was preserved from the rendered editor lines, rather than overwritten from an older cached string.

The user confirmed Redis password replacement. Its updated internal URL contains a different password, and the new `REDIS_URL` was saved to MPReply and verified after switching tabs. Both updated URL password components are encoded, and Redis database 0 is explicit. The browser-tool clipboard handoff for auth/encryption keys was not available to the user, so no successful key replacement was claimed.

On 1 October 2026 the browser session was restored through the user's current Brave project tab. A replacement handoff file was prepared from the current 24-line environment, preserving all settings and changing only the two auth/encryption keys. File: `%LOCALAPPDATA%/MPReply/deployment-handoff/production-env.txt`, outside the Git checkout. Its directory/file ACL granted access only to the current Windows user and SYSTEM. The contents were not printed. A file-open request was queued in Codex, and a direct local file link was given to the user. The user confirmed insertion and Save in Dokploy. Both new values were verified after switching away from and back to Environment; values were not printed. The temporary file was deleted and its absence verified. The initial exposed credentials and keys have all been replaced, and both updated database URLs are saved. The current tab is left on MPReply Domains; the environment editor is masked.

Evidence: [PostgreSQL handoff](dokploy-password-handoff-2026-09-30.jpg), [Redis handoff](dokploy-redis-password-handoff-2026-09-30.jpg), [file handoff editor](dokploy-key-file-handoff-2026-10-01.jpg), [post-rotation configuration](dokploy-after-key-rotation-2026-10-01.jpg).

## Production healthcheck correction

Both the API Dockerfile liveness command and the production Compose readiness command previously sent `Host: 127.0.0.1`, which production's explicit trusted-host list rejects. Two reproductions failed with HTTP 400 `Invalid host header`. Both commands now connect locally while supplying the host from the required `API_BASE_URL`. They do not widen the production allowed-host list or call the public endpoint.

Regression evidence: three healthcheck tests pass, including preservation of loopback-host rejection; the final full API suite passed 478 tests with 15 skips. Ruff and strict Pyright pass after the test annotation repair; integrity and scoped diff checks pass. These are local checks, not container/runtime certification. Full-suite log: `%TEMP%/mpreply-api-dokploy-health-final.log`.

## Candidate and routing

Current local checkout: `feat/auth-email-resend`, HEAD `42e5810`, with extensive uncommitted product/backend/frontend changes. The new automatic-draft migration is `20260930_0018`. Deploying the existing remote commit does not deliver this working tree.

The existing deployment checklist selects a Docker Compose application with `./infra/docker/docker-compose.production.yml` and requires a verified delivery revision before production. It specifies production from `main`; this assessment does not merge the current checkout or select a different branch.

| Host | Compose service | Container port |
| --- | --- | --- |
| `mpreply.ru` | `web` | 3000 |
| `app.mpreply.ru` | `web` | 3000 |
| `api.mpreply.ru` | `api` | 8000 |

`www.mpreply.ru` must canonicalize to `mpreply.ru`. Configure routing in Dokploy's Domains UI, with DNS pointing to the actual server and HTTPS verified. PostgreSQL and Redis remain private and have separate staging/production data.

## Existing deploy components

The manifest defines `migrate`, `api`, `worker`, `scheduler` and `web`. PostgreSQL and Redis are provisioned separately. The worker command includes `app.workers.automatic_drafts`; the scheduler discovers imported messages and dispatches automatic drafts, credit maintenance and queued replies.

Migration runs `alembic upgrade head`. The API readiness check tests PostgreSQL and Redis; the web exposes `/api/health`. Current local API readiness still returns 503 without Redis. Local service tests passed, including the isolated PostgreSQL automatic-draft/credit suite, but no container build or complete server runtime was exercised in this assessment.

## Items to resolve before deployment

1. Verify application-to-service connectivity when the application is deployed. PostgreSQL and Redis exist and run; initial-secret replacement and updated URLs are complete.
2. Assemble and review the intended delivery revision from the dirty checkout, preserving unrelated changes. Commit/push/merge are not included in this assessment.
3. Populate the existing production environment inventory through Dokploy, including database/Redis URLs, auth and encryption secrets, trusted proxy network, explicit hosts/origins and deployment revision. Do not commit or paste real secret values into this report.
4. Reconcile AI configuration with the agreed domain-stage provider work. The current implementation and production manifest still use Groq and require `GROQ_API_KEY`; they do not implement OpenRouter or the approved public model catalog. A domain alone does not change that provider path.
5. Configure Resend for transactional/contact mail. The production manifest requires `RESEND_API_KEY`; domain verification and actual registration/reset/contact delivery have not been tested.
6. Verify the complete server runtime: image builds, migration 0018, PostgreSQL/Redis connectivity, API/web health, worker/scheduler execution, restart recovery and backup/restore. The local Docker prohibition remains respected.
7. Resolve release verification boundaries. The latest visual gate remains 9 passed / 10 failed with baselines preserved; legal pages remain drafts, and the previously documented template/grammar/plan-entitlement/budget implementation gaps remain open.

## Deployment sequence

After the project/source revision and environment are resolved, first bring up an isolated verification environment. Validate migrations and service health, then HTTPS routing, RU/EN demo entry and read-only enforcement, registration/session flows and background recovery. Connect and evaluate the chosen AI provider, verify mail delivery, and implement paid credit issuance through authoritative payment events at the agreed launch stage. Marketplace automatic sending requires its authorized seller-account and external-write checks before enabling real execution.

The next required inputs are a reviewed Git delivery decision for the staged candidate and provider credentials entered through the authorized secure workflow. The local origin still uses the old `fedorovich-web/respio.git` address; the user explicitly selected `fedorovich-web/mpreply` for Dokploy. No local remote was modified. Read-only `git ls-remote` confirmed remote `main` at `3f245838353e386bb56c45fb63ac19b22ee9daa2` and remote `feat/auth-email-resend` at `7509915dbeef47418e068a20c7893bac74746368`; neither equals local HEAD `42e5810`. The remote feature revision is an ancestor of local HEAD, so the proposed push can be fast-forward. No fetch, push, commit or merge was performed.

The candidate is staged for review: 609 paths, 44,308 insertions and 6,295 deletions; `.handoff/` and `apps/cms/` remain outside the index. The index was empty before preparation. Exact current production-secret strings and URL password components were checked against 602 existing candidate files, with zero matches; this is not a general secret-audit certification. Four whitespace findings were removed without changing body content (three extra EOF blank lines and trailing SVG whitespace). The staged diff check passes. The proposed delivery is one commit on the existing feature branch, a normal push to `fedorovich-web/mpreply` and a draft PR to `main`; it does not include a merge or application deployment. Inventory: [dokploy-delivery-candidate-2026-09-30.md](dokploy-delivery-candidate-2026-09-30.md).

References: [existing deployment checklist](../../infra/dokploy/deployment-checklist.md), [environment inventory](../../infra/dokploy/.env.production.example), [backend status](backend-readiness-status-2026-09-30.md), [automatic-draft evidence](automatic-drafts-verification-2026-09-30.md), [official Compose domain documentation](https://docs.dokploy.com/docs/core/docker-compose/domains).

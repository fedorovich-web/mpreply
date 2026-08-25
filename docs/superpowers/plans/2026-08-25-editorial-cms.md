# Editorial CMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an isolated Payload editorial CMS and connect published blog/resources content to the MPReply public site without coupling CMS failures or credentials to the customer application.

**Architecture:** `apps/cms` is a separately built Payload application with its own PostgreSQL and media volume. `apps/web` consumes a small normalized server-only API, validates every response, caches successful published content and accepts authenticated revalidation webhooks. Production deployment remains staged and does not touch the existing VDS services during implementation.

**Tech Stack:** Payload 3.88.0, Next.js 16.2.11, React 19.2.3, TypeScript 5.9.3, PostgreSQL, Lexical, Zod 4.2.0, Vitest 4.1.10, Docker Compose, Coolify.

**Spec:** `docs/superpowers/specs/2026-08-25-editorial-cms-design.md`

## Global Constraints

- Work only on `codex/0.1.104-backend`; do not create a branch or worktree.
- Do not merge, deploy, tag or bump version `0.1.103`.
- Do not call marketplace, OpenRouter or CMS production APIs.
- Keep CMS authentication, database, media and secrets separate from MPReply.
- Never expose a CMS token, webhook secret, database URL or editor session to the browser or logs.
- Do not allow arbitrary HTML, scripts or routes from CMS content.
- Use exact dependency versions and run an audit before accepting new packages.
- Preserve the current static public content when CMS is unconfigured locally.
- Run focused checks during implementation and one fresh full affected-package verification before completion.

## File map

### Design and dependency boundary

- Create `apps/cms/package.json` and `apps/cms/package-lock.json` — exact CMS runtime and check commands.
- Create `apps/cms/tsconfig.json`, `apps/cms/next-env.d.ts`, `apps/cms/next.config.mjs` — strict Payload/Next compilation.
- Create `apps/cms/.env.example` — names only and safe local placeholders.
- Create `apps/cms/src/payload.config.ts` — database, editor, collections and generated type path.
- Create `apps/cms/src/payload-types.ts` — generated Payload types.

### CMS content and policy

- Create `apps/cms/src/access/contentAccess.ts` — role-aware draft/publish/delete rules.
- Create `apps/cms/src/collections/Users.ts` — CMS-only authenticated users.
- Create `apps/cms/src/collections/Categories.ts` — stable taxonomy.
- Create `apps/cms/src/collections/Media.ts` — safe image uploads.
- Create `apps/cms/src/collections/Content.ts` — editorial schema, versions and publication validation.
- Create `apps/cms/src/hooks/revalidateContent.ts` — bounded signed webhook delivery after publication changes.
- Create `apps/cms/src/app/(payload)/*` — generated Payload admin/API routes.
- Create `apps/cms/tests/*.test.ts` and `apps/cms/vitest.config.ts` — policy and schema contracts.

### Public web integration

- Create `apps/web/lib/cms/config.ts` — server-only environment parsing.
- Create `apps/web/lib/cms/schema.ts` — strict provider and normalized public schemas.
- Create `apps/web/lib/cms/client.ts` — bounded published list/detail reads and failure categories.
- Create `apps/web/lib/cms/lexical.tsx` — allowlisted rich-text renderer.
- Create `apps/web/app/api/cms/revalidate/route.ts` — HMAC and replay-safe cache invalidation.
- Create `apps/web/app/blog/[slug]/page.tsx` and `apps/web/app/resources/[slug]/page.tsx` — server-rendered detail routes.
- Modify `apps/web/app/blog/page.tsx`, `apps/web/app/resources/page.tsx`, `apps/web/app/sitemap.ts` — published CMS listings with static development fallback.
- Create `apps/web/tests/unit/cms-*.test.ts` — schema, client, metadata and webhook contracts.

### Containers and operations

- Create `apps/cms/Dockerfile` and `apps/cms/.dockerignore` — standalone non-root image.
- Modify `infra/docker/docker-compose.production.yml` — isolated CMS service contract and persistent media/cache volumes.
- Modify `infra/coolify/service-map.md`, `infra/coolify/deployment-checklist.md`, `infra/coolify/.env.production.example` — CMS topology and complete required variables.
- Modify `.env.example` and `README.md` — local configuration and operator boundary.

---

### Task 1: Build the isolated CMS application and content policy

**Files:** CMS dependency, configuration, collection, access, hook and unit-test files from the file map.

**Interfaces:**
- Produces `isAdmin`, `canUpdateContent`, `canPublishContent`, `Content`, `Categories`, `Media`, `Users` and `createRevalidationSignature`.
- Exposes Payload REST routes below `/api`, admin UI below `/admin` and health below `/api/health`.

- [ ] **Step 1: Write RED access and schema tests**

```ts
expect(isAdmin({ req: { user: { role: "admin" } } } as never)).toBe(true);
expect(canPublishContent({ req: { user: { role: "editor" } } } as never)).toBe(false);
expect(Content.versions).toMatchObject({ drafts: { schedulePublish: true } });
expect(Media.upload).toMatchObject({ mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"] });
```

- [ ] **Step 2: Run `npm test -- --run` from `apps/cms` and confirm missing-module failures**
- [ ] **Step 3: Install the exact packages from the Tech Stack, generate the lockfile and run `npm audit --omit=dev`**
- [ ] **Step 4: Implement strict role helpers and the four collections**
- [ ] **Step 5: Add the publish hook that rejects non-approved publication and sends a signed bounded webhook without logging its secret**
- [ ] **Step 6: Generate Payload types and run `npm test`, `npm run typecheck`, `npm run lint` and `npm run build`**
- [ ] **Step 7: Commit only Task 1 files with `feat(cms): add isolated editorial content service`**

### Task 2: Add the server-only public content contract

**Files:** `apps/web/lib/cms/*`, `apps/web/app/api/cms/revalidate/route.ts`, and `apps/web/tests/unit/cms-*.test.ts`.

**Interfaces:**
- Produces `CMSContentSummary`, `CMSContentDetail`, `listPublishedContent(kind?)`, `getPublishedContent(kind, slug)`, `CMSUnavailableError`, `CMSNotFoundError` and `verifyRevalidationRequest(request)`.
- Consumes only server environment values `CMS_API_URL`, `CMS_READ_TOKEN`, `CMS_REVALIDATION_SECRET` and `CMS_REQUEST_TIMEOUT_MS`.

- [ ] **Step 1: Write RED tests for strict projection, extra provider fields, timeouts, authoritative not-found and HMAC timestamp/replay rejection**

```ts
expect(parseContentDetail(providerFixture).slug).toBe("negative-review-guide");
await expect(getPublishedContent("article", "missing")).rejects.toBeInstanceOf(CMSNotFoundError);
await expect(verifyRevalidationRequest(tamperedRequest)).resolves.toBe(false);
```

- [ ] **Step 2: Run `npm run test:unit -- cms` from `apps/web` and confirm missing-module failures**
- [ ] **Step 3: Implement server-only configuration and Zod projection without exporting credentials**
- [ ] **Step 4: Implement fetch reads with `AbortSignal.timeout`, published filters, cache tags and safe error classes**
- [ ] **Step 5: Implement a `POST`-only revalidation route with a 64 KiB body limit, HMAC-SHA256, constant-time comparison and five-minute timestamp tolerance**
- [ ] **Step 6: Run the focused CMS unit tests, typecheck and lint**
- [ ] **Step 7: Commit only Task 2 files with `feat(web): add secure CMS content client`**

### Task 3: Replace static catalogs with resilient CMS-backed pages

**Files:** blog/resources list and detail pages, Lexical renderer, sitemap, public content tests and existing static fallback module.

**Interfaces:**
- Consumes the Task 2 normalized types only; React pages never inspect a Payload response directly.
- Produces server-rendered `/blog/[slug]` and `/resources/[slug]` pages plus metadata and sitemap records.

- [ ] **Step 1: Write RED tests for one H1, safe rich-text nodes, metadata, noindex exclusion, static fallback and CMS-outage behavior**
- [ ] **Step 2: Run the focused page/unit tests and confirm RED**
- [ ] **Step 3: Implement the allowlisted Lexical renderer; reject raw HTML, scripts and unsupported nodes**
- [ ] **Step 4: Convert list pages to CMS summaries while retaining existing local static entries when CMS is unconfigured**
- [ ] **Step 5: Add detail routes with authoritative `notFound()` only for `CMSNotFoundError`; surface provider outages as recoverable service failures**
- [ ] **Step 6: Add only published, indexable CMS content to the sitemap and revalidate list/detail/sitemap tags from the webhook**
- [ ] **Step 7: Run `npm run qa:web`, then browser E2E/a11y/visual/Lighthouse gates after the UI changes are stable**
- [ ] **Step 8: Commit only Task 3 files with `feat(web): publish CMS-backed resources`**

### Task 4: Add production container and Coolify contracts

**Files:** CMS Docker files, production Compose, Coolify docs/env template, root environment example and README.

**Interfaces:**
- Produces services `cms`, `cms-postgres` as an externally provisioned Coolify resource, volume `cms-media`, web cache volume and domain `cms.mpreply.ru`.
- Consumes no marketplace or OpenRouter credential during container validation.

- [ ] **Step 1: Add a contract test/script that fails when CMS/database ports are published or required variables are absent**
- [ ] **Step 2: Build a pinned non-root standalone CMS image with a health check**
- [ ] **Step 3: Add CMS/web environment variables and named volumes without exposing PostgreSQL, Redis or CMS internal ports**
- [ ] **Step 4: Remove the obsolete hard requirement for `OPENROUTER_API_KEY`; document database-managed configuration with optional environment bootstrap**
- [ ] **Step 5: Complete the production env template for every variable required by Compose and document staging-before-production order**
- [ ] **Step 6: Run Compose config validation with synthetic secrets, Docker image builds and the deployment contract test**
- [ ] **Step 7: Commit only Task 4 files with `ops: add isolated CMS deployment contract`**

### Task 5: Fresh full verification and handoff

**Files:** no implementation changes unless a verification failure identifies a real defect; evidence remains redacted and ignored.

**Interfaces:** Produces a factual readiness report separating local correctness, container readiness, DNS/TLS state and live deployment state.

- [ ] **Step 1: Run all CMS tests, audit, typecheck, lint and production build once from a clean output state**
- [ ] **Step 2: Run affected API integrity/backend checks after the Compose/OpenRouter configuration correction**
- [ ] **Step 3: Run the complete required web static and browser gates once**
- [ ] **Step 4: Run `git diff --check`, inspect tracked files for secrets and review the complete diff**
- [ ] **Step 5: Recheck authoritative DNS for `app`, `api` and `cms`; perform no server mutation**
- [ ] **Step 6: Push the existing branch only after every local gate is green; do not deploy or merge**

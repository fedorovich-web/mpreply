# Editorial CMS Design

**Date:** 2026-08-25
**Status:** Approved for implementation
**Scope:** MPReply editorial content and production deployment foundation

## Context

MPReply currently keeps the blog cards in `apps/web/app/blog/page.tsx` and the
resources catalog in `apps/web/lib/public-resources.ts`. Publishing therefore
requires a code change and a web deployment. The approved product boundary is a
headless CMS for blog posts, practical resources and future editorial SEO pages.
The customer workspace, MPReply superadmin workspace, authentication,
marketplace data and LLM configuration remain in the existing application.

The target VDS also hosts an existing service outside this repository. MPReply
must use its own Coolify project, networks, stateful resources and domains. This
design does not authorize a server change or production deployment.

## Goals

- Add a self-hosted editorial CMS aligned with the existing Next.js and
  PostgreSQL stack.
- Give editors a usable draft and review flow without access to MPReply data.
- Give administrators exclusive publish, unpublish and delete authority.
- Serve only normalized published content to the public Next.js application.
- Preserve the last successfully loaded public content during a temporary CMS
  outage.
- Keep public metadata, sitemap entries and canonical URLs consistent with the
  repository SEO policy.
- Add a staged, reversible deployment contract for `cms.mpreply.ru`.

## Non-goals

- Editing the customer workspace, MPReply admin workspace, pricing, legal text,
  authentication pages or application navigation through the CMS.
- Giving CMS users access to marketplace credentials, LLM keys, organizations,
  billing records or the MPReply transactional database.
- A free-form page builder, arbitrary HTML, arbitrary JavaScript or arbitrary
  route creation.
- Migrating every existing public product page in the first increment.
- Deploying to the VDS, changing ingress, issuing certificates or changing DNS.
- Marketplace or OpenRouter runtime certification.

## Selected approach

Add Payload CMS `3.88.0` as a separate application at `apps/cms`. Payload uses
the same pinned Next.js `16.2.11`, React `19.2.3`, PostgreSQL and TypeScript
families as the public frontend, but it builds and runs as an independent
container. It owns a dedicated database and media volume.

Embedding Payload into `apps/web` is rejected because CMS startup, migrations,
dependencies and failures must not share the customer-facing process. Directus
is rejected for this increment because it adds a second application ecosystem
without a material advantage for the approved structured editorial scope.
Git-managed MDX is rejected because it does not give non-technical editors a
real publishing interface.

## Service and trust boundaries

```text
mpreply.ru       -> apps/web public site
app.mpreply.ru   -> apps/web customer and MPReply admin workspaces
api.mpreply.ru   -> apps/api
cms.mpreply.ru   -> apps/cms editor/admin interface

MPReply PostgreSQL/Redis -> api, worker, scheduler only
CMS PostgreSQL/media     -> cms only
CMS read token           -> web server only
CMS webhook secret       -> cms and web server only
```

The browser never receives the CMS read token. The web application fetches CMS
data server-side. CMS roles do not authenticate against MPReply and cannot query
its API by default.

## Content model

### Users

`users` is authentication-enabled and contains `email` plus `role`:

- `admin`: manage users, publish, unpublish, delete and restore content;
- `editor`: create and update drafts, request review and use preview.
- `service`: non-interactive, read-only access to published content for the web
  server; it cannot access the CMS admin interface.

The first administrator is bootstrapped operationally. No default credentials
are committed.

### Categories

`categories` contains a unique lowercase `slug`, Russian `name` and optional
plain-text `description`. Editors may read categories. Administrators manage
the taxonomy so route and filter values remain stable.

### Media

`media` owns image uploads. Every image requires concise alternative text.
Allowed MIME types are JPEG, PNG, WebP and AVIF. Executable uploads and SVG are
not accepted. Production media is stored on a dedicated persistent volume in
the first increment; object storage is a later operational migration if needed.

### Content

One `content` collection covers the initial editorial types:

- `article`;
- `guide`;
- `checklist`;
- `methodology`;
- `template`.

Each document contains:

- unique lowercase `slug`;
- `title` and `excerpt`;
- structured Lexical rich text `body`;
- `kind`, category and zero or more marketplace tags;
- optional cover image and required cover alt through the media relation;
- optional author display name;
- editorial state `draft`, `in_review`, `approved`;
- Payload `_status` for draft/published separation;
- publication timestamps;
- `seo.title`, `seo.description`, optional canonical override and `seo.noindex`.

The first public routes are `/blog/[slug]` for `article` and
`/resources/[slug]` for every other kind. Slugs cannot create `/app`, `/api`,
`/admin` or any other route. Arbitrary raw HTML is not part of the schema.

## Publishing rules

Editors can create and update drafts. They can move a draft to `in_review`, but
cannot set `_status=published`, unpublish or delete. Administrators can approve
and publish. A server-side hook rejects publication unless the editorial state
is `approved` and all required content and SEO fields validate.

Payload versions, drafts and scheduled publishing are enabled. Preview uses an
expiring signed URL and always sends `X-Robots-Tag: noindex, nofollow`. Public
read access returns published documents only. The website uses an internal
read-only service token rather than granting anonymous CMS API access.

## Public web contract

`apps/web/lib/cms` owns the integration boundary:

- strict environment parsing;
- bounded server-side requests;
- Zod validation and projection of provider responses;
- canonical content types used by React pages;
- last-known-good cache behavior;
- webhook signature verification and path revalidation.

The public UI never renders provider HTML. Lexical nodes are rendered through an
explicit allowlist of paragraphs, headings, lists, links and text marks. Unknown
nodes fail closed during normalization. External links receive safe rel values.

If CMS configuration is absent in development, the current static cards remain
available. Production configuration requires the CMS URL, read token and
webhook secret. A CMS timeout does not erase the last successful published
snapshot. A previously unknown uncached slug returns a temporary service error,
not a false `404`.

## Cache and invalidation

Published list and detail responses use Next.js server caching tagged by
collection and content id. A signed CMS webhook revalidates the affected detail
route, blog/resources listings and sitemap. The webhook accepts a bounded JSON
body, verifies an HMAC-SHA256 signature with constant-time comparison and rejects
replays using a timestamp tolerance.

The production web container mounts a cache volume so a web restart does not
discard all previously fetched content. Cache behavior is covered by unit tests;
it is not treated as a substitute for CMS/database backups.

## SEO behavior

- Only published, indexable documents appear in sitemap output.
- Each detail page has one H1, server-rendered body content, a canonical URL and
  unique title/description.
- `noindex` content is excluded from the sitemap and sends robots metadata.
- Unknown slugs are `404` only when CMS returns an authoritative not-found
  response; provider failure is a recoverable service error.
- Structured data is added only for fields visible on the page and never
  invents ratings, offers, authors or organization facts.

## Deployment sequence

1. Build and test `apps/cms` and the web integration locally with synthetic data.
2. Add isolated staging CMS PostgreSQL and media storage.
3. Import the current blog/resource entries as drafts, review them and publish.
4. Verify preview, publication, cache invalidation, sitemap, backups and restore.
5. Publish `cms.mpreply.ru` with TLS and restricted editor access.
6. Verify `app.mpreply.ru` and `api.mpreply.ru` DNS and TLS.
7. Deploy the complete MPReply staging contour and run smoke tests.
8. Production cutover remains blocked until the repository deployment checklist
   gates are satisfied.

## Verification

- CMS unit tests cover access control, publication validation and hook payloads.
- Web unit tests cover schemas, failure classification, cache fallback, metadata
  and webhook verification.
- CMS and web typecheck, lint and production builds pass.
- Existing web design, E2E, accessibility, visual and Lighthouse gates remain
  green after the public pages start consuming CMS content.
- Container configuration validates without exposing PostgreSQL, Redis or CMS
  secrets publicly.

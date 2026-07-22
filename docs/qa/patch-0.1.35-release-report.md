# MPReply 0.1.35 — visual baseline restoration

Date: 2026-07-16

## Status

Candidate for user visual verification.

## Scope

- Rejects and supersedes the visual changes introduced in `0.1.34`.
- Restores the exact `0.1.33` Hero Canvas implementation used for `mpreply-0.1.33-desktop-visual-qa-final.png`.
- Adds the previously omitted runtime asset `apps/web/public/brand/mpreply-ai-core-reference.png` to the distributable patch. Its omission caused the broken-image placeholder and missing central MPReply planet in the user's environment.
- No new orbit geometry, planet styling, Canvas sizing, or label-motion logic is introduced in this recovery patch.
- Application version is advanced to `0.1.35` to preserve release history; `0.1.34` remains rejected.

## Visual contract

`0.1.33` is the restored visual baseline. Further changes must be isolated and compared against that baseline rather than against `0.1.34`.

## Required verification

- Central MPReply planet asset loads without an HTTP 404.
- Canvas matches the `0.1.33` visual baseline.
- Browser console has no image-loading or WebGL errors.
- TypeScript, ESLint, unit tests, design tests, and production build pass.

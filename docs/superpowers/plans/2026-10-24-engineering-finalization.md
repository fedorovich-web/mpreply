# MPReply engineering finalization

Scope approved by the owner: restore the homepage model section with the existing brand assets and the four specified models; review reliability/security; remove proven unused code; refresh the main README; verify and deliver through a reviewed PR. Preserve the approved composition and prices.

## Delivery steps

1. Preserve untracked `.handoff/`, `apps/cms/` and unique branch work. Compare the current branch with `origin/main` and existing PRs.
2. Restore the same model-card layout in RU/EN with GPT-6 Luna, Claude Sonnet 5.5, Gemini 3.8 and DeepSeek V4.1, using the existing SVG files and concise descriptions. Do not infer that a production four-model router has been certified.
3. Integrate the reviewed quota fix from PR #22. Exercise expired sends, ambiguous writes, inactive ambiguity, modes and tenant isolation against disposable PostgreSQL.
4. Remove only unreachable declarations or redundant exports found by Knip. Add the unused-code check to the existing gates. Patch vulnerable dependencies without weakening security or visual assertions.
5. Run backend, PostgreSQL, frontend, production browser, accessibility, security, visual and Lighthouse checks. Review the intentional homepage visual difference before replacing its two platform-specific baselines.
6. Obtain independent reviews of the backend/dependency diff and the actual homepage renders. Commit, push and merge only after the applicable checks pass. Keep Actions paid usage blocked at a zero-dollar budget.
7. Back up refs before removing branches whose work is proven merged. Preserve open PR dependencies and unique commits.
8. Preserve the processing pause. Autodeploy must remain off. A site deployment may target only `web` with `--no-deps`; do not deploy the whole Compose stack, start worker/scheduler, drain jobs or call paid/live write providers.

## Evidence boundaries

Report local checks, GitHub CI, Git delivery, deployed web/API versions and provider outcomes separately. A passing mocked browser flow does not establish a real marketplace send, payment, email or AI-provider call.

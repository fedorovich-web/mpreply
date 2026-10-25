# Historical branch archive — 25 October 2026

## Active work retained

`main` is the current application and deployment branch.

`codex/0.1.104-backend` remains both local and on origin. The local tip is `a3fb73a417e7bdb38d2ac6d8854c3c13b3473bcd`; it retains 12 commits absent from its origin counterpart. This line contains unfinished CMS, team/settings and LLM configuration work and earlier demo/session changes. Preserving the branch does not mean those capabilities are delivered on `main`.

PR #11 remains open against `work/0.1.104-yandex-foundation`. Its base branch is retained to preserve that review context. The current task does not rebase, merge or publish the 12 local commits.

Protected untracked `.handoff/` and `apps/cms/`, the existing two stash entries and the single working checkout are unchanged.

## Obsolete refs removed

The following nine origin branches were archived before deletion:

| Branch | Archived tip | Disposition |
| --- | --- | --- |
| `codex/mpreply-blue-public-redesign` | `b5ed0ed6a48feffa3941843fc54dc52344738dcc` | Earlier public/workspace redesign and integration setup. The approved site and four connection workspaces continued on main, including the retirement of the old Impeccable machinery. Preserve the old tree as an archive rather than merge its outdated product/design contracts. |
| `develop` | `179ae0c254df44d6e480357864f60d8fa70e603e` | Old 0.1.103 release line; its unique lineage remains an ancestor of the retained backend branch. |
| `sprint-4-dashboard-inbox-ui` | `6c54a8604ea26c1a6c2a7a90a6fac56bf0aa1718` | Mock dashboard/inbox foundation superseded by the current API-backed workspace. |
| `sprint-5-openrouter-ai` | `68124d9c277dcb4f643d755d92ca5e2bc5fed3c3` | Historical AI draft foundation; the current provider/service implementation evolved separately. |
| `work/0.1.104-security-bootstrap-run` | `556bb3a436a92f5d2acbfdb65adcfd405c01470f` | Validation-only bootstrap, payload transport and dependency diagnostics. |
| `work/0.1.104-security-current` | `29b73d5247b40e5fa1102914e83b87342dc38e02` | Historical dependency refresh and Playwright mock-origin experiment. |
| `work/0.1.104-security-prerequisite` | `61d922dd4df1aeab6746e1f37565409202e36345` | Validation-only prerequisite/base for the bootstrap experiment. |
| `work/0.1.104-security-prerequisite-clean` | `b294c942548860a79fde05f9dddf6c0bf4b2c6c3` | One-shot lockfile materialization and compatibility experiment. |
| `work/0.1.104-security-refresh` | `d56e9aad1a45e4cbc1a5c69d968a373ae29d0dd6` | Historical dependency-floor and request-aware CORS test helpers; unique experimental guards remain recoverable from the archive. |

Draft PRs #4, #10 and #14 were closed without merge after their exact heads and purposes were checked. PR #10 was explicitly a validation-only review, not a release request; its source remains reachable through the retained base of PR #11. No old implementation was silently described as merged.

An independent source review covered the two sprint refs and five security refs. The parent review covered the release/redesign refs, PR dependencies and unpublished local work. Current workflows, scripts and package/container configuration do not consume the removed bootstrap machinery.

## Recovery and safety checks

A complete-history bundle named `historical-branches-and-stashes.bundle` is stored outside the checkout with an inventory, PR snapshots and backup manifest. It includes separate named snapshots of both stash entries as well as the branch tips. Git verified the bundle before any remote ref deletion; SHA256 is `47ef4ce1e32226baeda599819fdd38d3abdf4054d9e31149e6e74ee5e5f095b9`.

Inspect the bundle with `git bundle list-heads "<archive.bundle>"`. For example, restore an old remote tip into a new local branch without touching the checkout:

```text
git fetch "<archive.bundle>" refs/remotes/origin/sprint-5-openrouter-ai:refs/heads/recovered/sprint-5-openrouter-ai
```

Deletion used an atomic push with an exact expected-tip check for each branch. A changed remote tip would reject the operation. No force update of a surviving branch, history rewrite, stash application, worktree removal, reset or clean was performed.

The quality workflow now targets the active `main` branch instead of the removed `develop` branch. Every job, assertion, permission and PostgreSQL selection is preserved. Application files and runtime configuration are unchanged; this cleanup requires no deployment and does not resume worker/scheduler or external operations.

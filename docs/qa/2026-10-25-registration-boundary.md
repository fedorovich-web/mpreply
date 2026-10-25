# Public registration boundary — 25 October 2026

Public registration CTAs used relative auth routes. On the public domain, Next.js prefetched those routes as RSC requests; domain routing redirected them to the app origin, where the public page's strict CSP rejected the fetch. Browser diagnostics retained the two registration requests as pending. The public header already used the correct app origin.

Commercial CTAs and the demo banner now use the existing configured `appOrigin`, preserving locale and registration intent. No component structure, copy, price, CSS, CSP or backend permission changed. Real RU and EN homepage clicks reached the corresponding app registration form with the intent intact.

Rendered-link regressions failed before the implementation and passed afterward. Validation completed on the production build: 611 unit tests, 59 design-token tests, TypeScript, ESLint, Knip, CSS syntax, W3C validation of 64 routes, 120 existing E2E cases plus two new registration regressions, 27 accessibility cases, 19 Windows visual cases and four-route Lighthouse. A Windows source contract normalizes CRLF at its read boundary without changing responsive assertions. Independent source review found no blocking P1/P2 issues in this change.

Two already captured Linux homepage PNGs were independently reviewed and retained for the earlier approved four-model restoration. They come from Playwright 1.61.1's Chromium 149.0.7827.55, not the provisional Brave 156 renders. Original attachment bodies, archive SHA256 and visual-spec SHA256 were verified. Desktop SHA256 is `4c95317d4c9d22afaceb20f3c057e5d6d181ae0c0e18f6428d68b704319d4dda`; mobile SHA256 is `fea5351cca7b46c68be9676b5beb77324c92d28ec124b8a631bddd53ab23c609`. No other baseline or matcher threshold changed.

The full Linux visual gate is not recorded as green: its last completed diagnostic run, before these final expected-image replacements, had 16 passes, two homepage differences against provisional Brave images and one pricing worker terminated with SIGKILL. Further pixel-comparison work was stopped at the owner's request. This does not invalidate the separately completed behavioral checks and does not establish a pricing UI defect.

GitHub Actions run `40163630486` was rejected before execution by account billing/spending restrictions; container checks were skipped. No paid usage or CI assertion was enabled, disabled or relaxed.

The web-only rollout used `up -d --build --no-deps web`. Observed web container `a92002ba2dac` was healthy; API `e68ddec3382f` remained healthy and unchanged. Saved Dokploy source was restored to `main`, autodeploy remained off, and the saved command selected API/web with `--no-deps`. Worker/scheduler were not started. Temporary QA containers had automatic removal and no provider credentials, production environment or published ports. The temporary QA helper is excluded from the final repository change.

No marketplace reply, paid AI generation, payment or email was performed. This report does not claim that every defect in the repository has been eliminated.

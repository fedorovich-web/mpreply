# Provenance

- Upstream project: `juliangruber/brace-expansion`
- Security advisory: `GHSA-mh99-v99m-4gvg` / `CVE-2026-14257`
- Upstream patched release: `5.0.8`
- Upstream fix commit: `a1bd33999ea75262c4749fff3bbb0d1372bd07b5`
- Algorithm source: upstream `src/index.ts` at tag `v5.0.8`
- Compatibility change: expose the upstream `expand()` function as both the
  historical callable CommonJS default and the modern named `expand` export.
- No Marketplace application runtime imports this package; it is restricted to
  the frontend lint/build dependency graph.

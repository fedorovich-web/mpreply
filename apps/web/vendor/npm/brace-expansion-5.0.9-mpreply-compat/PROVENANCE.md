# Provenance

- Upstream project: `juliangruber/brace-expansion`
- Security advisories: `GHSA-mh99-v99m-4gvg` / `CVE-2026-14257` and
  `GHSA-rgw5-rvv9-x895` / `CVE-2026-69152`
- Upstream patched release: `5.0.9`
- Upstream 5.0.9 source: `src/index.ts` at tag `v5.0.9`
- Compatibility change: expose upstream `expand()` as both the historical
  callable CommonJS default and the modern named `expand` export.
- No Marketplace application runtime imports this package; it is restricted to
  the frontend lint/build dependency graph.

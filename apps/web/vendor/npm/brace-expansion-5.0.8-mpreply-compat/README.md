# brace-expansion 5.0.8 MP Reply compatibility package

This project-local package preserves the callable CommonJS interface required
by `minimatch@3` while exposing the named `expand` export used by current
`minimatch` releases.

The expansion implementation is bounded by both result count and aggregate
output length. It is used only as a pinned transitive dependency security
correction for `GHSA-mh99-v99m-4gvg` / `CVE-2026-14257`.

See `PROVENANCE.md` for source and transformation details.

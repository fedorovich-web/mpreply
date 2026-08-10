# Provenance

- Upstream project: `juliangruber/brace-expansion`.
- Security release semantics: `5.0.8`.
- Security advisory: `GHSA-mh99-v99m-4gvg` / `CVE-2026-14257`.
- License: MIT; the upstream license is retained in `LICENSE`.
- Security behavior retained: maximum expansion count and aggregate output
  length bounds, plus iterative top-level expansion.
- Compatibility transformation: the implementation is emitted as CommonJS,
  keeps the historical callable export, and also exposes `expand`, `default`,
  `EXPANSION_MAX`, and `EXPANSION_MAX_LENGTH` properties.
- No network access, lifecycle script, telemetry, or project-specific runtime
  behavior is included.

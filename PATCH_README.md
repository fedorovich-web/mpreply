# Respio patch 0.1.26

Project-wide accessibility contrast hardening after the final 0.1.25 GitHub axe failure.

- Fixes the exact Wildberries selected-account success badge failure caused by alpha compositing over the violet active surface.
- Makes all semantic soft status surfaces opaque so contrast cannot change with parent background.
- Adds complete dark-theme semantic status overrides with WCAG AA contrast.
- Fixes one latent Automation Rules error-text misuse (`--color-danger` used as text instead of `--color-danger-text`).
- Strengthens design-token tests to cover light/dark semantic pairs, on-brand text, all core surfaces and opacity invariants.
- Synchronizes real version sources to `0.1.26`.

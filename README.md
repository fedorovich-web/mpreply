# Respio Sprint 8 release-gate repair patch

This repair patch fixes the local release gate after the first Sprint 8 archive exposed two problems:

1. Official Node-based Pyright was not explicitly bound to the repository `.venv`, causing thousands of cascading `reportMissingImports` diagnostics even though backend tests passed.
2. PowerShell native-command failures were not checked robustly, so the script could continue after Ruff or Pyright failures.

The patch also fixes the Ruff import-order issue in `app/services/ai_service.py`, removes the unused Python Pyright wrapper dependency, hardens GitHub Actions Pyright interpreter binding, adds backend environment smoke tests and `pip check`, and extends the repository integrity gate to detect future regressions in these contracts.

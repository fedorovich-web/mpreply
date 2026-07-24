# Ruff correction — 2026-07-24

The first development archive failed the exact Windows Ruff gate with five findings:

- `SIM102` in `marketplace_account_service.py`;
- four `RUF001` findings in an intentional Russian expected-text literal.

Corrections in this archive:

- the nested Yandex Market Business ID validation was combined into one condition;
- the intentional Russian assertion is annotated with `# noqa: RUF001`.

Verification performed after correction in the artifact container:

- Python compileall: PASS;
- targeted backend matrix: 64 passed;
- available backend suite: 166 passed.

The exact Windows commands below must be run before commit:

```powershell
Set-Location C:\Work\respio\apps\api
& C:\Work\respio\.venv\Scripts\ruff.exe check app alembic
npx.cmd --yes pyright@1.1.411 --pythonpath C:\Work\respio\.venv\Scripts\python.exe app
& C:\Work\respio\.venv\Scripts\pytest.exe -q
```

Do not treat this document as evidence that the Windows gate has already passed.

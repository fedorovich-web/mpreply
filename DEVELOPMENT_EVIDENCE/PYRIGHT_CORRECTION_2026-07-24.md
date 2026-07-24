# MP Reply 0.1.104 — strict Pyright correction

Date: 2026-07-24

## Trigger

The Windows release gate reported 31 strict Pyright errors after the earlier Ruff-only correction.

## Corrected areas

- `AdapterResult.data` is narrowed and explicitly cast before dictionary access.
- Yandex Market scopes are converted from an untyped provider payload into `list[str]`.
- Seller/business ID normalization is exposed through the typed public function
  `normalize_marketplace_seller_id` rather than tested through a protected method.
- Reply preflight result access is narrowed through `dict[str, object]`.
- Capability tests patch the imported capability resolver instead of the private
  `_CAPABILITIES` registry.
- Sync test doubles preserve exact override parameter names.
- Typed capability lookup callables replace untyped monkeypatch lambdas.
- Test harness public wrappers replace direct access to protected service methods.

No `# type: ignore`, `pyright: ignore`, or broad diagnostic suppression was added.

## Checks completed in the artifact environment

- Python compileall: PASS
- Targeted backend tests: 64 passed
- Available backend suite: 166 passed
- Reported private/protected access patterns removed by source inspection

## Required external confirmation

The exact Windows command remains authoritative:

```powershell
npx.cmd --yes pyright@1.1.411 `
    --pythonpath "C:\Work\respio\.venv\Scripts\python.exe" `
    app
```

The correction must not be committed or pushed until this command, the full release gate,
and the container gate finish with exit code 0.

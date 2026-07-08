# Respio lint config fix

Patch fixes backend package/lint configuration:

- pins existing `dramatiq[redis]==2.2.0`;
- limits setuptools package discovery to `app*` and excludes Alembic migrations;
- sets Ruff line length to 160 for current SQLAlchemy/FastAPI layout;
- ignores `B008` because FastAPI uses `Depends`, `Header`, `Cookie` in endpoint/dependency defaults.

After applying this patch, run from `apps/api`:

```powershell
..\..\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
ruff check app --fix
ruff check app
python -m compileall app
pytest
```

Commit after verification:

```powershell
cd C:\Work\respio
git add .
git commit -m "fix backend lint configuration"
git push
```

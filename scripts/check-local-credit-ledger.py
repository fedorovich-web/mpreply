"""Run migrations and credit concurrency tests against a separate native local database.

Uses synthetic credentials created by start-local-demo-api.py. Does not connect to
providers or modify the demo database. Leaves the test database for inspection.
"""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    runtime = Path(os.environ["LOCALAPPDATA"]) / "MPReply" / "local-runtime"
    config = json.loads((runtime / "demo-api-env.json").read_text())
    binaries = runtime / "postgresql-18.1" / "pgsql" / "bin"
    database = "mpreply_credit_test_20260930"
    env = os.environ.copy()
    env["PGPASSWORD"] = config["database_password"]
    common = ["-h", "127.0.0.1", "-p", "55432", "-U", "mpreply_local"]
    found = subprocess.run([
        str(binaries / "psql.exe"), *common, "-d", "postgres", "-At", "-c",
        "SELECT 1 FROM pg_database WHERE datname = 'mpreply_credit_test_20260930'",
    ], check=True, capture_output=True, text=True, env=env)
    if found.stdout.strip() != "1":
        subprocess.run([str(binaries / "createdb.exe"), *common, database], check=True, env=env)
    url = f"postgresql+asyncpg://mpreply_local:{config['database_password']}@127.0.0.1:55432/{database}"
    env.update({
        "DATABASE_URL": url, "MPREPLY_CREDIT_TEST_DATABASE_URL": url, "APP_ENV": "local",
        "AUTH_SECRET_KEY": config["auth_secret"], "CREDENTIALS_ENCRYPTION_KEY": config["encryption_key"],
        "GROQ_API_KEY": "", "RESEND_API_KEY": "", "SENTRY_DSN": "",
    })
    api = root / "apps" / "api"
    python = api / ".venv" / "Scripts" / "python.exe"
    for revision in ["head", "20260914_0015", "head"]:
        direction = "downgrade" if revision == "20260914_0015" else "upgrade"
        subprocess.run([str(python), "-m", "alembic", direction, revision], cwd=api, env=env, check=True)
    subprocess.run([str(python), "-m", "pytest", "app/tests/test_reply_credits_postgres.py", "-q"], cwd=api, env=env, check=True)


if __name__ == "__main__":
    main()

"""Migrate and test payments on a separate native PostgreSQL database; never Docker or remote hosts."""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    runtime = Path(os.environ["LOCALAPPDATA"]) / "MPReply" / "local-runtime"
    binaries = runtime / "postgresql-18.1" / "pgsql" / "bin"
    data = runtime / "demo-data-20260930"
    if not (binaries / "pg_ctl.exe").is_file() or not (data / "PG_VERSION").is_file():
        raise SystemExit("Existing native local PostgreSQL runtime is required; Docker has not been started.")
    config = json.loads((runtime / "demo-api-env.json").read_text())
    env = os.environ.copy()
    env["PGPASSWORD"] = config["database_password"]
    status = subprocess.run([str(binaries / "pg_ctl.exe"), "-D", str(data), "status"], capture_output=True)
    if status.returncode != 0:
        subprocess.run([str(binaries / "pg_ctl.exe"), "-D", str(data), "-l", str(runtime / "postgres-demo.log"),
                        "-o", "-h 127.0.0.1 -p 55432", "-w", "start"], check=True, env=env,
                       creationflags=subprocess.CREATE_NO_WINDOW)
    database = "mpreply_credit_test_20261001_billing"
    common = ["-h", "127.0.0.1", "-p", "55432", "-U", "mpreply_local"]
    found = subprocess.run([str(binaries / "psql.exe"), *common, "-d", "postgres", "-At", "-c",
                            f"SELECT 1 FROM pg_database WHERE datname = '{database}'"],
                           check=True, capture_output=True, text=True, env=env)
    if found.stdout.strip() != "1":
        subprocess.run([str(binaries / "createdb.exe"), *common, database], check=True, env=env)
    # Fixed local DB, never a URL from production environment. Do not print credentials.
    url = f"postgresql+asyncpg://mpreply_local:{config['database_password']}@127.0.0.1:55432/{database}"
    env.update({"DATABASE_URL": url, "MPREPLY_BILLING_TEST_DATABASE_URL": url,
                "MPREPLY_CREDIT_TEST_DATABASE_URL": url, "APP_ENV": "local",
                "AUTH_SECRET_KEY": config["auth_secret"], "CREDENTIALS_ENCRYPTION_KEY": config["encryption_key"],
                "GROQ_API_KEY": "", "RESEND_API_KEY": "", "SENTRY_DSN": "", "LAVA_ENABLED": "false", "YANDEX_OAUTH_ENABLED": "false"})
    api = root / "apps" / "api"
    python = api / ".venv" / "Scripts" / "python.exe"
    for direction, revision in [("upgrade", "head"), ("downgrade", "20260930_0018"), ("upgrade", "head")]:
        subprocess.run([str(python), "-m", "alembic", direction, revision], cwd=api, env=env, check=True)
    subprocess.run([str(python), "-m", "pytest", "app/tests/test_billing_orders_postgres.py", "app/tests/test_yandex_postgres.py",
                    "app/tests/test_reply_credits_postgres.py", "-q"],
                   cwd=api, env=env, check=True)


if __name__ == "__main__":
    main()

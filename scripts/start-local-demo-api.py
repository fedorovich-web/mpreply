
from __future__ import annotations

import json
import os
import secrets
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

from cryptography.fernet import Fernet


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    runtime = Path(os.environ["LOCALAPPDATA"]) / "MPReply" / "local-runtime"
    binaries = runtime / "postgresql-18.1" / "pgsql" / "bin"
    if not (binaries / "pg_ctl.exe").is_file():
        raise SystemExit("Native PostgreSQL binaries are missing. See docs/operations/local-demo-without-docker.md.")

    try:
        with urllib.request.urlopen("http://127.0.0.1:8000/health/live", timeout=2) as response:
            if response.status == 200:
                print("An API is already listening on port 8000; it has been left running.")
                return
    except (urllib.error.URLError, TimeoutError):
        pass

    runtime.mkdir(parents=True, exist_ok=True)
    config_path = runtime / "demo-api-env.json"
    if config_path.exists():
        config = json.loads(config_path.read_text())
    else:
        config = {
            "database_password": secrets.token_urlsafe(32),
            "auth_secret": secrets.token_urlsafe(48),
            "encryption_key": Fernet.generate_key().decode(),
        }
        config_path.write_text(json.dumps(config))

    env = os.environ.copy()
    env["PGPASSWORD"] = config["database_password"]
    data = runtime / "demo-data-20260930"
    password_file = runtime / "demo-db-password.txt"
    password_file.write_text(config["database_password"])
    if not (data / "PG_VERSION").exists():
        subprocess.run([
            str(binaries / "initdb.exe"), "-D", str(data), "-U", "mpreply_local",
            "-A", "scram-sha-256", "--pwfile", str(password_file), "-E", "UTF8", "--locale=C",
        ], check=True, env=env)
    status = subprocess.run([str(binaries / "pg_ctl.exe"), "-D", str(data), "status"], capture_output=True)
    if status.returncode != 0:
        subprocess.run([
            str(binaries / "pg_ctl.exe"), "-D", str(data), "-l", str(runtime / "postgres-demo.log"),
            "-o", "-h 127.0.0.1 -p 55432", "-w", "start",
        ], check=True, env=env)

    database = subprocess.run([
        str(binaries / "psql.exe"), "-h", "127.0.0.1", "-p", "55432", "-U", "mpreply_local",
        "-d", "postgres", "-At", "-c", "SELECT 1 FROM pg_database WHERE datname = 'mpreply_demo'",
    ], check=True, capture_output=True, text=True, env=env)
    if database.stdout.strip() != "1":
        subprocess.run([
            str(binaries / "createdb.exe"), "-h", "127.0.0.1", "-p", "55432",
            "-U", "mpreply_local", "mpreply_demo",
        ], check=True, env=env)

    env.update({
        "APP_ENV": "local",
        "DATABASE_URL": f"postgresql+asyncpg://mpreply_local:{config['database_password']}@127.0.0.1:55432/mpreply_demo",
        "REDIS_URL": "redis://127.0.0.1:6379/0",
        "AUTH_SECRET_KEY": config["auth_secret"],
        "CREDENTIALS_ENCRYPTION_KEY": config["encryption_key"],
        "GROQ_API_KEY": "", "RESEND_API_KEY": "", "SENTRY_DSN": "",
        "RATE_LIMIT_ENABLED": "false", "AUTH_COOKIE_SECURE": "false",
        "WEB_APP_URL": "http://localhost:3000", "PUBLIC_SITE_URL": "http://localhost:3000",
        "API_BASE_URL": "http://localhost:8000",
    })
    api = root / "apps" / "api"
    python = api / ".venv" / "Scripts" / "python.exe"
    subprocess.run([str(python), "-m", "alembic", "upgrade", "head"], cwd=api, env=env, check=True)
    os.environ.update(env)
    os.chdir(api)
    sys.path.insert(0, str(api))
    import uvicorn

    (runtime / "api-demo.pid").write_text(str(os.getpid()))
    print(f"Local demo API starting on localhost:8000 (PID {os.getpid()}).", flush=True)
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000)


if __name__ == "__main__":
    main()

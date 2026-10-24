
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    runtime = Path(os.environ["LOCALAPPDATA"]) / "MPReply" / "local-runtime"
    config = json.loads((runtime / "demo-api-env.json").read_text())
    database = "mpreply_credit_test_20260930"
    url = f"postgresql+asyncpg://mpreply_local:{config['database_password']}@127.0.0.1:55432/{database}"
    env = os.environ.copy()
    env.update({
        "DATABASE_URL": url, "MPREPLY_CREDIT_TEST_DATABASE_URL": url, "APP_ENV": "local",
        "AUTH_SECRET_KEY": config["auth_secret"], "CREDENTIALS_ENCRYPTION_KEY": config["encryption_key"],
        "GROQ_API_KEY": "", "RESEND_API_KEY": "", "SENTRY_DSN": "",
    })
    api = root / "apps" / "api"
    python = api / ".venv" / "Scripts" / "python.exe"
    revisions = [("upgrade", "head")]
    if "--check-migration" in sys.argv[1:]:
        revisions.extend([("downgrade", "20260930_0017"), ("upgrade", "head")])
    for direction, revision in revisions:
        subprocess.run([str(python), "-m", "alembic", direction, revision], cwd=api, env=env, check=True)
    subprocess.run([
        str(python), "-m", "pytest", "app/tests/test_reply_credits_postgres.py", "app/tests/test_automatic_drafts_postgres.py", "-q",
    ], cwd=api, env=env, check=True)


if __name__ == "__main__":
    main()

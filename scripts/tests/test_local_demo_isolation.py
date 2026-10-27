import importlib.util
import os
import sys
from pathlib import Path
from tempfile import TemporaryDirectory
from types import ModuleType, SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock, patch
from urllib.error import URLError


class LocalDemoIsolationTests(TestCase):
    def test_demo_api_does_not_inherit_live_provider_routing(self) -> None:
        launcher = Path(__file__).resolve().parents[1] / "start-local-demo-api.py"
        spec = importlib.util.spec_from_file_location("local_demo_launcher", launcher)
        assert spec is not None and spec.loader is not None
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        uvicorn = ModuleType("uvicorn")
        observed: dict[str, str] = {}
        uvicorn.run = Mock(side_effect=lambda *args, **kwargs: observed.update(os.environ))
        with TemporaryDirectory(prefix="mpreply-demo-isolation-") as temporary:
            runtime = Path(temporary) / "MPReply" / "local-runtime"
            binaries = runtime / "postgresql-18.1" / "pgsql" / "bin"
            binaries.mkdir(parents=True)
            (binaries / "pg_ctl.exe").touch()
            (runtime / "demo-data-20260930").mkdir()
            (runtime / "demo-data-20260930" / "PG_VERSION").write_text("18")
            environment = {"LOCALAPPDATA": temporary, "AI_REPLY_PROVIDER": "openrouter", "OPENROUTER_API_KEY": "synthetic-live-key",
                           "GROQ_API_KEY": "synthetic-groq-key", "RESEND_API_KEY": "synthetic-email-key",
                           "LAVA_ENABLED": "true", "YANDEX_OAUTH_ENABLED": "true"}
            with (
                patch.dict(os.environ, environment),
                patch.dict(sys.modules, {"uvicorn": uvicorn}),
                patch.object(sys, "path", list(sys.path)),
                patch.object(module.os, "chdir"),
                patch.object(module.urllib.request, "urlopen", side_effect=URLError("synthetic unavailable API")),
                patch.object(module.subprocess, "run", return_value=SimpleNamespace(returncode=0, stdout="1\n")),
            ):
                module.main()
        self.assertEqual(observed["AI_REPLY_PROVIDER"], "groq")
        for name in ("GROQ_API_KEY", "OPENROUTER_API_KEY", "RESEND_API_KEY"):
            self.assertEqual(observed[name], "", name)
        for name in ("LAVA_ENABLED", "YANDEX_OAUTH_ENABLED"):
            self.assertEqual(observed[name], "false", name)
        self.assertIn("@127.0.0.1:55432/mpreply_demo", observed["DATABASE_URL"])
        uvicorn.run.assert_called_once_with("app.main:app", host="127.0.0.1", port=8000)

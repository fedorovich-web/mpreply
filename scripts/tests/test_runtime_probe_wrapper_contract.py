from __future__ import annotations

import os
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class RuntimeProbeWrapperContractTests(unittest.TestCase):
    def test_ozon_no_prompt_rejects_missing_credentials_before_python_or_evidence(self) -> None:
        env = os.environ.copy()
        for name in (
            "OZON_API_KEY",
            "OZON_CLIENT_ID",
            "OZON_REVIEW_ID",
            "OZON_QUESTION_ID",
            "OZON_QUESTION_SKU",
            "OZON_REPLY_TEXT",
            "MPREPLY_GIT_SHA",
        ):
            env.pop(name, None)
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "ozon.json"
            completed = subprocess.run(
                [
                    "pwsh",
                    "-NoProfile",
                    "-NonInteractive",
                    "-File",
                    str(ROOT / "scripts" / "ozon-runtime-probe.ps1"),
                    "-Repository",
                    str(ROOT),
                    "-OutputPath",
                    str(output),
                    "-NoPrompt",
                ],
                cwd=ROOT,
                env=env,
                capture_output=True,
                text=True,
                check=False,
            )

            combined = completed.stdout + completed.stderr
            self.assertNotEqual(completed.returncode, 0)
            self.assertIn("Ozon API key is required", combined)
            self.assertNotIn("parameter cannot be found", combined.lower())
            self.assertFalse(output.exists())

    def test_wildberries_no_prompt_rejects_missing_credentials_before_python_or_evidence(self) -> None:
        env = os.environ.copy()
        for name in (
            "WILDBERRIES_API_KEY",
            "WILDBERRIES_REVIEW_ID",
            "WILDBERRIES_QUESTION_ID",
            "WILDBERRIES_REPLY_TEXT",
            "MPREPLY_GIT_SHA",
        ):
            env.pop(name, None)
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "wildberries.json"
            completed = subprocess.run(
                [
                    "pwsh",
                    "-NoProfile",
                    "-NonInteractive",
                    "-File",
                    str(ROOT / "scripts" / "wildberries-runtime-probe.ps1"),
                    "-Repository",
                    str(ROOT),
                    "-OutputPath",
                    str(output),
                    "-NoPrompt",
                ],
                cwd=ROOT,
                env=env,
                capture_output=True,
                text=True,
                check=False,
            )

            combined = completed.stdout + completed.stderr
            self.assertNotEqual(completed.returncode, 0)
            self.assertIn("Wildberries API key is required", combined)
            self.assertNotIn("parameter cannot be found", combined.lower())
            self.assertFalse(output.exists())

    def test_yandex_no_prompt_rejects_missing_credentials_before_python_or_evidence(self) -> None:
        env = os.environ.copy()
        for name in (
            "YANDEX_MARKET_API_KEY",
            "YANDEX_MARKET_BUSINESS_ID",
            "YANDEX_MARKET_REVIEW_ID",
            "YANDEX_MARKET_QUESTION_ID",
            "YANDEX_MARKET_REPLY_TEXT",
            "MPREPLY_GIT_SHA",
        ):
            env.pop(name, None)
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "yandex-market.json"
            completed = subprocess.run(
                [
                    "pwsh",
                    "-NoProfile",
                    "-NonInteractive",
                    "-File",
                    str(ROOT / "scripts" / "yandex-market-runtime-probe.ps1"),
                    "-Repository",
                    str(ROOT),
                    "-OutputPath",
                    str(output),
                    "-NoPrompt",
                ],
                cwd=ROOT,
                env=env,
                capture_output=True,
                text=True,
                check=False,
            )

            combined = completed.stdout + completed.stderr
            self.assertNotEqual(completed.returncode, 0)
            self.assertIn("Yandex Market Api-Key is required", combined)
            self.assertNotIn("parameter cannot be found", combined.lower())
            self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main()

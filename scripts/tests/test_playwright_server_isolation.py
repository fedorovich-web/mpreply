from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class PlaywrightServerIsolationTests(unittest.TestCase):
    def test_playwright_uses_a_dedicated_server(self) -> None:
        config = (ROOT / "apps" / "web" / "playwright.config.ts").read_text(
            encoding="utf-8"
        )

        self.assertIn(
            'import { resolvePlaywrightBaseURL } from "./e2e/helpers/playwright-runtime"',
            config,
        )
        self.assertIn("const baseURL = resolvePlaywrightBaseURL();", config)
        self.assertIn(
            "command: `npm run dev -- --port ${webServerPort}`",
            config,
        )
        self.assertIn("reuseExistingServer: false", config)
        self.assertIn(
            'throw new Error("PLAYWRIGHT_BASE_URL must include an explicit port")',
            config,
        )
        self.assertNotIn("reuseExistingServer: !process.env.CI", config)
        self.assertNotIn('"http://localhost:3000"', config)

    def test_api_mocks_share_the_resolved_playwright_origin(self) -> None:
        runtime = (
            ROOT / "apps" / "web" / "e2e" / "helpers" / "playwright-runtime.ts"
        ).read_text(encoding="utf-8")

        self.assertIn(
            'DEFAULT_PLAYWRIGHT_BASE_URL = "http://127.0.0.1:3120"',
            runtime,
        )
        self.assertIn("return new URL(configured).origin;", runtime)

        for filename in (
            "ai-assistant-api.ts",
            "automation-rules-api.ts",
            "integrations-api.ts",
        ):
            helper = (
                ROOT / "apps" / "web" / "e2e" / "helpers" / filename
            ).read_text(encoding="utf-8")
            self.assertIn(
                'import { resolvePlaywrightBaseURL } from "./playwright-runtime"',
                helper,
            )
            self.assertIn("const origin = resolvePlaywrightBaseURL();", helper)
            self.assertNotIn('"http://localhost:3000"', helper)


if __name__ == "__main__":
    unittest.main()

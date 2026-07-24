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
            'process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3120"',
            config,
        )
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


if __name__ == "__main__":
    unittest.main()

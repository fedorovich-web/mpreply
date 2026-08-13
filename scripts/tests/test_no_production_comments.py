from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from scripts.check_no_production_comments import find_production_comments


class NoProductionCommentsTests(unittest.TestCase):
    def test_reports_frontend_and_backend_comment_tokens(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            frontend = root / "apps" / "web" / "components" / "Example.tsx"
            stylesheet = root / "apps" / "web" / "styles" / "example.css"
            backend = root / "apps" / "api" / "app" / "service.py"
            backend_test = root / "apps" / "api" / "app" / "tests" / "test_service.py"
            frontend.parent.mkdir(parents=True)
            stylesheet.parent.mkdir(parents=True)
            backend.parent.mkdir(parents=True)
            backend_test.parent.mkdir(parents=True)
            frontend.write_text("export const value = 1; // internal note\n", encoding="utf-8")
            stylesheet.write_text("/* internal note */\n.example { color: red; }\n", encoding="utf-8")
            backend.write_text("value = 1  # internal note\n", encoding="utf-8")
            backend_test.write_text("value = 1  # test setup note\n", encoding="utf-8")

            findings = find_production_comments(root)

            self.assertEqual(
                [(finding.path, finding.line) for finding in findings],
                [
                    ("apps/api/app/service.py", 1),
                    ("apps/web/components/Example.tsx", 1),
                    ("apps/web/styles/example.css", 1),
                ],
            )

    def test_repository_production_sources_contain_no_authored_comments(self) -> None:
        root = Path(__file__).resolve().parents[2]
        self.assertEqual(find_production_comments(root), [])


if __name__ == "__main__":
    unittest.main()

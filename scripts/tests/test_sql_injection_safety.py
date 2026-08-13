from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from scripts.check_sql_injection_safety import find_unsafe_sql_construction


class SqlInjectionSafetyGateTests(unittest.TestCase):
    def test_detects_dynamic_text_and_driver_sql_but_allows_bound_sql(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            app = root / "apps" / "api" / "app"
            app.mkdir(parents=True)
            (app / "unsafe.py").write_text(
                "from sqlalchemy import text\n"
                "def unsafe(value: str):\n"
                "    first = text(f\"SELECT * FROM users WHERE name = '{value}'\")\n"
                "    second = connection.exec_driver_sql(\"SELECT \" + value)\n"
                "    query = f\"DELETE FROM users WHERE name = '{value}'\"\n"
                "    third = connection.execute(query)\n"
                "    return first, second, third\n",
                encoding="utf-8",
            )
            (app / "safe.py").write_text(
                "from sqlalchemy import text\n"
                "statement = text(\"SELECT * FROM users WHERE name = :name\")\n",
                encoding="utf-8",
            )

            findings = find_unsafe_sql_construction(root)

            self.assertEqual(
                [(finding.path, finding.line, finding.operation) for finding in findings],
                [
                    ("apps/api/app/unsafe.py", 3, "text"),
                    ("apps/api/app/unsafe.py", 4, "exec_driver_sql"),
                    ("apps/api/app/unsafe.py", 6, "execute"),
                ],
            )

    def test_repository_has_no_dynamic_sql_construction(self) -> None:
        root = Path(__file__).resolve().parents[2]
        self.assertEqual(find_unsafe_sql_construction(root), [])


if __name__ == "__main__":
    unittest.main()

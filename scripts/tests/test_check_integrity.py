from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch

from scripts import check_integrity


class TypeScriptImportIntegrityTests(TestCase):
    def setUp(self) -> None:
        directory = TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.web = self.root / "apps" / "web"
        self.web.mkdir(parents=True)
        for name, value in (("ROOT", self.root), ("WEB", self.web), ("ERRORS", [])):
            replacement = patch.object(check_integrity, name, value)
            replacement.start()
            self.addCleanup(replacement.stop)

    def write_source(self, relative: str, text: str) -> None:
        source = self.web / relative
        source.parent.mkdir(parents=True, exist_ok=True)
        source.write_text(text, encoding="utf-8")

    def test_clean_checkout_accepts_next_generated_type_references(self) -> None:
        self.write_source(
            "next-env.d.ts",
            'import "./.next/types/routes.d.ts";\nimport "./.next/types/root-params.d.ts";\n',
        )

        check_integrity.check_ts_imports()

        self.assertEqual(check_integrity.ERRORS, [])

    def test_next_env_still_rejects_unknown_generated_and_source_imports(self) -> None:
        self.write_source(
            "next-env.d.ts",
            'import "./.next/types/route.d.ts";\nimport "./lib/missing";\n',
        )

        check_integrity.check_ts_imports()

        self.assertEqual(len(check_integrity.ERRORS), 2)
        self.assertTrue(any("./.next/types/route.d.ts" in error for error in check_integrity.ERRORS))
        self.assertTrue(any("./lib/missing" in error for error in check_integrity.ERRORS))

    def test_application_sources_cannot_bypass_missing_generated_imports(self) -> None:
        self.write_source(
            "page.ts",
            'import "./.next/types/routes.d.ts";\nimport "./.next/types/root-params.d.ts";\n',
        )

        check_integrity.check_ts_imports()

        self.assertEqual(len(check_integrity.ERRORS), 2)
        self.assertTrue(all("page.ts" in error for error in check_integrity.ERRORS))

    def test_existing_import_resolves_but_missing_reexport_is_rejected(self) -> None:
        self.write_source("lib/existing.ts", "export const value = 1;\n")
        self.write_source(
            "page.ts",
            'import { value } from "./lib/existing";\nexport { missing } from "./lib/missing";\n',
        )

        check_integrity.check_ts_imports()

        self.assertEqual(len(check_integrity.ERRORS), 1)
        self.assertIn("./lib/missing", check_integrity.ERRORS[0])

from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EXPORTER = ROOT / "create-mpreply-next-chat-context-v4.mjs"
RESULT_WRITER = ROOT / "scripts" / "write-release-result.mjs"


def run(*args: str, cwd: Path, check: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(args, cwd=cwd, text=True, capture_output=True, check=False)
    if check and result.returncode != 0:
        raise AssertionError(f"Command failed: {' '.join(args)}\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}")
    return result


@unittest.skipUnless(shutil.which("git") and shutil.which("node") and shutil.which("npm"), "git/node/npm required")
class HandoffExporterTests(unittest.TestCase):
    def make_repository(self, directory: Path) -> tuple[Path, Path]:
        repo = directory / "repo"
        remote = directory / "remote.git"
        (repo / "apps" / "web").mkdir(parents=True)
        (repo / "scripts").mkdir()
        (repo / "infra" / "docker").mkdir(parents=True)

        package = {"name": "mpreply-web", "version": "0.1.103", "private": True}
        lock = {
            "name": "mpreply-web",
            "version": "0.1.103",
            "lockfileVersion": 3,
            "requires": True,
            "packages": {"": {"name": "mpreply-web", "version": "0.1.103"}},
        }
        (repo / "apps" / "web" / "package.json").write_text(json.dumps(package) + "\n", encoding="utf-8")
        (repo / "apps" / "web" / "package-lock.json").write_text(json.dumps(lock) + "\n", encoding="utf-8")
        (repo / "scripts" / "check_integrity.py").write_text("print('Integrity check passed.')\n", encoding="utf-8")
        (repo / "infra" / "docker" / ".env.ci").write_text(
            "API_BASE_URL=https://api.mpreply.example\nDEPLOYMENT_VERSION=ci\n", encoding="utf-8"
        )
        (repo / ".gitignore").write_text(".handoff/\n*.egg-info/\n", encoding="utf-8")
        (repo / "README.md").write_text("fixture\n", encoding="utf-8")

        run("git", "init", "-b", "develop", cwd=repo)
        run("git", "config", "user.email", "fixture@example.invalid", cwd=repo)
        run("git", "config", "user.name", "Fixture", cwd=repo)
        run("git", "add", ".", cwd=repo)
        run("git", "commit", "-m", "fixture", cwd=repo)
        run("git", "init", "--bare", str(remote), cwd=directory)
        run("git", "remote", "add", "origin", str(remote), cwd=repo)
        run("git", "push", "-u", "origin", "develop", cwd=repo)
        self.write_evidence(repo)
        return repo, remote

    def write_evidence(self, repo: Path) -> None:
        for kind, name in (
            ("project-quality", "project-quality-result.json"),
            ("container", "container-gate-result.json"),
        ):
            run(
                "node",
                str(RESULT_WRITER),
                f"--root={repo}",
                f"--kind={kind}",
                "--status=PASS",
                "--source=test_handoff_exporter.py",
                f"--out=.handoff/{name}",
                cwd=repo,
            )

    def test_export_uses_tracked_files_and_excludes_ignored_egg_info(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            repo, _ = self.make_repository(directory)
            egg_info = repo / "apps" / "api" / "fixture.egg-info"
            egg_info.mkdir(parents=True)
            (egg_info / "PKG-INFO").write_text("generated\n", encoding="utf-8")
            output = directory / "out"
            output.mkdir()

            result = run(
                "node",
                str(EXPORTER),
                f"--root={repo}",
                f"--out={output}",
                cwd=repo,
                check=False,
            )
            self.assertEqual(result.returncode, 0, msg=result.stdout + result.stderr)
            archives = list(output.glob("*.zip"))
            self.assertEqual(len(archives), 1)
            with zipfile.ZipFile(archives[0]) as archive:
                names = archive.namelist()
                self.assertTrue(any(name.endswith("/infra/docker/.env.ci") for name in names))
                self.assertTrue(any(name.endswith("/HANDOFF/result.json") for name in names))
                self.assertFalse(any(".egg-info" in name for name in names))

    def test_dirty_tree_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            repo, _ = self.make_repository(directory)
            (repo / "README.md").write_text("dirty\n", encoding="utf-8")
            result = run(
                "node",
                str(EXPORTER),
                f"--root={repo}",
                f"--out={directory / 'out'}",
                cwd=repo,
                check=False,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("Working tree is not clean", result.stderr)

    def test_unpushed_head_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            repo, _ = self.make_repository(directory)
            (repo / "README.md").write_text("new commit\n", encoding="utf-8")
            run("git", "add", "README.md", cwd=repo)
            run("git", "commit", "-m", "unpushed", cwd=repo)
            self.write_evidence(repo)
            result = run(
                "node",
                str(EXPORTER),
                f"--root={repo}",
                f"--out={directory / 'out'}",
                cwd=repo,
                check=False,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("Branch divergence detected", result.stderr)


if __name__ == "__main__":
    unittest.main()

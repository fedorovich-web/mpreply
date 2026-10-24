import os
import shutil
import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase, skipUnless


@skipUnless(shutil.which("pwsh"), "PowerShell is required to exercise the PowerShell container gate")
class ContainerGateCleanupTests(TestCase):
    def test_partial_start_failure_collects_logs_and_stops_the_test_stack(self) -> None:
        gate = Path(__file__).resolve().parents[1] / "container-gate.ps1"
        with TemporaryDirectory(prefix="mpreply-gate-test-") as temporary:
            directory = Path(temporary)
            log = directory / "commands.log"
            fake_docker = directory / ("docker.ps1" if os.name == "nt" else "docker")
            windows_stub = (
                "param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Arguments)\n"
                "$Arguments -join ' ' | Add-Content -LiteralPath $env:MPREPLY_TEST_DOCKER_LOG\n"
                "if ($Arguments -contains 'up') { exit 17 }\n"
                "exit 0\n"
            )
            posix_stub = (
                '#!/bin/sh\n'
                'printf "%s\\n" "$*" >> "$MPREPLY_TEST_DOCKER_LOG"\n'
                'for argument in "$@"; do [ "$argument" != "up" ] || exit 17; done\n'
                'exit 0\n'
            )
            fake_docker.write_text(windows_stub if os.name == "nt" else posix_stub, encoding="utf-8")
            if os.name != "nt":
                fake_docker.chmod(0o755)
            wrapper = directory / "exercise.ps1"
            wrapper.write_text(
                "param([string]$Gate,[string]$FakeDirectory,[string]$FakeName)\n"
                "$env:PATH = $FakeDirectory + [IO.Path]::PathSeparator + $env:PATH\n"
                "$expected = Join-Path $FakeDirectory $FakeName\n"
                "if ((Get-Command docker).Source -ne $expected) { throw 'Refusing to run a real Docker command' }\n"
                "try { & $Gate; throw 'Expected the simulated startup failure' }\n"
                "catch { if ($_.Exception.Message -notmatch 'failed with exit code 17') { throw } }\n",
                encoding="utf-8",
            )
            environment = {**os.environ, "MPREPLY_TEST_DOCKER_LOG": str(log)}
            result = subprocess.run(
                [shutil.which("pwsh"), "-NoProfile", "-File", str(wrapper), str(gate), str(directory), fake_docker.name],
                capture_output=True,
                text=True,
                env=environment,
                timeout=30,
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            commands = log.read_text(encoding="utf-8-sig").splitlines()
            self.assertTrue(any(" logs --tail 200" in command for command in commands), commands)
            self.assertTrue(any(" down --remove-orphans" in command for command in commands), commands)

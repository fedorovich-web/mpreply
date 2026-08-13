from __future__ import annotations

import io
import re
import sys
import tokenize
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True, order=True)
class CommentFinding:
    path: str
    line: int


FRONTEND_ROOTS = (
    Path("apps/web/app"),
    Path("apps/web/components"),
    Path("apps/web/lib"),
    Path("apps/web/styles"),
)
FRONTEND_SUFFIXES = {".css", ".html", ".js", ".jsx", ".ts", ".tsx"}


def _line_number(source: str, offset: int) -> int:
    return source.count("\n", 0, offset) + 1


def _frontend_findings(root: Path) -> list[CommentFinding]:
    findings: list[CommentFinding] = []
    block_pattern = re.compile(r"/\*[\s\S]*?\*/")
    line_pattern = re.compile(r"(?m)(^|[\t ])//")
    html_pattern = re.compile(r"<!--[\s\S]*?-->")
    for relative_root in FRONTEND_ROOTS:
        directory = root / relative_root
        if not directory.exists():
            continue
        for path in sorted(directory.rglob("*")):
            if not path.is_file() or path.suffix not in FRONTEND_SUFFIXES:
                continue
            source = path.read_text(encoding="utf-8")
            patterns = [block_pattern]
            if path.suffix in {".js", ".jsx", ".ts", ".tsx"}:
                patterns.append(line_pattern)
            if path.suffix == ".html":
                patterns.append(html_pattern)
            for pattern in patterns:
                for match in pattern.finditer(source):
                    findings.append(
                        CommentFinding(path.relative_to(root).as_posix(), _line_number(source, match.start()))
                    )
    return findings


def _backend_findings(root: Path) -> list[CommentFinding]:
    findings: list[CommentFinding] = []
    directory = root / "apps/api/app"
    if not directory.exists():
        return findings
    for path in sorted(directory.rglob("*.py")):
        if "tests" in path.relative_to(directory).parts:
            continue
        source = path.read_text(encoding="utf-8")
        for token in tokenize.generate_tokens(io.StringIO(source).readline):
            if token.type == tokenize.COMMENT:
                findings.append(CommentFinding(path.relative_to(root).as_posix(), token.start[0]))
    return findings


def find_production_comments(root: Path) -> list[CommentFinding]:
    return sorted(_frontend_findings(root) + _backend_findings(root))


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    findings = find_production_comments(root)
    if not findings:
        print("Production source comment gate passed.")
        return 0
    for finding in findings:
        print(f"{finding.path}:{finding.line}: authored comment is not allowed in production source")
    return 1


if __name__ == "__main__":
    sys.exit(main())

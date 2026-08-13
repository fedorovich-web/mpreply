from __future__ import annotations

import ast
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True, order=True)
class SqlConstructionFinding:
    path: str
    line: int
    operation: str


def _is_literal_string(node: ast.expr) -> bool:
    return isinstance(node, ast.Constant) and isinstance(node.value, str)


def _is_direct_string_expression(node: ast.expr) -> bool:
    if _is_literal_string(node) or isinstance(node, ast.JoinedStr):
        return True
    if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Add, ast.Mod)):
        return True
    return isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "format"


def _operation(call: ast.Call) -> str | None:
    if isinstance(call.func, ast.Name):
        return call.func.id if call.func.id in {"text", "literal_column"} else None
    if not isinstance(call.func, ast.Attribute):
        return None
    return call.func.attr if call.func.attr in {"text", "literal_column", "execute", "exec_driver_sql"} else None


def _assigned_string_names(tree: ast.AST) -> set[str]:
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and _is_direct_string_expression(node.value):
            names.update(target.id for target in node.targets if isinstance(target, ast.Name))
        elif (
            isinstance(node, ast.AnnAssign)
            and isinstance(node.target, ast.Name)
            and node.value is not None
            and _is_direct_string_expression(node.value)
        ):
            names.add(node.target.id)
    return names


def _is_unsafe(call: ast.Call, operation: str, assigned_string_names: set[str]) -> bool:
    if not call.args:
        return False
    first = call.args[0]
    if operation in {"text", "literal_column", "exec_driver_sql"}:
        return not _is_literal_string(first)
    return _is_direct_string_expression(first) or (
        isinstance(first, ast.Name) and first.id in assigned_string_names
    )


def find_unsafe_sql_construction(root: Path) -> list[SqlConstructionFinding]:
    directory = root / "apps" / "api" / "app"
    if not directory.exists():
        return []
    findings: list[SqlConstructionFinding] = []
    for path in sorted(directory.rglob("*.py")):
        if "tests" in path.relative_to(directory).parts:
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        assigned_string_names = _assigned_string_names(tree)
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            operation = _operation(node)
            if operation is not None and _is_unsafe(node, operation, assigned_string_names):
                findings.append(
                    SqlConstructionFinding(
                        path=path.relative_to(root).as_posix(),
                        line=node.lineno,
                        operation=operation,
                    )
                )
    return sorted(findings)


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    findings = find_unsafe_sql_construction(root)
    if not findings:
        print("SQL construction safety gate passed.")
        return 0
    for finding in findings:
        print(f"{finding.path}:{finding.line}: dynamic {finding.operation} SQL construction is not allowed")
    return 1


if __name__ == "__main__":
    sys.exit(main())

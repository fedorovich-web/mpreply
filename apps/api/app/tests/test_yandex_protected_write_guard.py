from __future__ import annotations

import ast
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[2]
TEST_ROOT = API_ROOT / "app" / "tests"
_PROTECTED_QUESTION_ID = "27265525"


def _call_name(node: ast.Call) -> str | None:
    if isinstance(node.func, ast.Name):
        return node.func.id
    if isinstance(node.func, ast.Attribute):
        return node.func.attr
    return None


def _literal_values(node: ast.Call) -> list[object]:
    values: list[object] = []
    for arg in node.args:
        if isinstance(arg, ast.Constant):
            values.append(arg.value)
    for keyword in node.keywords:
        if isinstance(keyword.value, ast.Constant):
            values.append(keyword.value.value)
    return values


def _keyword_literal(node: ast.Call, name: str) -> object | None:
    for keyword in node.keywords:
        if keyword.arg == name and isinstance(keyword.value, ast.Constant):
            return keyword.value.value
    return None


def test_protected_question_id_is_never_a_literal_write_target() -> None:
    violations: list[str] = []
    for path in sorted(API_ROOT.rglob("*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            call_name = _call_name(node)
            if call_name == "send_question_reply" and _PROTECTED_QUESTION_ID in {
                str(value) for value in _literal_values(node)
            }:
                violations.append(f"{path}:{node.lineno}: send_question_reply")
            if call_name == "ProbeConfig":
                mode = _keyword_literal(node, "mode")
                question_id = _keyword_literal(node, "question_id")
                if mode == "write-question" and str(question_id) == _PROTECTED_QUESTION_ID:
                    violations.append(f"{path}:{node.lineno}: ProbeConfig write-question")

    assert violations == []


def test_automated_tests_do_not_run_real_yandex_runtime_probe() -> None:
    violations: list[str] = []
    direct_probe_call = "run_" + "probe(YandexMarket" + "Adapter("
    runtime_probe_cli_call = "_async" + "_main()"
    runtime_probe_module = "yandex_market_" + "runtime_probe"
    for path in sorted(TEST_ROOT.rglob("test_*.py")):
        source = path.read_text(encoding="utf-8")
        if direct_probe_call in source:
            violations.append(f"{path}: direct real-adapter run_probe")
        if runtime_probe_cli_call in source and runtime_probe_module in source:
            violations.append(f"{path}: runtime probe CLI execution")

    assert violations == []

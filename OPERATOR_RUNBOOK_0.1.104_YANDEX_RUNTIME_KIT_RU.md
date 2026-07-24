# MP Reply 0.1.104 — Yandex Market runtime verification kit

Этот batch применяется поверх подтверждённого remote baseline:

- репозиторий: текущий защищённый Git checkout;
- ветка: `work/0.1.104-yandex-foundation`;
- HEAD: `922e1788d99863e2e631addd52d68e07dec3c932`;
- version contracts: `0.1.103`;
- migrations: нет;
- целевой commit: `feat(yandex-market): add runtime verification kit`.

## Правила

- Не распаковывать ZIP поверх рабочего Git checkout вручную.
- Не использовать `git add .`, `git add -A`, `git clean`, `git reset --hard` или force push.
- Не помещать реальный Api-Key в команды, Git, логи или чат.
- Runtime probe запускается только после commit/push runtime-kit batch.
- Write probe запускается отдельно и только для заранее выбранного тестового review/question.

## Exact scope

```text
README.md
DEVELOPMENT_STATUS_0.1.104.md
OPERATOR_RUNBOOK_0.1.104_YANDEX_RUNTIME_KIT_RU.md
DEVELOPMENT_EVIDENCE/YANDEX_RUNTIME_CHANGED_PATHS.txt
DEVELOPMENT_EVIDENCE/YANDEX_RUNTIME_VERIFICATION_KIT_2026-07-24.md
DEVELOPMENT_EVIDENCE/YANDEX_RUNTIME_TARGETED_TESTS.txt
DEVELOPMENT_EVIDENCE/YANDEX_RUNTIME_AVAILABLE_SUITE.txt
apps/api/app/tools/__init__.py
apps/api/app/tools/yandex_market_runtime_probe.py
apps/api/app/tests/test_yandex_market_runtime_probe.py
docs/integrations/yandex-market-runtime-verification.md
scripts/yandex-market-runtime-probe.ps1
apps/web/package.json
apps/web/package-lock.json
```

## Автоматическое применение

Используйте сопровождающий файл:

```text
APPLY_VERIFY_COMMIT_PUSH_MP_REPLY_YANDEX_RUNTIME_KIT.ps1
```

Запуск:

```powershell
pwsh.exe `
    -NoProfile `
    -ExecutionPolicy Bypass `
    -File "$env:USERPROFILE\Downloads\APPLY_VERIFY_COMMIT_PUSH_MP_REPLY_YANDEX_RUNTIME_KIT.ps1" `
    -Repository $Repository `
    -Archive "$env:USERPROFILE\Downloads\mpreply-0.1.104-yandex-runtime-kit.zip"
```

Скрипт выполняет:

1. SHA-256 ZIP;
2. internal manifest;
3. branch/local/remote baseline;
4. clean worktree и empty staging;
5. перенос runtime-kit files и безопасное обновление PostCSS lockfile;
6. exact scope и `git diff --check`;
7. Ruff 0.14.9;
8. strict Pyright 1.1.411;
9. runtime-kit/Yandex targeted tests;
10. полный pytest;
11. release gate;
12. container gate;
13. exact staging;
14. commit;
15. push feature branch;
16. local/remote SHA;
17. clean final worktree.

## Ручные backend checks

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location (Join-Path $Repository "apps\api")

& (Join-Path $Repository ".venv\Scripts\ruff.exe") check app alembic
if ($LASTEXITCODE -ne 0) { throw "Ruff failed: $LASTEXITCODE" }

npx.cmd --yes pyright@1.1.411 `
    --pythonpath (Join-Path $Repository ".venv\Scripts\python.exe") `
    app
if ($LASTEXITCODE -ne 0) { throw "Pyright failed: $LASTEXITCODE" }

& (Join-Path $Repository ".venv\Scripts\pytest.exe") -q `
    app/tests/test_yandex_market_runtime_probe.py `
    app/tests/test_yandex_market_adapter_contract.py `
    app/tests/test_yandex_market_adapter_normalization.py
if ($LASTEXITCODE -ne 0) { throw "Targeted pytest failed: $LASTEXITCODE" }

& (Join-Path $Repository ".venv\Scripts\pytest.exe") -q
if ($LASTEXITCODE -ne 0) { throw "Full pytest failed: $LASTEXITCODE" }
```

## Repository gates

```powershell
Set-Location $Repository

& ".\scripts\release-gate.ps1"
if ($LASTEXITCODE -ne 0) { throw "Release gate failed: $LASTEXITCODE" }

& ".\scripts\container-gate.ps1"
if ($LASTEXITCODE -ne 0) { throw "Container gate failed: $LASTEXITCODE" }
```

## Read-only runtime verification

После успешного commit/push:

```powershell
Set-Location $Repository
.\scripts\yandex-market-runtime-probe.ps1
```

Скрипт безопасно запросит:

- Yandex Market Api-Key;
- Business ID.

Доказательство будет записано в:

```text
$Repository\.handoff\yandex-market-runtime-verification.json
```

`.handoff/` исключена из Git.

Успешный read-only результат:

```text
YANDEX MARKET RUNTIME PROBE: PASS
```

## Write probe

Write probe не запускается автоматически. Пример review:

```powershell
.\scripts\yandex-market-runtime-probe.ps1 `
    -Mode write-review `
    -ReviewId "<TEST_REVIEW_ID>" `
    -ReplyText "Тестовый ответ MP Reply" `
    -Confirmation "I_UNDERSTAND_YANDEX_MARKET_WRITE"
```

Пример question:

```powershell
.\scripts\yandex-market-runtime-probe.ps1 `
    -Mode write-question `
    -QuestionId "<TEST_QUESTION_ID>" `
    -ReplyText "Тестовый ответ MP Reply" `
    -Confirmation "I_UNDERSTAND_YANDEX_MARKET_WRITE"
```

Результат `PENDING` означает: provider принял write, но ответ ещё не виден через read API. Это требует ручной проверки модерации/распространения и не разрешает повторную отправку вслепую.

## Commit и push

Скрипт создаёт:

```text
feat(yandex-market): add runtime verification kit
```

Push выполняется только в:

```text
origin/work/0.1.104-yandex-foundation
```

Push в `develop` и version bump не выполняются.

## Frontend dependency security correction

Авторитетный Windows release gate остановил runtime-kit batch на GitHub advisory
`GHSA-r28c-9q8g-f849`: PostCSS `<= 8.5.17` допускает path traversal при
автозагрузке предыдущей source map. Первая исправленная версия — `8.5.18`.

Проект явно закреплял `postcss: 8.5.12` через `apps/web/package.json` → `overrides`.
Исправление не использует `npm audit fix --force` и не меняет версии Next или Vite:

1. override изменяется на точную версию `8.5.18`;
2. `package-lock.json` пересобирается штатной командой npm;
3. проверяется resolved PostCSS во всех lockfile package entries;
4. `npm audit --audit-level=high` обязан завершиться с exit code 0;
5. после этого повторяются release и container gates.

Итоговый exact scope содержит 14 файлов.

## PostCSS integrity contract correction

После безопасного обновления `postcss` до `8.5.18` project integrity gate был
обновлён синхронно с dependency baseline:

- `scripts/check_integrity.py` требует override `8.5.18`;
- regression test проверяет каждый `node_modules/postcss` entry в lockfile;
- добавлен `scripts/tests/test_postcss_security_baseline.py`;
- итоговый exact scope runtime-kit batch: 16 файлов.

## Playwright server isolation correction

Авторитетный Windows release gate прошёл dependency security, backend checks,
repository tooling, integrity, frontend install, build и W3C validation, но
critical E2E подключился к уже работающему процессу на `localhost:3000`.

Изолированный контрольный запуск на свободном порту доказал root cause:
`26 passed`.

Постоянное исправление:

- Playwright использует отдельный URL `http://127.0.0.1:3120` по умолчанию;
- `PLAYWRIGHT_BASE_URL` обязан содержать явный порт;
- Next server запускается на порту из `PLAYWRIGHT_BASE_URL`;
- `reuseExistingServer` всегда отключён;
- занятый порт приводит к fail-closed вместо тестирования чужого приложения;
- добавлен regression test server-isolation contract;
- итоговый exact scope: 18 файлов.

# Yandex Market runtime verification

This runbook verifies the production adapter against a real Yandex Market seller account without storing the raw Api-Key in Git, command history, logs, or the generated evidence file.

## What the probe checks

The default `read-only` mode performs:

1. Api-Key inspection through the adapter credential-validation flow;
2. Business ID access check;
3. bounded review pagination;
4. bounded question pagination;
5. normalization of the first returned review and question, when present;
6. cursor-cycle detection;
7. safe JSON evidence generation.

The report contains only:

- a masked Business ID;
- a one-way SHA-256 credential fingerprint prefix;
- normalized scopes;
- pass/fail state for each step;
- page and item counts;
- whether another provider page exists;
- safe adapter error codes and messages.

The report never contains:

- the raw Api-Key;
- the full Business ID;
- page-token values;
- customer names or message text;
- raw provider payloads;
- reply text used for a write probe.

## Read-only verification

From the repository root on Windows:

```powershell
.\scripts\yandex-market-runtime-probe.ps1
```

The script securely prompts for the Api-Key and then asks for the Business ID. The key is passed to the Python child process only through a temporary environment variable and is removed in `finally`.

Default evidence path:

```text
.handoff/yandex-market-runtime-verification.json
```

The `.handoff/` directory is excluded from Git.

## Bounded pagination

By default the probe reads at most two review pages and two question pages. The maximum allowed value is five:

```powershell
.\scripts\yandex-market-runtime-probe.ps1 -MaxPages 5
```

The probe fails closed when the provider repeats a cursor.

## Write probes

Write probes are disabled by default. They require:

- an explicit mode;
- an explicit review or question ID;
- explicit reply text;
- the exact confirmation phrase `I_UNDERSTAND_YANDEX_MARKET_WRITE`.

Review example:

```powershell
.\scripts\yandex-market-runtime-probe.ps1 `
    -Mode write-review `
    -ReviewId "123456" `
    -ReplyText "Тестовый ответ MP Reply" `
    -Confirmation "I_UNDERSTAND_YANDEX_MARKET_WRITE"
```

Question example:

```powershell
.\scripts\yandex-market-runtime-probe.ps1 `
    -Mode write-question `
    -QuestionId "123456" `
    -ReplyText "Тестовый ответ MP Reply" `
    -Confirmation "I_UNDERSTAND_YANDEX_MARKET_WRITE"
```

Before sending, the adapter checks whether a seller-authored response already exists. If it does, the probe skips the write. After a successful write, the probe checks visibility again. A provider-accepted write that is not yet visible is reported as `pending`, not as a failure, because moderation or propagation may still be in progress.

Use write probes only with a deliberately selected test review or question. Do not use production customer content without operational approval.

## Exit behavior

The Python tool returns:

- `0` for `pass`, `pending`, or `skipped`;
- `2` when a runtime adapter step fails;
- `5` for invalid or incomplete configuration.

The PowerShell wrapper additionally verifies that the evidence file does not contain the raw Api-Key or unmasked Business ID.

## Release boundary

A read-only `pass` confirms credential access, list operations, pagination behavior, and normalization against one real account. It does not confirm write publication.

A write-probe `pass` or `pending` confirms that the provider accepted the write operation. The final release decision still requires operator review of the resulting seller response and any moderation delay.

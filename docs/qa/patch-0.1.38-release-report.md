# Respio 0.1.38 — WebGL Hero Orbit/Mouse Polish

Дата: 2026-07-16

## Scope

Патч сделан от визуального кандидата `0.1.37`, который пользователь показал как «канвас почти финал».

## Что изменено

- Pointer tracking перенесён с области canvas на ближайший `.home-hero`, чтобы реакция курсора ощущалась на всей hero-секции.
- Mouse/parallax отделён от орбитальной математики: курсор больше не меняет локальные координаты планет.
- Добавлен отдельный `hero-orbital-system-parallax` group: орбиты, планеты и projection labels двигаются как единая система.
- Damping курсора уменьшен до более плавного отклика (`0.045`).
- Parallax ограничен мягкими значениями: небольшой pan/tilt без резких рывков.
- Idle motion снижен до микродрейфа (`0.0025–0.0032`), чтобы планеты не уходили из своих зон.
- Малые планеты слегка уменьшены и визуально доработаны: clearcoat, rim, glow, glint, icon scale.
- Иконки перерисовываются в большем canvas texture (`192px`) с более уверенным stroke.
- Орбиты очищены: тоньше основная трубка, слабее внешний glow, меньше distracting markers.
- Центральный DOM-core визуально уменьшен через CSS; паразитное свечение/тень ослаблены.
- Подписи оставлены привязанными к projection соответствующих планет; offsets уменьшены и стабилизированы.
- Тесты обновлены под текущий WebGL/Tubes/parallax contract.

## Visual QA status

Browser screenshot в этой среде не удалось создать: системный Chromium блокирует loopback URL (`net::ERR_BLOCKED_BY_ADMINISTRATOR`).

Статус патча: **BUILD GREEN, VISUAL QA требует проверки у пользователя в браузере**.

## Gates

Выполнено в `/mnt/data/respio_0138_repo/apps/web`:

- `npm ci` — GREEN, 0 vulnerabilities
- `npm run typecheck` — GREEN
- `npm run lint` — GREEN
- `npm run test:unit` — GREEN, 27/27
- `npm run test:design-tokens` — GREEN, 65/65
- `npm run validate:css-syntax` — GREEN
- `npm run build` — GREEN, 31/31 routes
- `npm audit --omit=dev` — 0 vulnerabilities

## Install

Распаковать архив в `C:\Work\respio` с заменой файлов.

```powershell
cd C:\Work\respio\apps\web
npm ci
npm run dev
```

Открыть `http://localhost:3000`.

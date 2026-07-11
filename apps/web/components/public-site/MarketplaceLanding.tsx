import Link from "next/link";

import type { MarketplaceConfig } from "../../lib/site-config";
import { PublicShell } from "./PublicShell";

type MarketplaceLandingProps = {
  marketplace: MarketplaceConfig;
};

const implementationChecks = [
  "Проверить актуальный официальный API и доступные права",
  "Подтвердить получение отзывов и вопросов в реальном кабинете",
  "Проверить отправку ответа, статусы модерации и ограничения",
  "Реализовать нормализацию, ошибки, лимиты и health-check",
  "Пройти end-to-end тест с реальными credentials без утечки секретов",
];

export function MarketplaceLanding({ marketplace }: MarketplaceLandingProps) {
  const isMvp = marketplace.status === "mvp";

  return (
    <PublicShell>
      <section className="public-subhero public-subhero-marketplace-detail">
        <div className="public-container public-subhero-grid">
          <div className="public-subhero-copy">
            <span className={`public-status public-status-${marketplace.status}`}>
              {marketplace.statusLabel}
            </span>
            <p className="eyebrow">Respio × {marketplace.name}</p>
            <h1>
              {isMvp
                ? `Автоматические ответы на отзывы и вопросы ${marketplace.name}`
                : `Интеграция Respio с ${marketplace.name}: текущий статус и план проверки`}
            </h1>
            <p className="public-lead">{marketplace.summary}</p>
            <div className="hero-actions">
              <Link className="button button-primary" href={isMvp ? "/auth/register?intent=connect-marketplace" : "/contacts"}>
                {isMvp ? "Подключить маркетплейс" : "Обсудить интеграцию"}
              </Link>
              <Link className="button button-secondary" href="/marketplaces">
                Все маркетплейсы
              </Link>
            </div>
          </div>

          <aside className={`integration-status-panel integration-status-panel-${marketplace.status}`} aria-label="Статус интеграции">
            <div className="integration-status-topline">
              <span className="marketplace-monogram marketplace-monogram-large" aria-hidden="true">{marketplace.shortName}</span>
              <span className={`public-status public-status-${marketplace.status}`}>{marketplace.statusLabel}</span>
            </div>
            <strong>{isMvp ? "Техническая основа уже существует" : "Production-доступность пока не заявляется"}</strong>
            <p>
              {isMvp
                ? "Перед production-запуском всё равно нужны реальные API credentials, проверка scopes, rate limits и end-to-end тест с конкретным кабинетом."
                : "Отдельная публичная страница не означает готовую интеграцию. Сначала нужно подтвердить официальный API-контракт и фактический сценарий отправки ответов."}
            </p>
          </aside>
        </div>
      </section>

      {isMvp ? (
        <>
          <section className="public-section">
            <div className="public-container">
              <div className="section-heading section-heading-wide">
                <p className="eyebrow">Что уже входит в MVP-основу</p>
                <h2>Путь от импорта обращения до контролируемой отправки</h2>
                <p>Это описание текущей технической реализации, а не обещание production-готовности без проверки реального кабинета.</p>
              </div>

              <div className="integration-flow-list" aria-label="Этапы обработки обращения">
                {[
                  ["01", "Получить и нормализовать", "Adapter получает отзывы и вопросы, приводит payload к внутренним моделям и подавляет дубли."],
                  ["02", "Подготовить ответ", "AI использует необходимый контекст, а система фиксирует модель, токены, задержку и стоимость."],
                  ["03", "Проверить через SafetyGate", "Рискованные обещания, недостаток контекста и низкая уверенность могут остановить автоотправку."],
                  ["04", "Применить правила и квоты", "Учитываются тип обращения, рейтинг, ключевые слова, товары, чувствительные темы и лимиты."],
                  ["05", "Отправить через очередь", "Worker выполняет задачу, временные ошибки могут перейти в retry, результат фиксируется в audit trail."],
                ].map(([number, title, text]) => (
                  <article className="integration-flow-row" key={number}>
                    <span>{number}</span>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="public-section public-section-muted">
            <div className="public-container public-two-column public-two-column-balanced">
              <div>
                <p className="eyebrow">Что ещё нужно подтвердить перед production</p>
                <h2>Наличие кода — не то же самое, что проверенная интеграция</h2>
              </div>
              <div className="public-check-list public-check-list-large">
                <p>Права реального API-ключа и допустимые scopes.</p>
                <p>Поведение API на реальных отзывах и вопросах.</p>
                <p>Rate limits, модерация ответа и marketplace-specific ошибки.</p>
                <p>End-to-end отправка, retry и защита от дублей с конкретным кабинетом.</p>
              </div>
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="public-section">
            <div className="public-container">
              <div className="section-heading section-heading-wide">
                <p className="eyebrow">До начала реализации</p>
                <h2>Пять проверок, без которых интеграция не считается готовой</h2>
                <p>Мы не создаём пустой adapter и не показываем неподтверждённую функцию как доступную пользователю.</p>
              </div>

              <ol className="integration-checklist">
                {implementationChecks.map((item, index) => (
                  <li key={item}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <p>{item}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section className="public-section public-section-muted">
            <div className="public-container public-two-column public-two-column-balanced">
              <div>
                <p className="eyebrow">Что уже подготовлено на уровне продукта</p>
                <h2>Новая площадка должна встроиться в общий pipeline, а не породить параллельную архитектуру</h2>
              </div>
              <div className="public-check-list public-check-list-large">
                <p>Общие внутренние модели сообщений и товаров.</p>
                <p>SafetyGate и правила автоматизации поверх нормализованного контекста.</p>
                <p>Очередь, повторы, ключи идемпотентности и журнал событий.</p>
                <p>Backend-only хранение зашифрованных marketplace credentials.</p>
              </div>
            </div>
          </section>
        </>
      )}

      <section className="public-section public-cta-section">
        <div className="public-container public-cta-card">
          <div>
            <p className="eyebrow">Следующий шаг</p>
            <h2>{isMvp ? "Посмотрите, как Respio принимает решение об автоматической отправке" : `Нужна интеграция с ${marketplace.name}? Обсудим реальный сценарий и API-доступ`}</h2>
          </div>
          <Link className="button button-primary button-on-dark" href={isMvp ? "/demo" : "/contacts"}>
            {isMvp ? "Открыть демо" : "Обсудить интеграцию"}
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}

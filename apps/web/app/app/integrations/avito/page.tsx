import Link from "next/link";

export default function AvitoIntegrationPage() {
  return (
    <section className="app-page app-page-wide planned-integration-page">
      <header className="app-header app-header-row planned-integration-header">
        <div>
          <p className="eyebrow">Авито</p>
          <h1>Интеграция Авито находится в плане</h1>
          <p>
            MPReply не открывает подключение раньше времени: сначала должны быть проверены актуальные официальные API, синхронизация сообщений и production-отправка ответов.
          </p>
        </div>
        <div className="app-header-actions">
          <Link className="button button-secondary button-compact" href="/app/integrations">
            Все интеграции
          </Link>
          <span className="status-badge">Планируется</span>
        </div>
      </header>

      <section className="planned-integration-notice" aria-labelledby="avito-planned-title">
        <p className="eyebrow">Статус интеграции</p>
        <h2 id="avito-planned-title">Подключение пока недоступно</h2>
        <p>
          Форму доступа и синхронизацию Авито включим только после проверки реального API-контракта и безопасного сценария отправки. Сейчас рабочее подключение доступно для Wildberries.
        </p>
        <div className="planned-integration-actions">
          <Link className="button button-primary" href="/app/integrations/wildberries">Открыть Wildberries</Link>
          <Link className="button button-secondary" href="/app/integrations">Вернуться к интеграциям</Link>
        </div>
      </section>
    </section>
  );
}

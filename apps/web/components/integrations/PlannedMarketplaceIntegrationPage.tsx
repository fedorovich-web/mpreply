import Link from "next/link";

type PlannedMarketplaceIntegrationPageProps = {
  marketplaceName: string;
};

export function PlannedMarketplaceIntegrationPage({ marketplaceName }: PlannedMarketplaceIntegrationPageProps) {
  return (
    <section className="app-page app-page-wide">
      <header className="app-header app-header-row">
        <div>
          <p className="eyebrow">{marketplaceName}</p>
          <h1>{marketplaceName} — интеграция планируется</h1>
          <p>
            Подключение {marketplaceName} к MPReply пока недоступно. Мы показываем страницу интеграции заранее, чтобы статус площадки был понятен без имитации рабочего подключения.
          </p>
        </div>
        <div className="app-header-actions">
          <Link className="button button-secondary button-compact" href="/app/integrations">
            Все интеграции
          </Link>
          <span className="status-badge">Планируется</span>
        </div>
      </header>

      <div className="workspace-inline-state" role="status">
        <strong>Подключение пока недоступно</strong>
        <p>
          Сейчас в MPReply можно подключить Wildberries. Для {marketplaceName} форма доступа, синхронизация и отправка обращений не активируются до запуска интеграции.
        </p>
        <div className="app-header-actions">
          <Link className="button button-primary button-compact" href="/app/integrations/wildberries">
            Открыть Wildberries
          </Link>
          <Link className="button button-secondary button-compact" href="/app/integrations">
            Вернуться к интеграциям
          </Link>
        </div>
      </div>
    </section>
  );
}

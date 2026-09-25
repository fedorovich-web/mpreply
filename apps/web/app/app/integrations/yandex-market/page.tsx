import Link from "next/link";

import { YandexMarketIntegrationWorkspace } from "../../../../components/integrations/YandexMarketIntegrationWorkspace";

export default function YandexMarketIntegrationPage() {
  return (
    <section className="app-page app-page-wide marketplace-integration-page">
      <header className="app-header app-header-row marketplace-integration-header">
        <div>
          <p className="eyebrow">Яндекс Маркет</p>
          <h1>Подключение кабинетов Яндекс Маркета</h1>
          <p>
            Подключайте Business ID и API-ключ, синхронизируйте отзывы и вопросы и безопасно отправляйте ответы через MPReply.
          </p>
        </div>
        <div className="app-header-actions">
          <Link className="button button-secondary button-compact" href="/app/integrations">
            Все интеграции
          </Link>
          <span className="status-badge">Подключение доступно</span>
        </div>
      </header>

      <YandexMarketIntegrationWorkspace />
    </section>
  );
}

import Link from "next/link";

import { YandexMarketIntegrationWorkspace } from "../../../../components/integrations/YandexMarketIntegrationWorkspace";

export default function YandexMarketIntegrationPage() {
  return (
    <section className="app-page app-page-wide">
      <header className="app-header app-header-row">
        <div>
          <h1>Кабинеты Яндекс Маркета</h1>
          <p>Подключайте Business ID и API-ключ, проверяйте права и управляйте синхронизацией отзывов и вопросов.</p>
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

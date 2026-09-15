import Link from "next/link";

import { WildberriesIntegrationWorkspace } from "../../../../components/integrations/WildberriesIntegrationWorkspace";

export default function WildberriesIntegrationPage() {
  return (
    <section className="app-page app-page-wide">
      <header className="app-header app-header-row">
        <div>
          <p className="eyebrow">Wildberries</p>
          <h1>Кабинеты Wildberries, ключи и синхронизация</h1>
          <p>
            Создавайте подключения, проверяйте API-ключи, запускайте синхронизацию, заменяйте или
            отзывайте ключи. Сохранённый секрет не возвращается в браузер.
          </p>
        </div>
        <div className="app-header-actions">
          <Link className="button button-secondary button-compact" href="/app/integrations">
            Все интеграции
          </Link>
          <span className="status-badge">Доступно в MVP</span>
        </div>
      </header>

      <WildberriesIntegrationWorkspace />
    </section>
  );
}

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
            Управляйте реальными marketplace accounts: создавайте подключение, проверяйте API-ключ,
            запускайте синхронизацию, заменяйте или отзывайте credentials без возврата raw secret во frontend.
          </p>
        </div>
        <div className="app-header-actions">
          <Link className="button button-secondary button-compact" href="/app/integrations">
            Все интеграции
          </Link>
          <span className="status-badge">WB MVP adapter</span>
        </div>
      </header>

      <WildberriesIntegrationWorkspace />
    </section>
  );
}

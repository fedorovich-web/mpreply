import Link from "next/link";

import { MarketplaceIntegrationWorkspace } from "../../../../components/integrations/WildberriesIntegrationWorkspace";

export default function OzonIntegrationPage() {
  return (
    <section className="app-page app-page-wide">
      <header className="app-header app-header-row">
        <div>
          <p className="eyebrow">Ozon</p>
          <h1>Кабинеты Ozon и синхронизация</h1>
          <p>
            Подключайте кабинеты, управляйте доступом, запускайте синхронизацию и выбирайте режим обработки обращений покупателей.
          </p>
        </div>
        <div className="app-header-actions">
          <Link className="button button-secondary button-compact" href="/app/integrations">
            Все интеграции
          </Link>
          <span className="status-badge">Интеграция готова</span>
        </div>
      </header>

      <MarketplaceIntegrationWorkspace
        credentialLabel="Данные доступа Ozon"
        marketplace="ozon"
        marketplaceName="Ozon"
        placeholder="Например, Ozon — основной магазин"
      />
    </section>
  );
}

import Link from "next/link";

import { MarketplaceIntegrationWorkspace } from "../../../../components/integrations/WildberriesIntegrationWorkspace";

export default function AvitoIntegrationPage() {
  return (
    <section className="app-page app-page-wide marketplace-integration-page">
      <header className="app-header app-header-row marketplace-integration-header">
        <div>
          <p className="eyebrow">Авито</p>
          <h1>Аккаунты Авито и синхронизация</h1>
          <p>
            Подключайте аккаунты, управляйте доступом, запускайте синхронизацию и выбирайте режим обработки сообщений покупателей.
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
        credentialLabel="Данные доступа Авито"
        marketplace="avito"
        marketplaceName="Авито"
        placeholder="Например, Авито — основной аккаунт"
      />
    </section>
  );
}

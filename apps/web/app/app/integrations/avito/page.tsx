import Link from "next/link";

import { MarketplaceIntegrationWorkspace } from "../../../../components/integrations/WildberriesIntegrationWorkspace";

export default function AvitoIntegrationPage() {
  return (
    <section className="app-page app-page-wide marketplace-integration-page">
      <header className="app-header app-header-row marketplace-integration-header">
        <div>
          <p className="eyebrow">Авито</p>
          <h1>Подключение аккаунтов Авито</h1>
          <p>
            Добавляйте аккаунты, проверяйте подключение, обновляйте сообщения покупателей и выбирайте, как MPReply должен работать с ответами.
          </p>
        </div>
        <div className="app-header-actions">
          <Link className="button button-secondary button-compact" href="/app/integrations">
            Все интеграции
          </Link>
          <span className="status-badge">Подключение доступно</span>
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

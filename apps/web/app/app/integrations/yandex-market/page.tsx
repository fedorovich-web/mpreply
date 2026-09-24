import Link from "next/link";

import { MarketplaceIntegrationWorkspace } from "../../../../components/integrations/WildberriesIntegrationWorkspace";

export default function YandexMarketIntegrationPage() {
  return (
    <section className="app-page app-page-wide marketplace-integration-page">
      <header className="app-header app-header-row marketplace-integration-header">
        <div>
          <p className="eyebrow">Яндекс Маркет</p>
          <h1>Подключение кабинетов Яндекс Маркета</h1>
          <p>
            Добавляйте кабинеты, проверяйте подключение, обновляйте обращения покупателей и выбирайте, как MPReply должен отправлять ответы.
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
        credentialLabel="Данные доступа Яндекс Маркета"
        marketplace="yandex_market"
        marketplaceName="Яндекс Маркет"
        placeholder="Например, Яндекс Маркет — основной магазин"
      />
    </section>
  );
}

import Link from "next/link";

import { YandexMarketIntegrationWorkspace } from "../../../../components/integrations/YandexMarketIntegrationWorkspace";

export default function YandexMarketIntegrationPage() {
  return (
    <section className="app-page app-page-wide">
      <header className="app-header app-header-row">
        <div>
          <p className="eyebrow">Яндекс Маркет</p>
          <h1>Кабинеты Яндекс Маркета, API-ключи и синхронизация</h1>
          <p>
            Подключайте Business ID и Api-Key, проверяйте права communication, синхронизируйте отзывы и вопросы,
            отправляйте ответы через официальный Partner API без передачи исходного ключа во frontend.
          </p>
        </div>
        <div className="app-header-actions">
          <Link className="button button-secondary button-compact" href="/app/integrations">
            Все интеграции
          </Link>
          <span className="status-badge">Partner API adapter</span>
        </div>
      </header>

      <YandexMarketIntegrationWorkspace />
    </section>
  );
}

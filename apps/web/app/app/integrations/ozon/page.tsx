import Link from "next/link";

import { OzonIntegrationWorkspace } from "../../../../components/integrations/OzonIntegrationWorkspace";

export default function OzonIntegrationPage() {
  return (
    <section className="app-page app-page-wide marketplace-integration-page">
      <header className="app-header app-header-row marketplace-integration-header">
        <div>
          <p className="eyebrow">Ozon</p>
          <h1>Подключение кабинетов Ozon</h1>
          <p>
            Подключайте Client ID и API-ключ, синхронизируйте отзывы и вопросы и отправляйте ответы через MPReply.
          </p>
        </div>
        <div className="app-header-actions">
          <Link className="button button-secondary button-compact" href="/app/integrations">
            Все интеграции
          </Link>
          <span className="status-badge">Подключение доступно</span>
        </div>
      </header>

      <OzonIntegrationWorkspace />
    </section>
  );
}

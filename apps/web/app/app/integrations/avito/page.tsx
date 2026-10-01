import Link from "next/link";

import { AvitoIntegrationWorkspace } from "../../../../components/integrations/AvitoIntegrationWorkspace";

export default function AvitoIntegrationPage() {
  return (
    <section className="app-page app-page-wide marketplace-integration-page">
      <header className="app-header app-header-row marketplace-integration-header">
        <div>
          <p className="eyebrow">Авито</p>
          <h1>Подключение аккаунтов Авито</h1>
          <p>
            Подключайте Avito User ID, Client ID и Client Secret, синхронизируйте чаты и доступные для ответа отзывы и отвечайте покупателям из MPReply.
          </p>
        </div>
        <div className="app-header-actions">
          <Link className="button button-secondary button-compact" href="/app/integrations">
            Все интеграции
          </Link>
          <span className="status-badge">Подключение доступно</span>
        </div>
      </header>

      <AvitoIntegrationWorkspace />
    </section>
  );
}

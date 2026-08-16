import Link from "next/link";

import { AvitoIntegrationWorkspace } from "../../../../components/integrations/AvitoIntegrationWorkspace";

export default function AvitoIntegrationPage() {
  return (
    <section className="app-page app-page-wide">
      <header className="app-header app-header-row">
        <div>
          <h1>Кабинеты Авито</h1>
          <p>Подключайте Client ID и Client Secret, проверяйте доступ и управляйте синхронизацией чатов.</p>
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

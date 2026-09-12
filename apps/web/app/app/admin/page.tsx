import { AdminOverviewWorkspace } from "../../../components/admin/AdminOverviewWorkspace";

export default function AdminPage() {
  return (
    <section className="app-page app-page-wide admin-page">
      <header className="app-header app-header-row admin-page-header">
        <div>
          <p className="eyebrow">Администрирование</p>
          <h1>Системная сводка MPReply</h1>
          <p>
            Внутренние показатели продукта: организации и пользователи, подписки, использование, оценка расходов на ИИ и ошибки фоновых процессов.
          </p>
        </div>
        <div className="app-header-actions" aria-label="Назначение раздела">
          <span className="status-badge">Только superadmin</span>
          <span className="status-badge">Системные данные</span>
        </div>
      </header>

      <AdminOverviewWorkspace />
    </section>
  );
}

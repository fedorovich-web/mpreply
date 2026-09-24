import { AdminOverviewWorkspace } from "../../../components/admin/AdminOverviewWorkspace";

export default function AdminPage() {
  return (
    <section className="app-page app-page-wide admin-page">
      <header className="admin-page-hero">
        <div className="admin-page-hero-copy">
          <p className="eyebrow">Администрирование MPReply</p>
          <h1>Системная панель MPReply</h1>
          <p>
            Контролируйте состояние продукта, нагрузку, подписки и ошибки фоновых процессов
            в одном внутреннем рабочем пространстве.
          </p>
          <div className="admin-page-hero-badges" aria-label="Параметры доступа">
            <span>Только superadmin</span>
            <span>Живые системные данные</span>
            <span>Внутренний контур</span>
          </div>
        </div>

        <div className="admin-page-hero-preview" aria-hidden="true">
          <div className="admin-page-preview-window">
            <div className="admin-page-preview-topbar">
              <span className="admin-page-preview-logo" />
              <span className="admin-page-preview-title" />
              <span className="admin-page-preview-status" />
            </div>
            <div className="admin-page-preview-body">
              <span className="admin-page-preview-rail" />
              <div className="admin-page-preview-content">
                <span className="admin-page-preview-line admin-page-preview-line-wide" />
                <div className="admin-page-preview-cards">
                  <span />
                  <span />
                  <span />
                </div>
                <span className="admin-page-preview-chart" />
                <span className="admin-page-preview-line admin-page-preview-line-short" />
              </div>
            </div>
          </div>
        </div>
      </header>

      <AdminOverviewWorkspace />
    </section>
  );
}

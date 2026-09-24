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
            <span>Без изменений backend</span>
          </div>
        </div>

        <div className="admin-page-hero-mark" aria-hidden="true">
          <span className="admin-page-hero-mark-ring" />
          <span className="admin-page-hero-mark-core">M</span>
          <span className="admin-page-hero-mark-dot admin-page-hero-mark-dot-a" />
          <span className="admin-page-hero-mark-dot admin-page-hero-mark-dot-b" />
        </div>
      </header>

      <AdminOverviewWorkspace />
    </section>
  );
}

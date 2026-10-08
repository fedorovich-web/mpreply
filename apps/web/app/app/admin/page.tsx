import { AdminOverviewWorkspace } from "../../../components/admin/AdminOverviewWorkspace";

export default function AdminPage() {
  return (
    <section className="app-page app-page-wide admin-page">
      <header className="app-header admin-page-header">
        <h1>Администрирование</h1>
        <p>
          Сверяйте состояние продукта, организаций, подписок и фоновых процессов по одной системной сводке.
        </p>
      </header>

      <AdminOverviewWorkspace />
    </section>
  );
}

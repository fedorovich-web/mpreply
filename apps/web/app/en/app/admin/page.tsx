import { AdminOverviewWorkspace } from "../../../../components/admin/AdminOverviewWorkspace";
import { AdminUsersWorkspace } from "../../../../components/admin/AdminUsersWorkspace";

export default function EnglishAdminPage() {
  return (
    <section className="app-page app-page-wide admin-page">
      <header className="app-header admin-page-header">
        <h1>Administration</h1>
        <p>
          Review product health, organizations, subscriptions, usage, and background-process signals in one system overview.
        </p>
      </header>

      <AdminOverviewWorkspace />
      <AdminUsersWorkspace />
    </section>
  );
}

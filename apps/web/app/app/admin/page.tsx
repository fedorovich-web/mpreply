import { AdminOverviewWorkspace } from "../../../components/admin/AdminOverviewWorkspace";

export default function AdminPage() {
  return <section className="app-page"><section className="app-header"><p className="eyebrow">Internal admin</p><h1>MPReply superadmin overview</h1><p>Внутренняя системная сводка. Доступ контролируется backend-флагом <code>is_superadmin</code>, а не frontend bypass.</p></section><AdminOverviewWorkspace /></section>;
}

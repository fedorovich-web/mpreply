import { AdminOverviewWorkspace } from "../../../components/admin/AdminOverviewWorkspace";

export default function AdminPage() {
  return <section className="app-page"><section className="app-header"><p className="eyebrow">Администрирование</p><h1>Системная сводка Respio</h1><p>Доступ к внутренним показателям разрешён только системным администраторам и проверяется сервером.</p></section><AdminOverviewWorkspace /></section>;
}

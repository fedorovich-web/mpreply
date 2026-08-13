import { AuditLogWorkspace } from "../../../components/audit/AuditLogWorkspace";

export default function AuditLogPage() { return <section className="app-page app-page-wide"><header className="app-header"><p className="eyebrow">Управление</p><h1>Журнал действий</h1><p>История изменений команды, настроек, правил и подключений.</p></header><AuditLogWorkspace /></section>; }

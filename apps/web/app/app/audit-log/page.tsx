import { AuditLogWorkspace } from "../../../components/audit/AuditLogWorkspace";

export default function AuditLogPage() { return <section className="app-page app-page-wide"><header className="app-header"><h1>История изменений</h1><p>Проверьте, кто и когда менял доступ, настройки ответов и подключения.</p></header><AuditLogWorkspace /></section>; }

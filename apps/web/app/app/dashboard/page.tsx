export default function DashboardPage() {
  return (
    <main className="app-page">
      <section className="app-header">
        <p className="eyebrow">Dashboard</p>
        <h1>Автоответы Respio</h1>
        <p>Базовый dashboard для Sprint 1: auth, workspace и роли.</p>
      </section>
      <section className="dashboard-cards">
        <article className="metric-card">
          <span>Режим по умолчанию</span>
          <strong>Автоматический</strong>
        </article>
        <article className="metric-card">
          <span>Workspace</span>
          <strong>Создаётся через API</strong>
        </article>
        <article className="metric-card">
          <span>RBAC</span>
          <strong>Owner / Admin / Manager / Viewer</strong>
        </article>
      </section>
    </main>
  );
}

import Link from "next/link";

export default function AppDashboardPage() {
  return (
    <main className="app-page">
      <section className="app-header">
        <p className="eyebrow">Workspace</p>
        <h1>Respio workspace</h1>
        <p>Автоответы включены по умолчанию. Sprint 1 добавляет auth, organizations и RBAC.</p>
      </section>
      <section className="dashboard-cards">
        <article className="metric-card">
          <span>Режим</span>
          <strong>Автоматический</strong>
        </article>
        <article className="metric-card">
          <span>Роли</span>
          <strong>Owner / Admin / Manager / Viewer</strong>
        </article>
        <article className="metric-card">
          <span>Следующий шаг</span>
          <strong>Credentials encryption</strong>
        </article>
      </section>
      <div className="hero-actions app-actions">
        <Link className="button button-primary" href="/auth/register">
          Создать аккаунт
        </Link>
        <Link className="button button-secondary" href="/app/dashboard">
          Открыть dashboard
        </Link>
      </div>
    </main>
  );
}

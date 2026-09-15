import Link from "next/link";

export default function AppDashboardPage() {
  return (
    <main className="app-page">
      <section className="app-header">
        <p className="eyebrow">Рабочее пространство</p>
        <h1>Respio</h1>
        <p>Автоматизация включена по умолчанию, а доступ к данным и действиям зависит от роли в организации.</p>
      </section>
      <section className="dashboard-cards">
        <article className="metric-card">
          <span>Режим</span>
          <strong>Автоматический</strong>
        </article>
        <article className="metric-card">
          <span>Роли</span>
          <strong>Владелец, администратор, менеджер, наблюдатель</strong>
        </article>
        <article className="metric-card">
          <span>Защита подключений</span>
          <strong>Ключи хранятся в зашифрованном виде</strong>
        </article>
      </section>
      <div className="hero-actions app-actions">
        <Link className="button button-primary" href="/auth/register">
          Создать аккаунт
        </Link>
        <Link className="button button-secondary" href="/app/dashboard">
          Открыть рабочую панель
        </Link>
      </div>
    </main>
  );
}

export default function AppDashboardPage() {
  return (
    <main className="app-page">
      <section className="app-header">
        <p className="eyebrow">Dashboard</p>
        <h1>Respio workspace</h1>
        <p>Автоответы включены по умолчанию. Следующий шаг — подключить Wildberries.</p>
      </section>
      <section className="dashboard-cards">
        <article className="metric-card">
          <span>Режим</span>
          <strong>Автоматический</strong>
        </article>
        <article className="metric-card">
          <span>Маркетплейсы</span>
          <strong>0 подключено</strong>
        </article>
        <article className="metric-card">
          <span>Требуют проверки</span>
          <strong>0</strong>
        </article>
      </section>
    </main>
  );
}

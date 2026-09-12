import { AnalyticsWorkspace } from "../../../components/analytics/AnalyticsWorkspace";

export default function AnalyticsPage() {
  return (
    <section className="app-page app-page-wide analytics-page">
      <header className="app-header app-header-row analytics-page-header">
        <div>
          <p className="eyebrow">Аналитика</p>
          <h1>Понимайте, где обращения требуют внимания</h1>
          <p>
            Все показатели рассчитываются по данным текущего рабочего пространства: объёму обращений, отправленным ответам, времени реакции, маркетплейсам и товарам.
          </p>
        </div>
        <div className="app-header-actions" aria-label="Состав аналитики">
          <span className="status-badge">7 / 30 / 90 дней</span>
          <span className="status-badge">Только реальные данные</span>
        </div>
      </header>

      <AnalyticsWorkspace />
    </section>
  );
}

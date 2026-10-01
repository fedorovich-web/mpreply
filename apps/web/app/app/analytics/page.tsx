import { AnalyticsWorkspace } from "../../../components/analytics/AnalyticsWorkspace";

export default function AnalyticsPage() {
  return (
    <section className="app-page app-page-wide analytics-page">
      <header className="app-header analytics-page-header">
        <h1>Аналитика</h1>
        <p>
          Следите за обращениями, скоростью ответов, площадками и товарами, которым нужно больше внимания.
        </p>
      </header>

      <AnalyticsWorkspace />
    </section>
  );
}

import { AnalyticsWorkspace } from "../../../../components/analytics/AnalyticsWorkspace";

export default function EnglishAnalyticsPage() {
  return (
    <section className="app-page app-page-wide analytics-page">
      <header className="app-header analytics-page-header">
        <h1>Analytics</h1>
        <p>
          Track customer-message volume, response speed, marketplace activity, and products that need more attention.
        </p>
      </header>

      <AnalyticsWorkspace />
    </section>
  );
}

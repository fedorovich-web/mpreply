import { DashboardMetrics } from "../../../../components/dashboard/DashboardMetrics";

export default function EnglishDashboardPage() {
  return (
    <section className="app-page dashboard-overview-page">
      <header className="app-header dashboard-overview-header">
        <h1>Overview</h1>
        <p>
          Track customer messages, the review queue, automation, and marketplace connection health in one place.
        </p>
      </header>
      <DashboardMetrics />
    </section>
  );
}

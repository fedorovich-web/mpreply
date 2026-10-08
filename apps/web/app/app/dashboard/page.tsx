import { DashboardMetrics } from "../../../components/dashboard/DashboardMetrics";

export default function DashboardPage() {
  return (
    <section className="app-page dashboard-overview-page">
      <header className="app-header dashboard-overview-header">
        <h1>Обзор</h1>
        <p>
          Следите за обращениями, очередью проверки, автоматизацией и состоянием подключений в одном месте.
        </p>
      </header>
      <DashboardMetrics />
    </section>
  );
}

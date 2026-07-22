import { DashboardMetrics } from "../../../components/dashboard/DashboardMetrics";

export default function DashboardPage() {
  return (
    <section className="app-page">
      <section className="app-header">
        <p className="eyebrow">Dashboard</p>
        <h1>Операционный центр MPReply</h1>
        <p>Live-сводка по обращениям, автоответам, ручной проверке, AI usage и текущему тарифному контексту выбранного workspace.</p>
      </section>
      <DashboardMetrics />
    </section>
  );
}

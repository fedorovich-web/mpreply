import { DashboardMetrics } from "../../../components/dashboard/DashboardMetrics";

export default function DashboardPage() {
  return (
    <section className="app-page">
      <section className="app-header">
        <p className="eyebrow">Главная</p>
        <h1>Операционный центр</h1>
        <p>Состояние обращений, автоматических ответов, ручной проверки и лимитов за выбранный период.</p>
      </section>
      <DashboardMetrics />
    </section>
  );
}

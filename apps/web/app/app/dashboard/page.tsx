import { DashboardMetrics } from "../../../components/dashboard/DashboardMetrics";

export default function DashboardPage() {
  return (
    <section className="app-page">
      <section className="app-header">
        <p className="eyebrow">Рабочая панель</p>
        <h1>Операционный центр Respio</h1>
        <p>Текущая сводка по обращениям, автоматическим ответам, ручной проверке, использованию ИИ и тарифу выбранной организации.</p>
      </section>
      <DashboardMetrics />
    </section>
  );
}

import { DashboardMetrics } from "../../../components/dashboard/DashboardMetrics";

export default function DashboardPage() {
  return (
    <section className="app-page dashboard-overview-page">
      <section className="app-header dashboard-overview-header">
        <p className="eyebrow">Обзор</p>
        <h1>Очереди, проверки и состояние автоматизации</h1>
        <p>
          Сначала — обращения и подключения, где нужно действие. Ниже — состояние правил и быстрые переходы к рабочим очередям.
        </p>
      </section>
      <DashboardMetrics />
    </section>
  );
}

import { DashboardMetrics } from "../../../components/dashboard/DashboardMetrics";

export default function DashboardPage() {
  return (
    <section className="app-page">
      <section className="app-header">
        <p className="eyebrow">Обзор</p>
        <h1>Главное по обращениям</h1>
        <p>Следите за входящими обращениями, отправленными ответами, очередью проверки и текущими лимитами в одном месте.</p>
      </section>
      <DashboardMetrics />
    </section>
  );
}

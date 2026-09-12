import { DashboardMetrics } from "../../../components/dashboard/DashboardMetrics";

export default function DashboardPage() {
  return (
    <section className="app-page">
      <section className="app-header">
        <p className="eyebrow">Рабочий обзор</p>
        <h1>Что происходит с обращениями</h1>
        <p>
          Смотрите текущую очередь, находите обращения без ответа и контролируйте, как команда и автоматизация обрабатывают входящие.
        </p>
      </section>
      <DashboardMetrics />
    </section>
  );
}

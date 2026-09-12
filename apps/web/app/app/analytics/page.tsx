import { AnalyticsWorkspace } from "../../../components/analytics/AnalyticsWorkspace";

export default function AnalyticsPage() {
  return (
    <section className="app-page">
      <section className="app-header">
        <p className="eyebrow">Аналитика</p>
        <h1>Обращения и ответы в цифрах</h1>
        <p>Смотрите объём обращений, скорость ответа, долю автоматизации, площадки и товары, которые требуют больше всего внимания.</p>
      </section>
      <AnalyticsWorkspace />
    </section>
  );
}

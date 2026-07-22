import { AnalyticsWorkspace } from "../../../components/analytics/AnalyticsWorkspace";

export default function AnalyticsPage() {
  return <section className="app-page"><section className="app-header"><p className="eyebrow">Analytics</p><h1>Операционная аналитика MPReply</h1><p>Реальные показатели по обращениям, ответам, маркетплейсам, товарам и AI usage внутри выбранного workspace.</p></section><AnalyticsWorkspace /></section>;
}

import { DashboardMetrics } from "../../../components/dashboard/DashboardMetrics";
import { AttentionQueue } from "../../../components/dashboard/AttentionQueue";
import { OnboardingChecklist } from "../../../components/onboarding/OnboardingChecklist";

export default function DashboardPage() {
  return (
    <section className="app-page">
      <header className="app-header">
        <h1>Сводка по отзывам и вопросам</h1>
        <p>Сначала — ответы и подключения, которые требуют вашего решения.</p>
      </header>
      <OnboardingChecklist />
      <AttentionQueue />
      <DashboardMetrics />
    </section>
  );
}

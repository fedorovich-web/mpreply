import { BillingWorkspace } from "../../../components/billing/BillingWorkspace";

export default function BillingPage() {
  return (
    <section className="app-page app-page-wide billing-page">
      <header className="app-header billing-page-header">
        <h1>Тариф и лимиты</h1>
        <p>
          Смотрите текущий тариф, расчётный период и использование доступных лимитов рабочего пространства.
        </p>
      </header>

      <BillingWorkspace />
    </section>
  );
}

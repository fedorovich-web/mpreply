import { BillingWorkspace } from "../../../components/billing/BillingWorkspace";

export default function BillingPage() {
  return (
    <section className="app-page">
      <section className="app-header">
        <p className="eyebrow">Тариф и лимиты</p>
        <h1>Текущий тариф и использование</h1>
        <p>Проверяйте доступные лимиты, текущий расход и параметры тарифа без скрытых расчётов и технических формулировок.</p>
      </section>
      <BillingWorkspace />
    </section>
  );
}

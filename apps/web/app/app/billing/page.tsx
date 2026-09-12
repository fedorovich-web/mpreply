import { BillingWorkspace } from "../../../components/billing/BillingWorkspace";

export default function BillingPage() {
  return (
    <section className="app-page app-page-wide billing-page">
      <header className="app-header app-header-row billing-page-header">
        <div>
          <p className="eyebrow">Тариф и лимиты</p>
          <h1>Контролируйте тариф и лимиты без скрытых расчётов</h1>
          <p>
            Цена отображается только когда она задана в текущем тарифе. Лимиты, фактическое использование, расчётный период и состояние подписки приходят из данных вашего рабочего пространства.
          </p>
        </div>
        <div className="app-header-actions" aria-label="Данные тарифа">
          <span className="status-badge">Фактическое использование</span>
          <span className="status-badge">Без выдуманной цены</span>
        </div>
      </header>

      <BillingWorkspace />
    </section>
  );
}

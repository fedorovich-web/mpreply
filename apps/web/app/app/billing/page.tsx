import { BillingWorkspace } from "../../../components/billing/BillingWorkspace";

export default function BillingPage() {
  return <section className="app-page"><section className="app-header"><p className="eyebrow">Тариф</p><h1>Тариф и лимиты</h1><p>Текущий тариф, расчётный период и фактическое использование без неподтверждённых цен.</p></section><BillingWorkspace /></section>;
}

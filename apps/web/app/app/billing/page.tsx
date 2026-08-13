import { BillingWorkspace } from "../../../components/billing/BillingWorkspace";

export default function BillingPage() {
  return <section className="app-page"><header className="app-header"><h1>Тариф и использование</h1><p>Проверьте текущий тариф, расчётный период и доступные лимиты.</p></header><BillingWorkspace /></section>;
}

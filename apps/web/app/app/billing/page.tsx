import { BillingWorkspace } from "../../../components/billing/BillingWorkspace";

export default function BillingPage() {
  return <section className="app-page"><section className="app-header"><p className="eyebrow">Billing</p><h1>Тариф, usage и лимиты</h1><p>Billing-ready foundation без выдуманных цен: текущий план, период usage, лимиты и задел под платёжного провайдера.</p></section><BillingWorkspace /></section>;
}

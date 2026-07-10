import type { Metadata } from "next";
import Link from "next/link";

import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Тарифы",
  description:
    "Тарифная архитектура Respio: подписка, включённый объём ответов и usage-based overage. Финальные цены будут опубликованы перед коммерческим запуском.",
  path: "/pricing",
});

const plans = [
  { name: "Start", audience: "Для одного кабинета и первого сценария автоматизации", features: ["Auto-first режим", "AI drafts", "SafetyGate", "Базовые правила"] },
  { name: "Growth", audience: "Для растущего магазина с большим потоком обращений", features: ["Больше включённого usage", "Расширенные automation rules", "Приоритетная очередь", "Базовая аналитика"] },
  { name: "Team", audience: "Для команды поддержки и нескольких участников workspace", features: ["RBAC", "Ручная проверка", "Audit log", "Командный workflow"] },
  { name: "Agency", audience: "Для агентств и нескольких клиентских контуров", features: ["Расширенная tenant-модель", "Несколько workspace", "Управление лимитами", "Отчётность"] },
];

export default function PricingPage() {
  return (
    <PublicShell>
      <section className="public-hero public-hero-compact">
        <div className="public-container public-hero-copy public-hero-copy-centered">
          <p className="eyebrow">Pricing foundation</p>
          <h1>Тарифы без выдуманных цифр до финализации unit economics</h1>
          <p className="public-lead">
            Модель тарификации: подписка + включённый объём ответов + overage. Конкретные цены не публикуются, пока не завершены FinOps-расчёты, AI cost model и коммерческая проверка.
          </p>
        </div>
      </section>
      <section className="public-section">
        <div className="public-container pricing-grid">
          {plans.map((plan) => (
            <article className="pricing-card" key={plan.name}>
              <span className="panel-kicker">План</span>
              <h2>{plan.name}</h2>
              <p>{plan.audience}</p>
              <strong className="pricing-state">Цена будет опубликована перед запуском</strong>
              <ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
            </article>
          ))}
        </div>
      </section>
      <section className="public-section public-cta-section">
        <div className="public-container public-cta-card">
          <div><p className="eyebrow">Без скрытых обещаний</p><h2>Сначала подтверждаем себестоимость и лимиты — потом фиксируем цену</h2></div>
          <Link className="button button-primary" href="/contacts">Связаться</Link>
        </div>
      </section>
    </PublicShell>
  );
}

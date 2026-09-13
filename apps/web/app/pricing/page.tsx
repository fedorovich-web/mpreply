import type { Metadata } from "next";
import Link from "next/link";

import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Тарифы Respio — модель оплаты и принципы расчёта",
  description:
    "Как будет устроена тарификация Respio: подписка, включённый объём операций и прозрачный перерасход. Финальные цены публикуются только после проверки себестоимости.",
  path: "/pricing",
});

const pricingParts = [
  {
    title: "Подписка",
    text: "Оплата за доступ к продукту, интеграционному контуру, правилам, очередям, журналу и рабочему месту команды.",
  },
  {
    title: "Включённый объём",
    text: "В тариф входит определённый объём AI-обработки и отправок. Конкретные лимиты будут рассчитаны по реальной себестоимости.",
  },
  {
    title: "Прозрачный перерасход",
    text: "Если объём превышен, дополнительное использование должно быть видно заранее и не превращаться в скрытый платёж.",
  },
];

const audienceModes = [
  ["Один продавец", "Один или несколько кабинетов, базовая автоматизация и понятные лимиты."],
  ["Команда", "Роли, ручная проверка исключений, журнал действий и распределение ответственности."],
  ["Агентство", "Несколько клиентских организаций, изоляция данных и отдельная отчётность по контурам."],
];

export default function PricingPage() {
  return (
    <PublicShell>
      <section className="public-subhero public-subhero-pricing">
        <div className="public-container public-subhero-grid">
          <div className="public-subhero-copy">
            <p className="eyebrow">Тарифы</p>
            <h1>Цена будет опубликована только после проверки реальной себестоимости</h1>
            <p className="public-lead">
              Мы не ставим на страницу выдуманные суммы ради красивого pricing-блока. Сначала считаем стоимость AI, инфраструктуры, повторных попыток, хранения и поддержки — затем фиксируем лимиты и цены.
            </p>
          </div>

          <aside className="pricing-principle-panel">
            <span className="panel-kicker">Базовая модель</span>
            <strong>Подписка + включённый объём + прозрачный перерасход</strong>
            <p>Эта модель учитывает не только генерацию текста, но и весь операционный контур Respio.</p>
          </aside>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container">
          <div className="section-heading section-heading-wide">
            <h2>Платформа выполняет больше работы, чем один AI-запрос</h2>
            <p>Получение данных, контекст, SafetyGate, правила, очередь, повторы, отправка, журнал и аналитика тоже входят в продукт.</p>
          </div>

          <div className="pricing-model-grid">
            {pricingParts.map((part) => (
              <article className="pricing-model-item" key={part.title}>
                <h3>{part.title}</h3>
                <p>{part.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section public-section-muted">
        <div className="public-container">
          <div className="section-heading section-heading-wide">
            <h2>Тариф должен учитывать способ работы, а не просто число карточек на странице</h2>
          </div>

          <div className="audience-pricing-list">
            {audienceModes.map(([title, text]) => (
              <article className="audience-pricing-row" key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
                <span>Конкретные лимиты — после FinOps-проверки</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container public-two-column public-two-column-balanced">
          <div>
            <h2>Пользователь должен заранее понимать, за что платит и что произойдёт при достижении лимита</h2>
          </div>
          <div className="public-check-list public-check-list-large">
            <p>Текущий расход и остаток включённого объёма.</p>
            <p>Какая операция расходует лимит и сколько именно.</p>
            <p>Что произойдёт после достижения квоты.</p>
            <p>Как изменится доступ при смене тарифа или организации.</p>
          </div>
        </div>
      </section>

      <section className="public-section public-cta-section">
        <div className="public-container public-cta-card">
          <div>
            <h2>Нужен пилот или хотите обсудить требования к тарифу для вашей команды?</h2>
          </div>
          <Link className="button button-primary button-on-dark" href="/contacts">
            Обсудить подключение
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}

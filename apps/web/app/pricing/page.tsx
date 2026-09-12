import type { Metadata } from "next";
import Link from "next/link";

import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Тарифы MPReply — автоматизация ответов для маркетплейсов",
  description:
    "Тарифная модель MPReply для продавцов и команд: подписка, включённый объём обработки и прозрачные лимиты. Финальные цены публикуются после проверки фактической себестоимости.",
  path: "/pricing",
});

const pricingParts = [
  {
    number: "01",
    title: "Доступ к продукту",
    text: "Рабочее пространство, интеграции с маркетплейсами, единая очередь, правила автоматизации, история обработки и командные сценарии.",
  },
  {
    number: "02",
    title: "Включённый объём",
    text: "В тариф будет входить определённый объём ИИ-обработки и операций. Лимиты должны опираться на реальную нагрузку, а не на выдуманные цифры в лендинге.",
  },
  {
    number: "03",
    title: "Понятный перерасход",
    text: "Если использование выйдет за включённый объём, дополнительный расход должен быть виден заранее вместе с правилами тарификации.",
  },
];

const audienceModes = [
  ["Продавец", "Несколько подключённых кабинетов, единая очередь обращений и базовые правила автоматизации."],
  ["Команда", "Совместная работа с ручной проверкой исключений, историей действий и распределением ответственности."],
  ["Агентство", "Раздельные рабочие пространства для клиентов и изоляция данных между организациями."],
];

export default function PricingPage() {
  return (
    <PublicShell>
      <section className="public-subhero public-subhero-pricing">
        <div className="public-container public-subhero-grid">
          <div className="public-subhero-copy">
            <p className="eyebrow">Тарифы MPReply</p>
            <h1>Без фальшивых цен до того, как понятна реальная экономика продукта</h1>
            <p className="public-lead">
              Финальные тарифы появятся после проверки фактической стоимости ИИ, инфраструктуры и обработки обращений. На этапе запуска важнее не нарисовать три красивые карточки, а зафиксировать честную модель оплаты.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/contacts">Обсудить пилот</Link>
              <Link className="button button-secondary" href="/features">Посмотреть возможности</Link>
            </div>
          </div>

          <aside className="pricing-principle-panel">
            <span className="panel-kicker">Принцип тарификации</span>
            <strong>Подписка + включённый объём + прозрачное дополнительное использование</strong>
            <p>Пользователь должен заранее понимать, что входит в тариф и что происходит при достижении лимита.</p>
          </aside>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container">
          <div className="section-heading section-heading-wide">
            <p className="eyebrow">Модель оплаты</p>
            <h2>Стоимость должна учитывать весь рабочий процесс, а не только один запрос к модели</h2>
            <p>Интеграции, очередь, повторные попытки, хранение состояния и командный интерфейс тоже являются частью продукта.</p>
          </div>

          <div className="pricing-model-grid">
            {pricingParts.map((part) => (
              <article className="pricing-model-item" key={part.number}>
                <span>{part.number}</span>
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
            <p className="eyebrow">Кому нужен продукт</p>
            <h2>Один продукт — разные объёмы и способы работы</h2>
          </div>

          <div className="audience-pricing-list">
            {audienceModes.map(([title, text]) => (
              <article className="audience-pricing-row" key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
                <span>Лимиты будут опубликованы после расчёта нагрузки</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container public-two-column public-two-column-balanced">
          <div>
            <p className="eyebrow">Прозрачность</p>
            <h2>Понятно, сколько используется и что произойдёт дальше</h2>
          </div>
          <div className="public-check-list public-check-list-large">
            <p>Текущий объём использования и остаток включённого лимита.</p>
            <p>Какие операции учитываются в тарифе.</p>
            <p>Что произойдёт после достижения лимита.</p>
            <p>Как меняются доступ и квоты при смене плана.</p>
          </div>
        </div>
      </section>

      <section className="public-section public-cta-section">
        <div className="public-container public-cta-card">
          <div>
            <p className="eyebrow">Ранний доступ</p>
            <h2>Хотите подключить свои маркетплейсы и обсудить условия пилота?</h2>
          </div>
          <Link className="button button-primary button-on-dark" href="/contacts">
            Обсудить подключение
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}

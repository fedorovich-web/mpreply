import type { Metadata } from "next";
import Link from "next/link";

import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Тарифы MPReply — автоматизация ответов для маркетплейсов",
  description:
    "Тарифы MPReply для продавцов, команд и агентств: маркетплейсы, обращения покупателей, ИИ-ответы, автоматизация и лимиты использования в одном сервисе.",
  path: "/pricing",
});

const pricingParts = [
  {
    number: "01",
    title: "Подключённые кабинеты",
    text: "Работайте с Wildberries, Ozon, Яндекс Маркетом и Авито из одного пространства и добавляйте нужные кабинеты по мере роста бизнеса.",
  },
  {
    number: "02",
    title: "Объём обращений и ИИ",
    text: "План учитывает объём обработки отзывов, вопросов и сообщений, а также использование ИИ для подготовки ответов.",
  },
  {
    number: "03",
    title: "Команда и автоматизация",
    text: "Используйте ручную проверку, автоответы и совместную работу команды в зависимости от вашего процесса.",
  },
];

const audienceModes = [
  ["Для продавца", "Единое окно для обращений, несколько кабинетов и автоматизация повторяющихся ответов."],
  ["Для команды", "Совместная работа, проверка отдельных ответов, правила автоматизации и история действий."],
  ["Для агентства", "Раздельные рабочие пространства для клиентов и удобное управление несколькими проектами."],
];

export default function PricingPage() {
  return (
    <PublicShell>
      <section className="public-subhero public-subhero-pricing">
        <div className="public-container public-subhero-grid">
          <div className="public-subhero-copy">
            <p className="eyebrow">Тарифы MPReply</p>
            <h1>Тариф под ваш объём обращений и способ работы</h1>
            <p className="public-lead">
              Стоимость зависит от подключённых кабинетов, объёма обработки и выбранного уровня автоматизации. Финальные планы и лимиты будут опубликованы перед коммерческим запуском.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">Создать аккаунт</Link>
              <Link className="button button-secondary" href="/contacts">Обсудить условия</Link>
            </div>
          </div>

          <aside className="pricing-principle-panel">
            <span className="panel-kicker">Как формируется тариф</span>
            <strong>Кабинеты, обращения, ИИ и возможности команды</strong>
            <p>Все основные параметры использования будут видны в кабинете — без скрытых ограничений и неожиданных списаний.</p>
          </aside>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container">
          <div className="section-heading section-heading-wide">
            <p className="eyebrow">Что влияет на стоимость</p>
            <h2>Платите за рабочий объём, а не за набор лишних функций</h2>
            <p>Выбирайте подходящий уровень использования по мере роста количества обращений, подключений и команды.</p>
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
            <p className="eyebrow">Для разных команд</p>
            <h2>От одного магазина до нескольких клиентских проектов</h2>
            <p>MPReply подходит как для самостоятельного продавца, так и для команды, которая ежедневно работает с большим потоком обращений.</p>
          </div>

          <div className="audience-pricing-list">
            {audienceModes.map(([title, text]) => (
              <article className="audience-pricing-row" key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
                <span>План под фактический объём работы</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container public-two-column public-two-column-balanced">
          <div>
            <p className="eyebrow">Контроль использования</p>
            <h2>Лимиты и текущее использование всегда перед глазами</h2>
          </div>
          <div className="public-check-list public-check-list-large">
            <p>Текущий объём обработанных обращений.</p>
            <p>Использование ИИ и доступный остаток.</p>
            <p>Количество подключённых кабинетов и участников команды.</p>
            <p>Понятный переход на другой план при росте нагрузки.</p>
          </div>
        </div>
      </section>

      <section className="public-section public-cta-section">
        <div className="public-container public-cta-card">
          <div>
            <p className="eyebrow">Начните с вашего рабочего сценария</p>
            <h2>Подключите маркетплейсы и посмотрите, как MPReply впишется в работу команды</h2>
          </div>
          <div className="cta-actions-on-dark">
            <Link className="button button-secondary button-secondary-on-dark" href="/demo">Посмотреть демо</Link>
            <Link className="button button-primary button-on-dark" href="/auth/register?intent=connect-marketplace">Создать аккаунт</Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

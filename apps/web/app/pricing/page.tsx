import type { Metadata } from "next";
import Link from "next/link";

import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Тарифы MPReply — автоматизация ответов для маркетплейсов",
  description:
    "Тарифы для работы с отзывами, вопросами и сообщениями покупателей на Wildberries, Ozon, Яндекс Маркете и Авито: единая очередь, ИИ-ответы, автоматизация и командная работа.",
  path: "/pricing",
});

const pricingParts = [
  {
    number: "01",
    title: "Подключённые кабинеты",
    text: "Добавляйте кабинеты Wildberries, Ozon, Яндекс Маркета и Авито и управляйте ими из одного рабочего пространства.",
  },
  {
    number: "02",
    title: "Объём обращений",
    text: "Учитывается фактический поток отзывов, вопросов и сообщений, которые проходят через общую очередь.",
  },
  {
    number: "03",
    title: "ИИ и автоматизация",
    text: "Используйте подготовку ответов, ручную проверку и автоотправку в том объёме, который нужен вашей команде.",
  },
];

const audienceModes = [
  ["Для продавца", "Один интерфейс для обращений с нескольких площадок, ИИ-черновики и автоматизация повторяющихся сценариев."],
  ["Для команды", "Общая очередь, проверка сложных ответов, единые правила и прозрачные статусы обработки."],
  ["Для агентства", "Отдельные рабочие пространства для клиентов и управление несколькими проектами без смешивания данных."],
];

const pricingAnswers = [
  ["Можно подключить несколько маркетплейсов?", "Да. Wildberries, Ozon, Яндекс Маркет и Авито работают в одном продукте, а кабинеты подключаются к общему рабочему пространству."],
  ["Что происходит при росте объёма обращений?", "Текущие лимиты и использование видны в кабинете. При росте нагрузки можно перейти на подходящий объём без переноса рабочего процесса в другой сервис."],
  ["Автоответы обязательны?", "Нет. Для каждого сценария можно сохранить проверку человеком и автоматизировать только ту рутину, которой команда доверяет."],
];

export default function PricingPage() {
  return (
    <PublicShell>
      <section className="public-subhero public-subhero-pricing">
        <div className="public-container public-subhero-grid">
          <div className="public-subhero-copy">
            <p className="eyebrow">Тарифы</p>
            <h1>План под ваш объём обращений и уровень автоматизации</h1>
            <p className="public-lead">
              Выбирайте тариф по рабочей нагрузке: сколько кабинетов подключено, сколько обращений проходит через сервис и как команда использует ИИ и автоответы.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">Создать аккаунт</Link>
              <Link className="button button-secondary" href="/contacts">Уточнить условия</Link>
            </div>
          </div>

          <div className="pricing-plan-scene" role="group" aria-label="Как рабочая нагрузка влияет на тариф MPReply">
            <div className="pricing-plan-window">
              <div className="pricing-plan-head">
                <div>
                  <span className="pricing-plan-head-mark" aria-hidden="true">MP</span>
                  <strong>Рабочий объём</strong>
                </div>
                <span>Тариф под нагрузку</span>
              </div>

              <div className="pricing-plan-usage">
                <div className="pricing-plan-usage-row">
                  <div className="pricing-plan-usage-copy">
                    <strong>Подключённые кабинеты</strong>
                    <small>Wildberries, Ozon, Яндекс Маркет, Авито</small>
                  </div>
                  <div className="pricing-plan-track" aria-hidden="true"><span /></div>
                  <small>зависит от процесса</small>
                </div>
                <div className="pricing-plan-usage-row">
                  <div className="pricing-plan-usage-copy">
                    <strong>Обращения покупателей</strong>
                    <small>Отзывы, вопросы и сообщения</small>
                  </div>
                  <div className="pricing-plan-track" aria-hidden="true"><span /></div>
                  <small>по фактической нагрузке</small>
                </div>
                <div className="pricing-plan-usage-row">
                  <div className="pricing-plan-usage-copy">
                    <strong>ИИ и автоматизация</strong>
                    <small>Подготовка, проверка, автоотправка</small>
                  </div>
                  <div className="pricing-plan-track" aria-hidden="true"><span /></div>
                  <small>по выбранному сценарию</small>
                </div>
              </div>

              <div className="pricing-plan-note">
                <span aria-hidden="true">↗</span>
                <div>
                  <strong>Использование видно в кабинете</strong>
                  <small>Команда понимает текущую нагрузку и доступный объём до изменения тарифа.</small>
                </div>
              </div>
            </div>

            <div className="pricing-plan-scale" role="group" aria-label="Типичные масштабы использования">
              <span><strong>Продавец</strong><small>Несколько площадок, единая очередь</small></span>
              <span><strong>Команда</strong><small>Проверка, правила и распределение работы</small></span>
              <span><strong>Агентство</strong><small>Несколько рабочих пространств и проектов</small></span>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container">
          <div className="section-heading section-heading-wide">
            <p className="eyebrow">Из чего складывается тариф</p>
            <h2>Рабочий объём важнее длинного списка функций</h2>
            <p>Основные возможности продукта остаются частью одного процесса — меняется объём подключений и обработки.</p>
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
            <p className="eyebrow">Под разные процессы</p>
            <h2>Один продукт — от самостоятельного продавца до команды с несколькими проектами</h2>
            <p>Не нужно менять рабочую схему при росте: единая очередь, правила и контроль ответов остаются знакомыми.</p>
          </div>

          <div className="audience-pricing-list">
            {audienceModes.map(([title, text]) => (
              <article className="audience-pricing-row" key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
                <span>Масштабируется вместе с нагрузкой</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container public-two-column public-two-column-balanced">
          <div>
            <p className="eyebrow">Контроль без сюрпризов</p>
            <h2>Использование и лимиты видны до того, как они станут проблемой</h2>
            <p className="public-copy-muted">Команда видит текущую нагрузку и может заранее скорректировать тариф или правила автоматизации.</p>
          </div>
          <div className="public-check-list public-check-list-large">
            <p>Объём обработанных обращений.</p>
            <p>Использование ИИ и доступный остаток.</p>
            <p>Подключённые кабинеты и рабочие пространства.</p>
            <p>Переход на другой объём без смены рабочего процесса.</p>
          </div>
        </div>
      </section>

      <section className="public-section public-section-muted">
        <div className="public-container public-two-column public-two-column-feature">
          <div>
            <p className="eyebrow">Частые вопросы</p>
            <h2>Что важно знать до подключения</h2>
            <p className="public-copy-muted">Коротко о площадках, росте нагрузки и контроле автоответов.</p>
          </div>
          <div className="resource-note-list">
            {pricingAnswers.map(([question, answer], index) => (
              <article className="resource-note" key={question}>
                <span className="resource-note-index">0{index + 1}</span>
                <div className="resource-note-copy">
                  <h3>{question}</h3>
                  <p>{answer}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section public-cta-section">
        <div className="public-container public-cta-card">
          <div>
            <p className="eyebrow">Проверьте на своём процессе</p>
            <h2>Подключите площадки и оцените работу с реальной очередью обращений</h2>
          </div>
          <div className="cta-actions-on-dark">
            <Link className="button button-secondary button-secondary-on-dark" href="/demo">Открыть демо</Link>
            <Link className="button button-primary button-on-dark" href="/auth/register?intent=connect-marketplace">Начать подключение</Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

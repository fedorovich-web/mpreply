import type { Metadata } from "next";
import Link from "next/link";

import { HomeWorkspaceTabs } from "../components/public-site/HomeWorkspaceTabs";
import { PublicShell } from "../components/public-site/PublicShell";
import { JsonLd } from "../components/seo/JsonLd";
import { createPageMetadata } from "../lib/seo";
import { marketplaces, siteConfig } from "../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "ИИ-автоответы на отзывы, вопросы и сообщения маркетплейсов",
  description:
    "MPReply собирает обращения с Wildberries, Ozon, Яндекс Маркета и Авито в одном окне, готовит ответы с помощью ИИ и автоматизирует отправку с контролем сложных случаев.",
  path: "/",
});

const faq = [
  {
    question: "Можно ли отправлять ответы автоматически?",
    answer:
      "Да. Для предсказуемых сценариев можно включить автоматическую отправку. Случаи с недостаточным контекстом, риском или отдельным правилом остаются на проверке команды.",
  },
  {
    question: "Какие маркетплейсы поддерживает MPReply?",
    answer:
      "В продукте реализованы интеграции с Wildberries, Ozon, Яндекс Маркетом и Авито. Конкретный набор доступных типов обращений зависит от возможностей API каждой площадки.",
  },
  {
    question: "ИИ отвечает одинаково на все обращения?",
    answer:
      "Нет. При подготовке ответа учитываются тип обращения, контекст товара и правила рабочего пространства. Команда может оставить автоматизацию только для тех сценариев, которые ей подходят.",
  },
  {
    question: "Что происходит, если площадка временно недоступна?",
    answer:
      "Интеграционный слой фиксирует ошибку и состояние обработки. Повторяемые операции защищены от случайной двойной отправки и могут быть повторены по правилам очереди.",
  },
];

export default function HomePage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: siteConfig.name,
      url: siteConfig.origin,
      description: siteConfig.description,
      inLanguage: "ru-RU",
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: siteConfig.name,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: siteConfig.description,
      url: siteConfig.origin,
    },
  ];

  return (
    <PublicShell>
      <JsonLd data={jsonLd} />

      <section className="homepage-hero">
        <div className="public-container homepage-hero-grid">
          <div className="homepage-hero-copy">
            <p className="homepage-kicker">ИИ для коммуникации на маркетплейсах</p>
            <h1>ИИ-автоответы на отзывы, вопросы и сообщения покупателей</h1>
            <p className="homepage-hero-lead">
              Собирайте обращения с Wildberries, Ozon, Яндекс Маркета и Авито в одном окне. ИИ готовит ответ с учётом контекста, а правила решают, отправить его автоматически или оставить на проверку.
            </p>
            <div className="homepage-hero-actions">
              <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">
                Создать аккаунт
              </Link>
              <Link className="button button-secondary" href="/demo">
                Посмотреть демо
              </Link>
            </div>
            <p className="homepage-hero-note">Без выдуманных метрик и обещаний: на странице показаны реальные сценарии продукта.</p>
          </div>

          <div className="homepage-hero-product" aria-label="Пример интерфейса MPReply">
            <div className="homepage-hero-product-topbar">
              <div>
                <span className="homepage-window-dot" />
                <span className="homepage-window-dot" />
                <span className="homepage-window-dot" />
              </div>
              <span>Входящие обращения</span>
            </div>
            <div className="homepage-hero-product-body">
              <aside className="homepage-hero-sidebar">
                <strong>MPReply</strong>
                <span className="is-active">Входящие</span>
                <span>Автоматизация</span>
                <span>Интеграции</span>
                <span>Аналитика</span>
              </aside>
              <div className="homepage-hero-feed">
                <div className="homepage-hero-feed-head">
                  <div>
                    <small>Сегодня</small>
                    <strong>Новые обращения</strong>
                  </div>
                  <span>Все площадки</span>
                </div>
                <article className="homepage-hero-feed-item is-selected">
                  <span className="homepage-marketplace-mark">WB</span>
                  <div>
                    <strong>Отзыв о товаре</strong>
                    <p>Очень понравилось качество, всё пришло вовремя.</p>
                  </div>
                  <small>Сейчас</small>
                </article>
                <article className="homepage-hero-feed-item">
                  <span className="homepage-marketplace-mark">OZ</span>
                  <div>
                    <strong>Вопрос покупателя</strong>
                    <p>Подскажите, пожалуйста, какой размер выбрать?</p>
                  </div>
                  <small>4 мин</small>
                </article>
                <div className="homepage-hero-draft">
                  <span>ИИ подготовил ответ</span>
                  <p>Спасибо за вопрос. Поможем выбрать размер по параметрам из таблицы товара.</p>
                  <strong>Проверить и отправить</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="homepage-marketplaces" aria-labelledby="homepage-marketplaces-title">
        <div className="public-container homepage-marketplaces-inner">
          <div className="homepage-marketplaces-copy">
            <span>Интеграции</span>
            <h2 id="homepage-marketplaces-title">Четыре площадки — один рабочий процесс</h2>
          </div>
          <div className="homepage-marketplace-list">
            {marketplaces.map((marketplace) => (
              <Link key={marketplace.key} className="homepage-marketplace-link" href={marketplace.path}>
                <span className="homepage-marketplace-logo" aria-hidden="true">{marketplace.shortName.slice(0, 2)}</span>
                <span>
                  <strong>{marketplace.name}</strong>
                  <small>{marketplace.statusLabel}</small>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section homepage-workspace-section" id="product">
        <div className="public-container">
          <div className="homepage-section-heading is-centered">
            <p className="homepage-kicker">Единое окно</p>
            <h2>Все обращения — в одном окне</h2>
            <p>
              Переключайтесь между отзывами, вопросами и сообщениями без прыжков по кабинетам. Контекст обращения, черновик ответа и состояние отправки находятся рядом.
            </p>
          </div>
          <HomeWorkspaceTabs />
        </div>
      </section>

      <section className="public-section homepage-ai-layer">
        <div className="public-container homepage-ai-layout">
          <div className="homepage-ai-copy">
            <p className="homepage-kicker">ИИ как часть процесса</p>
            <h2>Не просто сгенерировать текст, а подготовить ответ к реальной отправке</h2>
            <p>
              Модель работает внутри операционного контура: получает доступный контекст, формирует черновик, после чего правила и проверки определяют следующий шаг. Команда видит результат и может вмешаться там, где это действительно нужно.
            </p>
            <Link className="text-link" href="/features">Разобрать возможности подробнее</Link>
          </div>
          <div className="homepage-ai-orbit" aria-label="Слои подготовки ответа">
            <div className="homepage-ai-orbit-core">
              <span>AI</span>
              <strong>Ответ</strong>
            </div>
            <div className="homepage-ai-orbit-item is-context">
              <span>01</span>
              <strong>Контекст</strong>
              <small>товар и обращение</small>
            </div>
            <div className="homepage-ai-orbit-item is-rules">
              <span>02</span>
              <strong>Правила</strong>
              <small>стиль и сценарий</small>
            </div>
            <div className="homepage-ai-orbit-item is-safety" id="safetygate">
              <span>03</span>
              <strong>Проверка</strong>
              <small>риск и уверенность</small>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section homepage-process" id="how-it-works">
        <div className="public-container">
          <div className="homepage-section-heading">
            <p className="homepage-kicker">Как это работает</p>
            <h2>От подключения площадки до готового ответа — четыре понятных шага</h2>
            <p>Без одинаковых карточек: каждый этап показывает, что именно происходит с обращением дальше.</p>
          </div>

          <div className="homepage-process-flow">
            <div className="homepage-process-path" aria-hidden="true" />

            <article className="homepage-process-step is-connect">
              <span className="homepage-process-number">01</span>
              <div className="homepage-process-copy">
                <h3>Подключите маркетплейсы</h3>
                <p>Добавьте рабочие аккаунты площадок и управляйте ими из одного пространства.</p>
              </div>
              <div className="homepage-process-visual homepage-process-channels" aria-hidden="true">
                <span>WB</span><span>OZ</span><span>ЯМ</span><span>AV</span>
              </div>
            </article>

            <article className="homepage-process-step is-inbox">
              <span className="homepage-process-number">02</span>
              <div className="homepage-process-visual homepage-process-inbox" aria-hidden="true">
                <span><i /> Отзыв <b>WB</b></span>
                <span><i /> Вопрос <b>Ozon</b></span>
                <span><i /> Сообщение <b>Авито</b></span>
              </div>
              <div className="homepage-process-copy">
                <h3>Получайте обращения</h3>
                <p>Отзывы, вопросы и доступные сообщения приходят в общую очередь с понятным источником и статусом.</p>
              </div>
            </article>

            <article className="homepage-process-step is-generate">
              <span className="homepage-process-number">03</span>
              <div className="homepage-process-copy">
                <h3>ИИ готовит ответы</h3>
                <p>Черновик строится на доступном контексте, а проверки отделяют обычные случаи от тех, где нужен человек.</p>
              </div>
              <div className="homepage-process-visual homepage-process-draft" aria-hidden="true">
                <span>Черновик</span>
                <p>Спасибо за обращение. Проверили контекст товара и подготовили ответ…</p>
                <strong>Готово к проверке</strong>
              </div>
            </article>

            <article className="homepage-process-step is-send">
              <span className="homepage-process-number">04</span>
              <div className="homepage-process-visual homepage-process-rules" aria-hidden="true">
                <span><i className="is-on" /> Автоотправка</span>
                <span><i /> Ручная проверка</span>
                <strong>Статус сохранён</strong>
              </div>
              <div className="homepage-process-copy">
                <h3>Отправляйте</h3>
                <p>Правила выбирают автоотправку или проверку менеджером, а история сохраняет результат обработки.</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="public-section homepage-outcomes">
        <div className="public-container homepage-outcomes-band">
          <div className="homepage-outcomes-copy">
            <p className="homepage-kicker">Что меняется в работе</p>
            <h2>Меньше ручной рутины. Больше контроля над исключениями.</h2>
          </div>
          <div className="homepage-outcomes-list">
            <span><strong>Единая очередь</strong><small>без переключения между кабинетами</small></span>
            <span><strong>Контроль перед отправкой</strong><small>автоматизация не скрывает сложные случаи</small></span>
            <span><strong>История обработки</strong><small>видно, что произошло с обращением</small></span>
            <span><strong>Один процесс для команды</strong><small>единые правила для разных площадок</small></span>
          </div>
        </div>
      </section>

      <section className="public-section homepage-faq-section">
        <div className="public-container homepage-faq-layout">
          <div className="homepage-section-heading">
            <p className="homepage-kicker">FAQ</p>
            <h2>Коротко о работе MPReply</h2>
            <p>Без маркетинговых цифр, которые невозможно подтвердить.</p>
          </div>
          <div className="faq-list">
            {faq.map((item) => (
              <details className="faq-item" key={item.question}>
                <summary>
                  <span>{item.question}</span>
                  <span className="faq-item-icon" aria-hidden="true" />
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section homepage-final-cta">
        <div className="public-container homepage-final-cta-card">
          <div>
            <p className="homepage-kicker">Готовы посмотреть продукт?</p>
            <h2>Подключите площадки и соберите коммуникацию с покупателями в одном процессе</h2>
          </div>
          <div className="homepage-final-cta-actions">
            <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">Создать аккаунт</Link>
            <Link className="button button-secondary" href="/contacts">Обсудить подключение</Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { AnswerPackCalculator } from "../../components/public-site/AnswerPackCalculator";
import { MarketingGlyph } from "../../components/public-site/MarketingGlyph";
import { PricingPackageCard } from "../../components/public-site/PricingPackageCard";
import { PublicFaqAccordion } from "../../components/public-site/PublicFaqAccordion";
import { PublicShell } from "../../components/public-site/PublicShell";
import { PublicTrialCta } from "../../components/public-site/PublicTrialCta";
import { publicPricingPlans, trialOffer } from "../../lib/public-pricing";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Пакеты автоответов MPReply — без подписки для маркетплейсов",
  description:
    "Пакеты автоответов MPReply для отзывов, вопросов и чатов маркетплейсов: без подписки, без сгорания баланса, с автопубликацией по правилам продавца.",
  path: "/pricing",
});

const billingPrinciples = [
  {
    title: "Ответы не сгорают",
    text: "Используйте остаток тогда, когда появляются реальные обращения. Календарного списания и обязательной ежемесячной оплаты нет.",
  },
  {
    title: "Один баланс для площадок",
    text: "Пакет расходуется на подключённых магазинах и маркетплейсах без отдельной покупки для каждого канала.",
  },
  {
    title: "Списание за результат",
    text: "Баланс уменьшается только после публикации или отправки готового ответа покупателю.",
  },
  {
    title: "Черновики бесплатны",
    text: "Предпросмотр, редактирование, проверка данных и повторная генерация не списывают ответы.",
  },
] as const;

const includedFeatures = [
  "Ответы на отзывы, вопросы и сообщения в чатах",
  "Контекст карточки товара и база знаний",
  "Настройка тона, стоп-тем и правил автопубликации",
  "Автопубликация по умолчанию и опциональная модерация",
  "История решений и статусы обработки",
  "Единый баланс для подключённых площадок",
] as const;

const faq = [
  {
    question: "Что считается одним ответом?",
    answer:
      "Один ответ списывается только после публикации или отправки готового сообщения покупателю. Черновики, редактирование, проверка данных и повторная генерация баланс не уменьшают.",
  },
  {
    question: "Сгорают ли купленные ответы?",
    answer:
      "Нет. У пакета нет календарного срока действия. Неиспользованный остаток сохраняется и расходуется по мере появления реальных обращений.",
  },
  {
    question: "Можно ли использовать пакет на нескольких маркетплейсах?",
    answer:
      "Да. Один баланс работает для подключённых магазинов и площадок. Ответы можно расходовать на отзывы, вопросы и чаты.",
  },
  {
    question: "Что произойдёт, когда баланс закончится?",
    answer:
      "Автопубликация остановится, но обращения, настройки и история сохранятся. После пополнения MPReply продолжит работу без повторного подключения.",
  },
  {
    question: "Как работает бесплатный тест?",
    answer: `Тест действует ${trialOffer.durationDays} дней и включает ${trialOffer.answerLimit} ответов для двух маркетплейсов. Платный пакет автоматически не подключается.`,
  },
] as const;

export default function PricingPage() {
  return (
    <PublicShell>
      <section className="public-subhero pricing-page-hero-v82 pricing-page-hero-v86 pricing-page-hero-v87 pricing-page-hero-v88 pricing-page-hero-v89 pricing-page-hero-v90">
        <div className="public-container public-subhero-grid pricing-page-hero-grid-v82 pricing-page-hero-grid-v86 pricing-page-hero-grid-v87 pricing-page-hero-grid-v88 pricing-page-hero-grid-v89 pricing-page-hero-grid-v90">
          <div className="public-subhero-copy pricing-page-hero-copy-v86 pricing-page-hero-copy-v87 pricing-page-hero-copy-v88 pricing-page-hero-copy-v89 pricing-page-hero-copy-v90">
            <p className="public-eyebrow">Цены MPReply</p>
            <h1>Пакеты автоответов без подписки</h1>
            <p className="public-lead">
              Выберите готовый объём ответов для отзывов, вопросов и чатов маркетплейсов. Баланс не сгорает, автопубликация работает по правилам продавца, а согласование включается только для выбранных сценариев.
            </p>
            <div className="hero-actions pricing-page-hero-actions-v82 pricing-page-hero-actions-v86 pricing-page-hero-actions-v87 pricing-page-hero-actions-v88 pricing-page-hero-actions-v89 pricing-page-hero-actions-v90">
              <PublicTrialCta className="button button-primary" source="pricing-hero-v82">
                Получить 400 ответов бесплатно
              </PublicTrialCta>
              <a className="button button-secondary" href="#calculator">Рассчитать объём</a>
            </div>
          </div>

          <aside className="pricing-page-trial-card-v82 pricing-page-trial-card-v86 pricing-page-trial-card-v87 pricing-page-trial-card-v88 pricing-page-trial-card-v89 pricing-page-trial-card-v90">
            <MarketingGlyph variant="reviews" />
            <p className="public-eyebrow">Бесплатный тест</p>
            <h2>{trialOffer.answerLimit} ответов для проверки сервиса</h2>
            <p>За 7 дней MPReply обработает реальные отзывы, вопросы и чаты: подготовит ответы по карточке товара, применит правила продавца и покажет работу сервиса на реальных обращениях.</p>
            <ul>
              <li>{trialOffer.durationDays} дней теста</li>
              <li>До {trialOffer.marketplaceLimit} маркетплейсов</li>
              <li>Модерация — только по настройке</li>
            </ul>
          </aside>
        </div>
      </section>

      <section className="home-section pricing-page-packages-v82" aria-labelledby="pricing-packages-title">
        <div className="public-container">
          <header className="home-section-heading home-section-heading-centered">
            <p className="public-eyebrow">Готовые пакеты</p>
            <h2 id="pricing-packages-title">Пакеты автоответов под ваш объём продаж</h2>
            <p>Выберите объём готовых ответов для отзывов, вопросов и чатов. Во всех пакетах есть автопубликация, правила продавца, проверка карточки товара и единый баланс.</p>
          </header>

          <div className="pricing-pack-grid">
            {publicPricingPlans.map((plan) => (
              <PricingPackageCard key={plan.key} plan={plan} />
            ))}
          </div>
        </div>
      </section>

      <div className="home-section pricing-page-calculator-v82 pricing-page-calculator-v89 pricing-page-calculator-v90" id="calculator">
        <div className="public-container">
          <AnswerPackCalculator />
        </div>
      </div>

      <section className="home-section pricing-page-principles-v82 pricing-page-principles-v89 pricing-page-principles-v90" aria-labelledby="billing-principles-title">
        <div className="public-container">
          <header className="home-section-heading home-section-heading-left">
            <p className="public-eyebrow">Прозрачное списание</p>
            <h2 id="billing-principles-title">Баланс списывается только за опубликованный ответ</h2>
            <p>Проверка данных, правки и повторная генерация не уменьшают пакет. Ответ списывается только после публикации в маркетплейсе или отправки покупателю.</p>
          </header>
          <div className="pricing-page-principles-grid-v82">
            {billingPrinciples.map((item, index) => (
              <article className="pricing-page-info-card-v82" key={item.title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section pricing-page-included-v82 pricing-page-included-v89 pricing-page-included-v90" aria-labelledby="included-title">
        <div className="public-container pricing-page-included-grid-v82 pricing-page-included-grid-v88 pricing-page-included-grid-v89 pricing-page-included-grid-v90">
          <div className="home-section-heading home-section-heading-left">
            <p className="public-eyebrow">В каждом пакете</p>
            <h2 id="included-title">Что входит в пакет автоответов</h2>
            <p>В каждом пакете доступна вся рабочая цепочка: анализ обращения, проверка карточки товара, применение правил продавца, автопубликация и журнал решений.</p>
          </div>
          <ul className="pricing-page-feature-grid-v82 pricing-page-feature-grid-v88 pricing-page-feature-grid-v89 pricing-page-feature-grid-v90">
            {includedFeatures.map((feature) => (
              <li key={feature}><span aria-hidden="true">✓</span>{feature}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="home-section home-faq pricing-page-faq-v82">
        <div className="public-container home-faq-layout">
          <div className="home-section-heading home-section-heading-left">
            <p className="public-eyebrow">Вопросы об оплате</p>
            <h2>Частые вопросы о пакетах автоматических ответов</h2>
            <p>Как списываются ответы, сохраняется остаток и работает единый баланс для площадок.</p>
          </div>
          <PublicFaqAccordion items={faq} />
        </div>
      </section>

      <section className="home-section home-final-cta pricing-page-final-v82 pricing-page-final-v88 pricing-page-final-v89 pricing-page-final-v90">
        <div className="public-container">
          <div className="home-final-cta-card">
            <div>
              <p className="public-eyebrow">Начните с реальных обращений</p>
              <h2>Запустите автоответы и выберите подходящий пакет</h2>
              <p>7 дней и 400 ответов: проверьте работу сервиса на отзывах, вопросах и чатах без автоматического подключения платного пакета.</p>
            </div>
            <div className="home-final-cta-actions">
              <PublicTrialCta className="button home-final-cta-primary public-cta-on-dark" source="pricing-final-v82">
                Начать бесплатный тест
              </PublicTrialCta>
              <Link className="button home-final-cta-secondary" href="/contacts?package=custom">
                Обсудить объём
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

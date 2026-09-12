import type { Metadata } from "next";
import Link from "next/link";

import { PublicShell } from "../../components/public-site/PublicShell";
import { JsonLd } from "../../components/seo/JsonLd";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Помощь и FAQ — MPReply",
  description:
    "Ответы на вопросы о подключении Wildberries, Ozon, Яндекс Маркета и Авито, единой очереди обращений, ИИ-ответах, проверке сотрудником и автоматизации MPReply.",
  path: "/help",
});

const faq = [
  {
    question: "Какие маркетплейсы можно подключить?",
    answer: "MPReply поддерживает Wildberries, Ozon, Яндекс Маркет и Авито. Подключённые кабинеты работают в одном рабочем пространстве.",
  },
  {
    question: "Какие обращения попадают в единую очередь?",
    answer: "В общей очереди собраны отзывы, вопросы и сообщения покупателей. Доступный набор обращений зависит от возможностей конкретной площадки и подключённого кабинета.",
  },
  {
    question: "Ответы всегда отправляются автоматически?",
    answer: "Нет. Команда сама определяет правила: типовые сценарии можно отправлять автоматически, а сложные и чувствительные случаи оставлять на проверку сотруднику.",
  },
  {
    question: "Что учитывается при подготовке ответа?",
    answer: "Черновик формируется с учётом доступного контекста обращения и товара, а также заданного тона и правил команды. Перед отправкой текст можно проверить и отредактировать.",
  },
  {
    question: "Можно работать с несколькими кабинетами?",
    answer: "Да. Кабинеты подключаются к рабочему пространству, а обращения можно фильтровать по площадке, типу и состоянию обработки.",
  },
  {
    question: "Что происходит, если ответ требует внимания?",
    answer: "Такое обращение попадает в очередь проверки. Сотрудник видит исходный контекст, текст ответа и причину, по которой требуется дополнительное решение.",
  },
];

export default function HelpPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <PublicShell>
      <JsonLd data={faqSchema} />

      <section className="public-subhero public-subhero-resources">
        <div className="public-container public-subhero-grid">
          <div className="public-subhero-copy">
            <p className="eyebrow">Помощь</p>
            <h1>Ответы на вопросы о подключении и работе с обращениями</h1>
            <p className="public-lead">
              Коротко о маркетплейсах, единой очереди, подготовке ответов, ручной проверке и автоматизации. Для конкретного вопроса можно связаться с командой.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/contacts">Связаться с командой</Link>
              <Link className="button button-secondary" href="/demo">Посмотреть демо</Link>
            </div>
          </div>

          <aside className="resource-intro-panel">
            <span className="panel-kicker">Быстрый старт</span>
            <strong>От подключения площадки до первого рабочего процесса</strong>
            <p>Создайте аккаунт, добавьте рабочее пространство, подключите кабинеты и настройте, какие ответы требуют проверки.</p>
          </aside>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container public-two-column public-two-column-feature">
          <div>
            <p className="eyebrow">Частые вопросы</p>
            <h2>Главное перед началом работы</h2>
            <p className="public-copy-muted">Без технических деталей, которые не нужны продавцу или сотруднику поддержки.</p>
          </div>
          <div className="resource-note-list">
            {faq.map((item, index) => (
              <article className="resource-note" key={item.question}>
                <span className="resource-note-index">{String(index + 1).padStart(2, "0")}</span>
                <div className="resource-note-copy">
                  <h3>{item.question}</h3>
                  <p>{item.answer}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section public-cta-section">
        <div className="public-container public-cta-card">
          <div>
            <p className="eyebrow">Не нашли ответ?</p>
            <h2>Опишите ваш сценарий — площадки, поток обращений и уровень автоматизации</h2>
          </div>
          <Link className="button button-primary button-on-dark" href="/contacts">Перейти к контактам</Link>
        </div>
      </section>
    </PublicShell>
  );
}

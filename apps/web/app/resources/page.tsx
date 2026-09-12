import type { Metadata } from "next";
import Link from "next/link";

import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Блог MPReply — отзывы, вопросы и ИИ для маркетплейсов",
  description:
    "Практические материалы MPReply об ответах на отзывы и вопросы покупателей, работе с сообщениями, автоматизации поддержки и ИИ для Wildberries, Ozon, Яндекс Маркета и Авито.",
  path: "/resources",
});

const notes = [
  {
    number: "01",
    topic: "Автоматизация",
    title: "Какие ответы стоит автоматизировать в первую очередь",
    text: "Начните с повторяющихся вопросов и типовых отзывов, где у команды уже есть понятная позиция. Такие сценарии проще контролировать, а результат заметен сразу.",
    takeaway: "Сначала автоматизируйте рутину, затем расширяйте правила.",
  },
  {
    number: "02",
    topic: "Стиль бренда",
    title: "Как отвечать быстрее и не терять стиль бренда",
    text: "ИИ может подготовить основу ответа, но тон, формулировки и ограничения должны соответствовать вашему бренду. Единые правила помогают сохранять одинаковое качество во всей команде.",
    takeaway: "Скорость ответа не должна превращать коммуникацию в шаблонную.",
  },
  {
    number: "03",
    topic: "Единая очередь",
    title: "Зачем объединять отзывы, вопросы и сообщения",
    text: "Когда обращения распределены по разным кабинетам, часть времени уходит на поиск и переключения. Единая очередь помогает видеть приоритеты, контекст и текущее состояние каждого обращения.",
    takeaway: "Один рабочий экран упрощает ежедневную работу команды.",
  },
  {
    number: "04",
    topic: "Контроль",
    title: "Когда ответ лучше оставить на проверку менеджеру",
    text: "Неоднозначные вопросы, негатив, обещания покупателю и ситуации с недостатком данных лучше не отправлять автоматически. Для таких случаев нужен отдельный сценарий проверки.",
    takeaway: "Автоматизация должна убирать рутину, а не контроль.",
  },
  {
    number: "05",
    topic: "Интеграции",
    title: "Как работать сразу с несколькими маркетплейсами",
    text: "Wildberries, Ozon, Яндекс Маркет и Авито отличаются интерфейсами и правилами, но сотруднику не обязательно держать четыре разных процесса в голове. Общая очередь делает ежедневную работу одинаковой независимо от площадки.",
    takeaway: "Площадки разные — рабочий процесс команды может быть единым.",
  },
  {
    number: "06",
    topic: "Аналитика",
    title: "Что смотреть в аналитике обращений",
    text: "Полезно отслеживать не только количество ответов, но и обращения без ответа, долю автоматизации, время реакции и темы, которые чаще всего требуют участия человека.",
    takeaway: "Аналитика должна подсказывать, что автоматизировать следующим.",
  },
] as const;

const featured = notes[0];
const secondary = notes.slice(1, 3);
const topicNotes = notes.slice(3);

export default function ResourcesPage() {
  return (
    <PublicShell>
      <section className="public-subhero public-subhero-resources resources-approved-hero">
        <div className="public-container public-subhero-grid resources-hero-grid">
          <div className="public-subhero-copy">
            <p className="eyebrow">Блог MPReply</p>
            <h1>Практика работы с обращениями покупателей на маркетплейсах</h1>
            <p className="public-lead">
              Разбираем, как быстрее отвечать покупателям, сохранять единый стиль бренда, подключать ИИ и автоматизировать рутину без потери контроля.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/demo">Посмотреть процесс в демо</Link>
              <Link className="button button-secondary" href="/features">Возможности MPReply</Link>
            </div>
          </div>

          <div className="resource-editorial-scene" aria-label="Подборка материалов MPReply">
            <article className="resource-featured-card">
              <div className="resource-card-meta">
                <span>{featured.number}</span>
                <small>{featured.topic}</small>
              </div>
              <h2>{featured.title}</h2>
              <p>{featured.text}</p>
              <blockquote>{featured.takeaway}</blockquote>
            </article>

            <div className="resource-editorial-stack">
              {secondary.map((note) => (
                <article className="resource-editorial-mini" key={note.number}>
                  <div className="resource-card-meta">
                    <span>{note.number}</span>
                    <small>{note.topic}</small>
                  </div>
                  <h3>{note.title}</h3>
                  <p>{note.takeaway}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="public-section resources-start-section">
        <div className="public-container resources-start-layout">
          <div className="section-heading">
            <p className="eyebrow">С чего начать</p>
            <h2>Три вопроса, которые определяют полезную автоматизацию</h2>
            <p>Сначала разберите рабочий процесс команды, затем включайте автоматизацию там, где правила уже понятны.</p>
          </div>

          <div className="resource-topic-grid" role="list" aria-label="Основные темы базы знаний">
            <div className="resource-topic-card" role="listitem">
              <span aria-hidden="true">01</span>
              <strong>Что повторяется?</strong>
              <p>Найдите типовые отзывы, вопросы и сообщения, на которые команда уже отвечает одинаково.</p>
            </div>
            <div className="resource-topic-card" role="listitem">
              <span aria-hidden="true">02</span>
              <strong>Где нужен человек?</strong>
              <p>Отделите негатив, спорные обещания и обращения с недостаточным контекстом.</p>
            </div>
            <div className="resource-topic-card" role="listitem">
              <span aria-hidden="true">03</span>
              <strong>Что измерять?</strong>
              <p>Следите за очередью без ответа, временем реакции и сценариями, которые чаще требуют проверки.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section public-section-muted resources-library-section">
        <div className="public-container">
          <div className="section-heading section-heading-wide">
            <p className="eyebrow">Практические заметки</p>
            <h2>Контроль, интеграции и аналитика — без абстрактных обещаний</h2>
            <p>Короткие материалы построены вокруг реальных рабочих ситуаций продавца и команды поддержки.</p>
          </div>

          <div className="resource-library-grid">
            {topicNotes.map((note) => (
              <article className="resource-library-card" key={note.number}>
                <div className="resource-card-meta">
                  <span>{note.number}</span>
                  <small>{note.topic}</small>
                </div>
                <h3>{note.title}</h3>
                <p>{note.text}</p>
                <blockquote>{note.takeaway}</blockquote>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section public-cta-section">
        <div className="public-container public-cta-card">
          <div>
            <p className="eyebrow">От теории к рабочей очереди</p>
            <h2>Посмотрите, как эти принципы работают внутри MPReply</h2>
          </div>
          <div className="cta-actions-on-dark">
            <Link className="button button-secondary button-secondary-on-dark" href="/marketplaces">Все интеграции</Link>
            <Link className="button button-primary button-on-dark" href="/demo">Открыть демо</Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
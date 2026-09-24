import type { Metadata } from "next";
import Link from "next/link";

import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";
import { siteConfig } from "../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Помощь и FAQ — MPReply",
  description:
    "Ответы на вопросы о подключении площадок, единой очереди обращений, ИИ-черновиках, проверке сотрудником и автоматизации MPReply.",
  path: "/help",
  localized: true,
});

const helpPaths = [
  {
    number: "01",
    title: "Подключить маркетплейс",
    text: "Выберите Wildberries, Ozon, Яндекс Маркет или Авито. Доступность конкретного подключения зависит от текущей версии сервиса; поддерживаемые обращения отображаются в общем рабочем пространстве.",
    action: "Перейти к интеграциям",
    href: "/marketplaces",
  },
  {
    number: "02",
    title: "Разобраться с очередью обращений",
    text: "Поддерживаемые отзывы, вопросы и сообщения можно просматривать в одной очереди и разделять по площадке, типу и состоянию обработки.",
    action: "Посмотреть возможности",
    href: "/features",
  },
  {
    number: "03",
    title: "Настроить проверку и автоматизацию",
    text: "Определите, какие ответы можно обрабатывать автоматически, а какие должны сначала пройти проверку сотрудником.",
    action: "Посмотреть сценарий",
    href: "/demo",
  },
];

const troubleshooting = [
  {
    label: "Обращение не видно",
    title: "Проверьте подключённый кабинет и источник",
    text: "Убедитесь, что нужный кабинет подключён и обращение относится к поддерживаемому типу на выбранной площадке.",
  },
  {
    label: "Ответ ждёт решения",
    title: "Откройте очередь проверки",
    text: "Если правила требуют участия сотрудника, обращение остаётся на проверке вместе с исходным контекстом и подготовленным ответом.",
  },
  {
    label: "Ответ не отправился",
    title: "Проверьте состояние интеграции",
    text: "Если площадка отклонила действие или доступ к кабинету изменился, сначала проверьте подключение, а затем повторите отправку после устранения причины.",
  },
];

const faq = [
  {
    question: "Какие маркетплейсы представлены в MPReply?",
    answer: "В MPReply представлены Wildberries, Ozon, Яндекс Маркет и Авито. Доступность конкретного подключения зависит от текущей версии сервиса.",
  },
  {
    question: "Какие обращения попадают в единую очередь?",
    answer: "В общей очереди отображаются поддерживаемые интеграцией отзывы, вопросы и сообщения покупателей. Доступный набор зависит от конкретной площадки и подключённого кабинета.",
  },
  {
    question: "Ответы всегда отправляются автоматически?",
    answer: "Нет. Правила могут разрешать автоматическую обработку типовых сценариев, а сложные и чувствительные случаи оставлять на проверку сотруднику.",
  },
  {
    question: "Что учитывается при подготовке ответа?",
    answer: "Черновик формируется с учётом доступного контекста обращения и товара, а также настроек рабочего пространства. Перед отправкой текст можно проверить и отредактировать.",
  },
  {
    question: "Можно работать с несколькими кабинетами?",
    answer: "Кабинеты подключаются к рабочему пространству, а обращения можно фильтровать по площадке, типу, статусу и ответственному там, где это доступно.",
  },
  {
    question: "Что происходит, если ответ требует внимания?",
    answer: "Такое обращение попадает в очередь проверки. Сотрудник видит исходный контекст, подготовленный ответ и состояние, из-за которого требуется решение.",
  },
];

export default function HelpPage() {
  return (
    <PublicShell>
      <section className="public-subhero help-approved-hero">
        <div className="public-container public-subhero-grid help-hero-grid">
          <div className="public-subhero-copy">
            <p className="eyebrow">Центр помощи</p>
            <h1>Найдите следующий шаг по вашей задаче</h1>
            <p className="public-lead">
              Подключение площадок, единая очередь, проверка ответов и автоматизация — помощь построена вокруг действий в MPReply, а не вокруг технических терминов.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href="#start">Начать с задачи</Link>
              <Link className="button button-secondary" href="/contacts">Связаться с поддержкой</Link>
            </div>
            <nav className="help-hero-shortcuts" aria-label="Разделы страницы помощи">
              <a href="#start">Быстрый старт</a>
              <a href="#troubleshooting">Если что-то не работает</a>
              <a href="#faq">FAQ</a>
            </nav>
          </div>

          <div className="help-hero-scene" aria-label="Схема центра помощи MPReply">
            <div className="help-hero-window">
              <div className="help-hero-window-head">
                <div>
                  <span className="help-scene-mark" aria-hidden="true">?</span>
                  <div><strong>Помощь MPReply</strong><small>Найдите решение по задаче</small></div>
                </div>
                <span>Все системы</span>
              </div>
              <div className="help-hero-search" aria-hidden="true">Поиск по помощи…</div>
              <div className="help-hero-routes">
                <div className="help-hero-route help-hero-route-active"><span>01</span><div><strong>Подключение</strong><small>Поддерживаемые площадки</small></div></div>
                <div className="help-hero-route"><span>02</span><div><strong>Очередь обращений</strong><small>Отзывы · вопросы · сообщения</small></div></div>
                <div className="help-hero-route"><span>03</span><div><strong>Проверка ответов</strong><small>Контроль перед отправкой</small></div></div>
              </div>
            </div>
            <div className="help-hero-resolution">
              <span className="panel-kicker">Сценарий</span>
              <strong>Ответ не отправился</strong>
              <p>Проверьте состояние подключения площадки и повторите действие после устранения причины.</p>
              <span className="help-resolution-status">Следующий шаг найден →</span>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section help-start-section" id="start">
        <div className="public-container help-start-layout">
          <div className="help-section-intro">
            <p className="eyebrow">Быстрый старт</p>
            <h2>Выберите то, что хотите сделать сейчас</h2>
            <p className="public-copy-muted">Каждый путь ведёт к конкретному следующему действию — без отдельного каталога однотипных статей.</p>
          </div>
          <div className="help-path-list">
            {helpPaths.map((path) => (
              <article className="help-path" key={path.number}>
                <span className="help-path-number">{path.number}</span>
                <div>
                  <h3>{path.title}</h3>
                  <p>{path.text}</p>
                </div>
                <Link className="text-link" href={path.href}>{path.action} →</Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section public-section-muted help-troubleshooting-section" id="troubleshooting">
        <div className="public-container">
          <div className="section-heading section-heading-wide">
            <p className="eyebrow">Диагностика</p>
            <h2>Если рабочий процесс остановился</h2>
            <p>Начните с состояния, которое видите в MPReply. Эти маршруты помогают сузить причину и понять, куда перейти дальше.</p>
          </div>
          <div className="help-troubleshooting-flow">
            {troubleshooting.map((item, index) => (
              <article className="help-troubleshooting-step" key={item.label}>
                <div className="help-troubleshooting-topline">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <small>{item.label}</small>
                </div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
          <div className="help-support-strip">
            <div>
              <span className="panel-kicker">Нужна помощь команды</span>
              <strong>Опишите площадку, кабинет и состояние обращения</strong>
              <p>Так поддержке проще понять контекст вопроса. Не отправляйте в письме секретные ключи доступа.</p>
            </div>
            <a className="button button-primary" href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>
          </div>
        </div>
      </section>

      <section className="public-section help-faq-section" id="faq">
        <div className="public-container help-faq-layout">
          <div className="help-section-intro">
            <p className="eyebrow">FAQ</p>
            <h2>Короткие ответы перед началом работы</h2>
            <p className="public-copy-muted">Основные вопросы о площадках, очереди обращений, подготовке ответов и ручной проверке.</p>
          </div>
          <div className="help-faq-list">
            {faq.map((item, index) => (
              <details className="help-faq-item" key={item.question} open={index === 0}>
                <summary><span>{item.question}</span><i aria-hidden="true">+</i></summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section public-cta-section">
        <div className="public-container public-cta-card">
          <div>
            <p className="eyebrow">Не нашли нужный сценарий?</p>
            <h2>Опишите, где остановился ваш процесс</h2>
          </div>
          <a className="button button-primary button-on-dark" href={`mailto:${siteConfig.contactEmail}`}>Написать в поддержку</a>
        </div>
      </section>
    </PublicShell>
  );
}

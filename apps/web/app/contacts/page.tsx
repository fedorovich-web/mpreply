import type { Metadata } from "next";
import Link from "next/link";

import { ContactMailForm } from "../../components/public-site/ContactMailForm";
import { PublicIcon, type PublicIconName } from "../../components/public-site/PublicIcon";
import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";
import { siteConfig } from "../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Контакты MPReply — поддержка, демо и подключение",
  description:
    "Свяжитесь с MPReply по вопросам подключения маркетплейсов, настройки автоматизации, демо и работы с обращениями покупателей.",
  path: "/contacts",
});

const contactCards: readonly [PublicIconName, string, string][] = [
  ["gear", "Техническая поддержка", "Поможем с подключением, настройкой и вопросами по работе MPReply."],
  ["chart", "Запросить демо", "Покажем рабочий процесс MPReply на понятном сценарии обращения."],
  ["link", "Партнёрство", "Обсудим интеграции, совместные проекты и рабочие сценарии для команд."],
  ["message", "Общие вопросы", "Ответим на вопросы о возможностях, тарифах и использовании сервиса."],
];

export default function ContactsPage() {
  return (
    <PublicShell>
      <div className="contacts-render-page">
        <section className="contacts-render-hero">
          <div className="public-container contacts-render-hero-grid">
            <div className="contacts-render-hero-copy">
              <p className="contacts-render-eyebrow">КОНТАКТЫ</p>
              <h1>Свяжитесь с нами</h1>
              <p>
                Задайте вопрос, запросите демо или обсудите подключение MPReply. Для всех публичных обращений
                используем один адрес поддержки — <strong>support@mpreply.ru</strong>.
              </p>
              <div className="contacts-render-trust" aria-label="Как мы работаем с обращениями">
                <span><PublicIcon name="users" />Один канал поддержки</span>
                <span><PublicIcon name="clock" />Ответ в рабочее время</span>
                <span><PublicIcon name="shield-check" />По делу и с контекстом</span>
              </div>
            </div>

            <div className="contacts-render-hero-scene" aria-hidden="true">
              <span className="contacts-render-scene-chip contacts-render-scene-mail"><PublicIcon name="inbox" /></span>
              <span className="contacts-render-scene-chip contacts-render-scene-help"><PublicIcon name="message" /></span>
              <div className="contacts-render-scene-bubble">
                <PublicIcon name="message" />
                <span><i /> <i /> <i /></span>
              </div>
              <div className="contacts-render-scene-status"><i />На связи по вопросам MPReply</div>
              <div className="contacts-render-scene-note">support@mpreply.ru</div>
            </div>
          </div>
        </section>

        <section className="contacts-render-channels">
          <div className="public-container contacts-render-channel-grid">
            {contactCards.map(([icon, title, text]) => (
              <article className="contacts-render-channel-card" key={title}>
                <span className="contacts-render-channel-icon" aria-hidden="true"><PublicIcon name={icon} /></span>
                <h2>{title}</h2>
                <p>{text}</p>
                <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}<span aria-hidden="true">→</span></a>
              </article>
            ))}
          </div>
        </section>

        <section className="contacts-render-main">
          <div className="public-container contacts-render-main-grid">
            <div className="contacts-render-form-card">
              <div className="contacts-render-section-head">
                <h2>Напишите нам</h2>
                <p>Заполните поля — мы подготовим письмо в вашем почтовом приложении.</p>
              </div>
              <ContactMailForm supportEmail={siteConfig.contactEmail} />
            </div>

            <aside className="contacts-render-info-column" aria-label="Контактная информация MPReply">
              <article className="contacts-render-office-card">
                <div className="contacts-render-info-icon"><PublicIcon name="link" /></div>
                <div>
                  <h2>Наш офис</h2>
                  <p>г. Майкоп, ул. Чкалова, 65,<br />помещение 17А</p>
                  <span className="contacts-render-office-label">г. Майкоп</span>
                </div>
                <div className="contacts-render-office-visual" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <b>MP</b>
                </div>
              </article>

              <article className="contacts-render-info-card">
                <span className="contacts-render-info-icon"><PublicIcon name="lightning" /></span>
                <div><h2>Поддержка</h2><p>Пишете на <strong>support@mpreply.ru</strong> — другого публичного канала поддержки нет.</p></div>
              </article>

              <article className="contacts-render-info-card">
                <span className="contacts-render-info-icon"><PublicIcon name="clock" /></span>
                <div><h2>Режим работы</h2><p>Ежедневно: 09:00–18:00 (МСК)</p></div>
              </article>
            </aside>
          </div>
        </section>

        <section className="contacts-render-final">
          <div className="public-container contacts-render-final-card">
            <div>
              <p className="contacts-render-eyebrow">ОСТАЛИСЬ ВОПРОСЫ?</p>
              <h2>Готовы обсудить подключение?</h2>
              <p>Опишите задачу, маркетплейсы и рабочий сценарий — ответим по существу.</p>
            </div>
            <a className="button button-primary" href={`mailto:${siteConfig.contactEmail}?subject=${encodeURIComponent("MPReply: обсуждение подключения")}`}>
              Написать в поддержку <span aria-hidden="true">→</span>
            </a>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}

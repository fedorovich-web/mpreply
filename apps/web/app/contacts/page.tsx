import Image from "next/image";
import type { Metadata } from "next";

import { ContactMailForm } from "../../components/public-site/ContactMailForm";
import { PublicIcon } from "../../components/public-site/PublicIcon";
import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";
import { siteConfig } from "../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Контакты MPReply — поддержка, демо и подключение",
  description:
    "Свяжитесь с MPReply по вопросам подключения маркетплейсов, настройки автоматизации, демо и работы с обращениями покупателей.",
  path: "/contacts",
  localized: true,
});

export default function ContactsPage() {
  return (
    <PublicShell>
      <div className="contacts-render-page">
        <section className="contacts-render-hero">
          <div className="public-container contacts-render-hero-grid">
            <div className="contacts-render-hero-copy">

              <h1>Свяжитесь с нами</h1>
              <p>
                Мы рады помочь. Задайте вопрос, запросите демо или обсудите возможности для вашего бизнеса — пишите на <strong>{siteConfig.contactEmail}</strong>.
              </p>
              <div className="contacts-render-trust" role="group" aria-label="Контакт MPReply">
                <span><PublicIcon name="users" />Реальные люди, а не боты</span>
                <span><PublicIcon name="clock" />Быстрые и полезные ответы</span>
                <span><PublicIcon name="shield-check" />Заботимся о вашем успехе</span>
              </div>
            </div>

            <div className="contacts-render-hero-scene supplied-hero-scene">
              <Image
                alt="Связаться с MPReply по электронной почте"
                className="supplied-hero-image"
                src="/images/approved/02-contacts-hero.avif"
                width={1656}
                height={950}
                sizes="(max-width: 1100px) 100vw, 50vw"
                priority
                unoptimized
              />
            </div>
          </div>
        </section>

        <section className="contacts-render-main">
          <div className="public-container contacts-render-main-grid">
            <div className="contacts-render-form-card">
              <div className="contacts-render-section-head">
                <h2>Напишите нам</h2>
                <p>Задайте вопрос через форму. Мы получим сообщение на {siteConfig.contactEmail}.</p>
              </div>
              <ContactMailForm supportEmail={siteConfig.contactEmail} />
            </div>

            <aside className="contacts-render-info-column" aria-label="Контактная информация MPReply">
              <article className="contacts-render-office-card">
                <div className="contacts-render-info-icon"><PublicIcon name="inbox" /></div>
                <div>
                  <h3>Единый адрес поддержки</h3>
                  <p>{siteConfig.contactEmail}</p>
                  <span className="contacts-render-office-label">Все публичные обращения</span>
                </div>
              </article>

              <article className="contacts-render-info-card">
                <span className="contacts-render-info-icon"><PublicIcon name="message" /></span>
                <div><h3>Что указать в письме</h3><p>Площадку, кабинет, задачу и состояние обращения — без секретных ключей доступа.</p></div>
              </article>

              <article className="contacts-render-info-card">
                <span className="contacts-render-info-icon"><PublicIcon name="shield-check" /></span>
                <div><h3>Безопасность</h3><p>Не отправляйте ключи доступа, пароли и другие секретные данные по электронной почте.</p></div>
              </article>
            </aside>
          </div>
        </section>

      </div>
    </PublicShell>
  );
}

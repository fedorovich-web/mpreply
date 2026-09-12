import type { Metadata } from "next";
import Link from "next/link";

import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";
import { siteConfig } from "../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Контакты MPReply — подключение маркетплейсов и пилот",
  description:
    "Связаться с MPReply по вопросам подключения Wildberries, Ozon, Яндекс Маркета и Авито, демо продукта и пилотного запуска автоматизации ответов.",
  path: "/contacts",
});

export default function ContactsPage() {
  return (
    <PublicShell>
      <section className="public-subhero public-subhero-contacts">
        <div className="public-container public-subhero-grid">
          <div className="public-subhero-copy">
            <p className="eyebrow">Контакты</p>
            <h1>Обсудить подключение маркетплейсов и сценарий автоматизации</h1>
            <p className="public-lead">
              Расскажите, с какими площадками работаете, какие обращения занимают больше всего времени и где хотите оставить ручной контроль. Так проще понять подходящий сценарий пилота.
            </p>
          </div>

          <aside className="contact-channel-panel">
            <span className="panel-kicker">Связаться с MPReply</span>
            {siteConfig.contactEmail ? (
              <a className="contact-email" href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>
            ) : (
              <strong>Контактный email будет опубликован перед открытым запуском</strong>
            )}
            <p>До публикации контакта продукт можно изучить через демо, возможности и страницы интеграций.</p>
          </aside>
        </div>
      </section>

      <div className="public-section">
        <div className="public-container contact-paths">
          <article className="contact-path contact-path-primary">
            <span>01</span>
            <div>
              <h2>Посмотреть продукт в работе</h2>
              <p>Разберите путь обращения: контекст, ИИ-черновик, правила, проверка и отправка.</p>
            </div>
            <Link className="button button-primary" href="/demo">Посмотреть демо</Link>
          </article>
          <article className="contact-path">
            <span>02</span>
            <div>
              <h2>Выбрать маркетплейс</h2>
              <p>Посмотрите сценарии для Wildberries, Ozon, Яндекс Маркета и Авито.</p>
            </div>
            <Link className="button button-secondary" href="/marketplaces">Все интеграции</Link>
          </article>
          <article className="contact-path">
            <span>03</span>
            <div>
              <h2>Понять возможности</h2>
              <p>Единая очередь, ИИ-ответы, ручная проверка, автоотправка, статусы и история обработки.</p>
            </div>
            <Link className="button button-secondary" href="/features">Возможности</Link>
          </article>
        </div>
      </div>
    </PublicShell>
  );
}

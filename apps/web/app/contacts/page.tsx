import type { Metadata } from "next";
import Link from "next/link";

import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";
import { siteConfig } from "../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Контакты",
  description: "Контакты Respio и точки входа для демо, интеграционных вопросов и будущего production-запуска.",
  path: "/contacts",
});

export default function ContactsPage() {
  return (
    <PublicShell>
      <section className="public-hero public-hero-compact">
        <div className="public-container public-hero-grid">
          <div className="public-hero-copy">
            <p className="eyebrow">Контакты</p>
            <h1>Обсудить Respio, интеграцию или пилот</h1>
            <p className="public-lead">Для production-запуска контактные данные и реквизиты оператора должны быть подтверждены и опубликованы в юридических документах.</p>
          </div>
          <aside className="public-note-card">
            <span className="panel-kicker">Контактный канал</span>
            {siteConfig.contactEmail ? (
              <a className="contact-email" href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>
            ) : (
              <strong>Контактный email пока не опубликован</strong>
            )}
            <p>Задайте `NEXT_PUBLIC_CONTACT_EMAIL` перед production build, если контакт должен отображаться публично.</p>
          </aside>
        </div>
      </section>
      <section className="public-section">
        <div className="public-container feature-grid feature-grid-3">
          <article className="feature-card"><h2>Демо</h2><p>Посмотреть продуктовый workflow без подключения реального кабинета.</p><Link className="text-link" href="/demo">Открыть демо →</Link></article>
          <article className="feature-card"><h2>Интеграции</h2><p>Проверить текущий статус marketplace adapters и ограничения.</p><Link className="text-link" href="/marketplaces">Статусы интеграций →</Link></article>
          <article className="feature-card"><h2>Безопасность</h2><p>API keys остаются backend-only, а рискованные ответы не должны уходить без проверки.</p><Link className="text-link" href="/features">Изучить архитектуру →</Link></article>
        </div>
      </section>
    </PublicShell>
  );
}

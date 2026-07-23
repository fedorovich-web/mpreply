import type { Metadata } from "next";
import Link from "next/link";

import { MarketingGlyph } from "../../components/public-site/MarketingGlyph";
import { PublicShell } from "../../components/public-site/PublicShell";
import { PublicTrialCta } from "../../components/public-site/PublicTrialCta";
import { createPageMetadata } from "../../lib/seo";
import { siteConfig } from "../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Контакты MP Reply",
  description:
    "Свяжитесь с командой по вопросам подключения маркетплейсов, пакетов ответов, тестирования и корпоративных условий.",
  path: "/contacts",
});

export default function ContactsPage() {
  return (
    <PublicShell>
      <section className="public-subhero">
        <div className="public-container public-subhero-grid">
          <div className="public-subhero-copy">
            <p className="public-eyebrow">Контакты</p>
            <h1>Обсудите подключение, объём обращений и правила автоматизации</h1>
            <p className="public-lead">
              Расскажите, с какими площадками и объёмом обращений работает команда. Мы поможем выбрать пакет ответов и определить сценарии для бесплатного теста.
            </p>
            <div className="hero-actions">
              <PublicTrialCta className="button button-primary" source="contacts-hero">Начать бесплатный тест</PublicTrialCta>
              {siteConfig.contactEmail ? (
                <Link className="button button-secondary" href={`mailto:${siteConfig.contactEmail}`}>Написать на почту</Link>
              ) : null}
            </div>
          </div>

          <aside className="public-proof-panel-v73">
            <MarketingGlyph variant="chats" />
            <h2>Что подготовить к разговору</h2>
            <ul>
              <li>Маркетплейсы и количество магазинов</li>
              <li>Примерный объём обращений и сезонные пики</li>
              <li>Какие ответы можно публиковать автоматически</li>
              <li>Где включить согласование в кабинете</li>
            </ul>
          </aside>
        </div>
      </section>

      <div className="public-section">
        <div className="public-container contact-grid-v73">
          <article className="public-card contact-card-v73">
            <MarketingGlyph variant="flow" />
            <h2>Подключение и пакеты</h2>
            <p>Подбор пакета, условия теста, несколько магазинов и индивидуальный объём ответов.</p>
          </article>
          <article className="public-card contact-card-v73">
            <MarketingGlyph variant="settings" />
            <h2>Автопубликация и правила</h2>
            <p>Автопубликация, стоп-темы, тон бренда, согласование и база знаний продавца.</p>
          </article>
          <article className="public-card contact-card-v73">
            <MarketingGlyph variant="history" />
            <h2>Агентства и крупные команды</h2>
            <p>Много магазинов, роли пользователей, аналитика и отдельный процесс запуска.</p>
          </article>
        </div>
      </div>
    </PublicShell>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";
import { siteConfig } from "../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Контакты Respio — демо, интеграция и пилот",
  description:
    "Связаться с Respio по вопросам демонстрации, пилота, интеграций маркетплейсов и будущего коммерческого подключения.",
  path: "/contacts",
});

export default function ContactsPage() {
  return (
    <PublicShell>
      <section className="public-subhero public-subhero-contacts">
        <div className="public-container public-subhero-grid">
          <div className="public-subhero-copy">
            <p className="eyebrow">Контакты</p>
            <h1>Обсудить демо, интеграцию или пилот Respio</h1>
            <p className="public-lead">
              Расскажите, с какими маркетплейсами работаете, какой объём отзывов и вопросов получаете и где сейчас возникает больше всего ручной работы.
            </p>
          </div>

          <aside className="contact-channel-panel">
            <span className="panel-kicker">Поддержка</span>
            <a className="contact-email" href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>
            <p>Напишите нам по вопросам аккаунта, работы сервиса, интеграций или пилотного подключения.</p>
          </aside>
        </div>
      </section>

      <div className="public-section">
        <div className="public-container contact-paths">
          <article className="contact-path contact-path-primary">
            <div>
              <h2>Посмотреть, как работает автоматизация</h2>
              <p>Разберите путь обращения через контекст, AI, SafetyGate, правила и очередь отправки.</p>
            </div>
            <Link className="button button-primary" href="/demo">Открыть демо</Link>
          </article>
          <article className="contact-path">
            <div>
              <h2>Проверить статус интеграции</h2>
              <p>Узнайте, какая площадка уже входит в MVP-основу, а какая ещё требует проверки API.</p>
            </div>
            <Link className="button button-secondary" href="/marketplaces">Статусы интеграций</Link>
          </article>
          <article className="contact-path">
            <div>
              <h2>Изучить возможности продукта</h2>
              <p>Inbox, SafetyGate, правила, очередь, повторы, usage accounting и журнал действий.</p>
            </div>
            <Link className="button button-secondary" href="/features">Все возможности</Link>
          </article>
        </div>
      </div>
    </PublicShell>
  );
}

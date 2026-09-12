import type { Metadata } from "next";
import Link from "next/link";

import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";
import { siteConfig } from "../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Контакты MPReply — подключение маркетплейсов и помощь",
  description:
    "Связаться с MPReply по вопросам подключения Wildberries, Ozon, Яндекс Маркета и Авито, настройки автоматизации, демо и работы с обращениями покупателей.",
  path: "/contacts",
});

export default function ContactsPage() {
  return (
    <PublicShell>
      <section className="public-subhero public-subhero-contacts">
        <div className="public-container public-subhero-grid">
          <div className="public-subhero-copy">
            <p className="eyebrow">Помощь и контакты</p>
            <h1>Поможем подключить площадки и настроить рабочий сценарий</h1>
            <p className="public-lead">
              Расскажите, с какими маркетплейсами работаете, какие обращения занимают больше всего времени и где хотите сохранить проверку сотрудником.
            </p>
          </div>

          <aside className="contact-channel-panel">
            <span className="panel-kicker">Связаться с командой</span>
            {siteConfig.contactEmail ? (
              <a className="contact-email" href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>
            ) : (
              <strong>Контакт доступен после входа в кабинет</strong>
            )}
            <p>Для знакомства с продуктом можно сразу открыть демо или начать подключение маркетплейсов.</p>
          </aside>
        </div>
      </section>

      <div className="public-section">
        <div className="public-container contact-paths">
          <article className="contact-path contact-path-primary">
            <span>01</span>
            <div>
              <h2>Посмотреть продукт в работе</h2>
              <p>Разберите путь обращения: контекст, черновик ответа, правила, проверка и отправка.</p>
            </div>
            <Link className="button button-primary" href="/demo">Открыть демо</Link>
          </article>
          <article className="contact-path">
            <span>02</span>
            <div>
              <h2>Подключить нужные площадки</h2>
              <p>Wildberries, Ozon, Яндекс Маркет и Авито доступны в одном рабочем пространстве.</p>
            </div>
            <Link className="button button-secondary" href="/marketplaces">Все интеграции</Link>
          </article>
          <article className="contact-path">
            <span>03</span>
            <div>
              <h2>Начать с реальной очереди</h2>
              <p>Создайте аккаунт, подключите кабинеты и настройте автоматизацию под правила вашей команды.</p>
            </div>
            <Link className="button button-secondary" href="/auth/register?intent=connect-marketplace">Начать подключение</Link>
          </article>
        </div>
      </div>
    </PublicShell>
  );
}

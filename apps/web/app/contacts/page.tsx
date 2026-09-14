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
      <section className="public-subhero public-subhero-contacts contacts-approved-hero">
        <div className="public-container public-subhero-grid contacts-hero-grid">
          <div className="public-subhero-copy">
            <p className="eyebrow">Помощь и контакты</p>
            <h1>Поможем подключить площадки и настроить рабочий сценарий</h1>
            <p className="public-lead">
              Расскажите, с какими маркетплейсами работаете, какие обращения занимают больше всего времени и где хотите сохранить проверку сотрудником.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href={`mailto:${siteConfig.contactEmail}`}>Написать в поддержку</a>
              <Link className="button button-secondary" href="/demo">Открыть демо</Link>
            </div>
          </div>

          <div className="contact-support-scene" role="group" aria-label="Связаться с поддержкой MPReply">
            <div className="contact-support-window">
              <div className="contact-support-head">
                <div>
                  <span className="contact-support-mark" aria-hidden="true">MP</span>
                  <div>
                    <strong>Поддержка MPReply</strong>
                    <small>Вопросы по продукту и подключению</small>
                  </div>
                </div>
                <span>support</span>
              </div>

              <div className="contact-support-body">
                <span className="contact-support-label">Основной email</span>
                <a className="contact-support-email" href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>
                <p>Подходит для вопросов по подключению площадок, настройке рабочего процесса, демо и работе с обращениями.</p>

                <div className="contact-support-facts" aria-label="Контактная информация">
                  <div className="contact-support-fact">
                    <span>Офис</span>
                    <strong>г. Майкоп, ул. Чкалова, 65, помещение 17А</strong>
                  </div>
                  <div className="contact-support-fact">
                    <span>Режим работы</span>
                    <strong>Ежедневно, 09:00–18:00 (МСК)</strong>
                  </div>
                </div>
              </div>

              <div className="contact-support-checklist" aria-label="Что полезно указать в обращении">
                <strong>Чтобы быстрее разобраться в вопросе</strong>
                <span>Укажите маркетплейс и кратко опишите ситуацию.</span>
                <span>Приложите скриншот ошибки или нужного экрана, если он помогает понять контекст.</span>
                <span>Не отправляйте пароли, секретные ключи и другие чувствительные данные.</span>
              </div>
            </div>

            <Link className="contact-support-route contact-support-route-demo" href="/demo">
              <span aria-hidden="true">▶</span>
              <div><strong>Нужно сначала посмотреть продукт?</strong><small>Откройте демо рабочего процесса.</small></div>
            </Link>
            <Link className="contact-support-route contact-support-route-connect" href="/auth/register?intent=connect-marketplace">
              <span aria-hidden="true">↗</span>
              <div><strong>Готовы подключать площадки?</strong><small>Начните с создания аккаунта.</small></div>
            </Link>
          </div>
        </div>
      </section>

      <section className="public-section contacts-path-section">
        <div className="public-container">
          <div className="section-heading section-heading-wide">
            <p className="eyebrow">Выберите следующий шаг</p>
            <h2>Поддержка, демо и подключение — без лишних переходов</h2>
            <p>Если вопрос уже сформулирован — пишите на email. Если только знакомитесь с продуктом — начните с демо или интеграций.</p>
          </div>

          <div className="contact-paths">
            <article className="contact-path contact-path-primary">
              <span>01</span>
              <div>
                <h3>Задать вопрос поддержке</h3>
                <p>Подключение площадок, настройка автоматизации, рабочий процесс и другие вопросы по MPReply.</p>
              </div>
              <a className="button button-primary" href={`mailto:${siteConfig.contactEmail}`}>Написать письмо</a>
            </article>
            <article className="contact-path">
              <span>02</span>
              <div>
                <h3>Посмотреть продукт в работе</h3>
                <p>Разберите путь обращения: контекст, черновик ответа, правила, проверка и отправка.</p>
              </div>
              <Link className="button button-secondary" href="/demo">Открыть демо</Link>
            </article>
            <article className="contact-path">
              <span>03</span>
              <div>
                <h3>Подключить нужные площадки</h3>
                <p>Wildberries, Ozon, Яндекс Маркет и Авито доступны в одном рабочем пространстве.</p>
              </div>
              <Link className="button button-secondary" href="/marketplaces">Все интеграции</Link>
            </article>
            <article className="contact-path">
              <span>04</span>
              <div>
                <h3>Начать с реальной очереди</h3>
                <p>Создайте аккаунт, подключите кабинеты и настройте автоматизацию под правила вашей команды.</p>
              </div>
              <Link className="button button-secondary" href="/auth/register?intent=connect-marketplace">Начать подключение</Link>
            </article>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

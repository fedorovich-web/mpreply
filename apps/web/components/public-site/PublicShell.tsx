import Link from "next/link";
import type { ReactNode } from "react";

import { siteConfig } from "../../lib/site-config";
import { PublicBrandMark } from "./PublicBrandMark";
import { PublicHeader } from "./PublicHeader";

type PublicShellProps = {
  children: ReactNode;
};

function FooterLogo() {
  return (
    <Link className="public-footer-logo" href="/" aria-label="MPReply — главная">
      <PublicBrandMark />
      <strong>MPReply</strong>
    </Link>
  );
}

export function PublicShell({ children }: PublicShellProps) {
  return (
    <div className="public-root">
      <a className="skip-link" href="#main-content">Перейти к содержимому</a>

      <PublicHeader />

      <main id="main-content">{children}</main>

      <footer className="public-footer public-footer-default">
        <div className="public-container public-footer-main">
          <div className="public-footer-brand">
            <FooterLogo />
            <p>Автоответы на отзывы, вопросы и сообщения покупателей на маркетплейсах.</p>
          </div>

          <div className="public-footer-column">
            <strong>Продукт</strong>
            <Link href="/features">Возможности</Link>
            <Link href="/marketplaces">Интеграции</Link>
            <Link href="/pricing">Тарифы</Link>
            <Link href="/demo">Посмотреть демо</Link>
          </div>

          <div className="public-footer-column">
            <strong>Сервис</strong>
            <Link href="/help#start">База знаний</Link>
            <Link href="/help#faq">FAQ</Link>
            <Link href="/contacts">Контакты</Link>
          </div>

          <div className="public-footer-column">
            <strong>Поддержка</strong>
            <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>
            <Link href="/help">Помощь и FAQ</Link>
            <Link href="/contacts">Связаться с нами</Link>
          </div>
        </div>

        <div className="public-container public-footer-bottom">
          <span>© {new Date().getFullYear()} MPReply. Все права защищены.</span>
          <nav aria-label="Документы">
            <Link href="/privacy">Политика конфиденциальности</Link>
            <Link href="/terms">Условия использования</Link>
          </nav>
        </div>
      </footer>

      <footer className="public-footer public-footer-compact" aria-label="Навигация в подвале">
        <div className="public-container public-footer-compact-inner">
          <div className="public-footer-compact-brand">
            <FooterLogo />
            <span>Ближе к вашим клиентам</span>
          </div>

          <nav className="public-footer-compact-nav" aria-label="Разделы сайта">
            <Link href="/features">Возможности</Link>
            <Link href="/marketplaces">Интеграции</Link>
            <Link href="/pricing">Тарифы</Link>
            <Link href="/demo">Демо</Link>
            <Link href="/help">Помощь</Link>
            <Link href="/contacts">Контакты</Link>
          </nav>

          <div className="public-footer-compact-meta">
            <span>© {new Date().getFullYear()} MPReply<br />Все права защищены.</span>
          </div>
        </div>
      </footer>

      <footer className="public-footer public-footer-pricing" aria-label="Информация о MPReply">
        <div className="public-container public-footer-pricing-main">
          <div className="public-footer-pricing-brand">
            <FooterLogo />
            <p>Автоматическая обработка отзывов, вопросов и сообщений на маркетплейсах.</p>
          </div>

          <div className="public-footer-pricing-column">
            <strong>Продукт</strong>
            <Link href="/features">Возможности</Link>
            <Link href="/pricing">Тарифы</Link>
            <Link href="/marketplaces">Интеграции</Link>
            <Link href="/demo">Демо</Link>
          </div>

          <div className="public-footer-pricing-column">
            <strong>Поддержка</strong>
            <Link href="/help">Помощь</Link>
            <Link href="/marketplaces">Интеграции</Link>
            <Link href="/contacts">Связаться с нами</Link>
          </div>

          <div className="public-footer-pricing-column public-footer-pricing-contacts">
            <strong>Контакты</strong>
            <span>г. Майкоп, ул. Чкалова, 65,<br />помещение 17А</span>
            <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>
            <span>Ежедневно 09:00–18:00 МСК</span>
          </div>
        </div>

        <div className="public-container public-footer-pricing-bottom">
          <span>© {new Date().getFullYear()} MPReply. Все права защищены.</span>
          <nav aria-label="Документы">
            <Link href="/privacy">Политика конфиденциальности</Link>
            <Link href="/terms">Условия использования</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

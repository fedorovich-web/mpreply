import Link from "next/link";
import type { ReactNode } from "react";

import { siteConfig } from "../../lib/site-config";
import { PublicHeader } from "./PublicHeader";

type PublicShellProps = {
  children: ReactNode;
};

function FooterBrandMark() {
  return (
    <span className="public-brand-mark" aria-hidden="true">
      <span className="public-brand-glyph"><i /><i /><i /></span>
    </span>
  );
}

export function PublicShell({ children }: PublicShellProps) {
  return (
    <div className="public-root">
      <a className="skip-link" href="#main-content">Перейти к содержимому</a>

      <PublicHeader />

      <main id="main-content">{children}</main>

      <footer className="public-footer">
        <div className="public-container public-footer-main">
          <div className="public-footer-brand">
            <Link className="public-footer-logo" href="/" aria-label="MPReply — главная">
              <FooterBrandMark />
              <strong>MPReply</strong>
            </Link>
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
            <strong>Ресурсы</strong>
            <Link href="/resources">Блог</Link>
            <Link href="/help">База знаний</Link>
            <Link href="/help">FAQ</Link>
            <Link href="/contacts">Контакты</Link>
          </div>

          <div className="public-footer-column">
            <strong>Поддержка</strong>
            {siteConfig.contactEmail ? <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a> : null}
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
    </div>
  );
}

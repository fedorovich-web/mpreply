import Link from "next/link";
import type { ReactNode } from "react";

import { siteConfig } from "../../lib/site-config";

type PublicShellProps = {
  children: ReactNode;
};

export function PublicShell({ children }: PublicShellProps) {
  return (
    <div className="public-root">
      <a className="skip-link" href="#main-content">
        Перейти к содержимому
      </a>
      <header className="public-header">
        <div className="public-container public-header-inner">
          <Link className="public-brand" href="/" aria-label="Respio — главная">
            <span className="public-brand-mark" aria-hidden="true">
              R
            </span>
            <span>
              <strong>Respio</strong>
              <small>AI-ответы для маркетплейсов</small>
            </span>
          </Link>
          <nav className="public-nav" aria-label="Основная навигация">
            {siteConfig.navigation.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="public-header-actions">
            <Link className="button button-ghost" href="/auth/login">
              Войти
            </Link>
            <Link className="button button-primary" href="/demo">
              Посмотреть демо
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content">{children}</main>

      <footer className="public-footer">
        <div className="public-container public-footer-grid">
          <div className="public-footer-brand">
            <strong>Respio</strong>
            <p>
              Auto-first SaaS для безопасной автоматизации ответов на отзывы и вопросы
              маркетплейсов.
            </p>
          </div>
          <div>
            <strong>Продукт</strong>
            <Link href="/features">Возможности</Link>
            <Link href="/marketplaces">Маркетплейсы</Link>
            <Link href="/pricing">Тарифы</Link>
            <Link href="/demo">Демо</Link>
          </div>
          <div>
            <strong>Компания</strong>
            <Link href="/resources">Материалы</Link>
            <Link href="/contacts">Контакты</Link>
            <Link href="/privacy">Конфиденциальность</Link>
            <Link href="/terms">Условия</Link>
          </div>
        </div>
        <div className="public-container public-footer-bottom">
          <span>© {new Date().getFullYear()} Respio</span>
          <span>Перед production-запуском юридические документы проходят финальную проверку.</span>
        </div>
      </footer>
    </div>
  );
}

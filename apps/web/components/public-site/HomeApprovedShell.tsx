import Link from "next/link";
import type { ReactNode } from "react";

import { siteConfig } from "../../lib/site-config";
import { PublicBrandMark } from "./PublicBrandMark";

const homeNavigation = [
  { href: "/features", label: "Возможности" },
  { href: "/marketplaces", label: "Интеграции" },
  { href: "/pricing", label: "Тарифы" },
  { href: "/help", label: "Блог" },
  { href: "/help", label: "Помощь" },
] as const;

type HomeApprovedShellProps = {
  children: ReactNode;
};

function HomeLogo() {
  return (
    <Link className="home-reference-logo" href="/" aria-label="MPReply — главная">
      <PublicBrandMark />
      <strong>MPReply</strong>
    </Link>
  );
}

export function HomeApprovedShell({ children }: HomeApprovedShellProps) {
  return (
    <div className="public-root homepage-reference-root">
      <a className="skip-link" href="#main-content">Перейти к содержимому</a>

      <header className="home-reference-header">
        <div className="public-container home-reference-header-inner">
          <HomeLogo />
          <nav className="home-reference-nav" aria-label="Основная навигация">
            {homeNavigation.map((item, index) => (
              <Link href={item.href} key={`${item.label}-${index}`}>{item.label}</Link>
            ))}
          </nav>
          <div className="home-reference-header-actions">
            <Link className="home-reference-login" href="/auth/login">Войти</Link>
            <Link className="button button-primary" href="/auth/register?intent=connect-marketplace">
              Создать аккаунт <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content">{children}</main>

      <footer className="home-reference-footer">
        <div className="public-container home-reference-footer-grid">
          <div className="home-reference-footer-brand">
            <HomeLogo />
            <p>Автоответы на отзывы, вопросы<br />и сообщения покупателей<br />на маркетплейсах.</p>
          </div>

          <div className="home-reference-footer-column">
            <strong>Продукт</strong>
            <Link href="/features">Возможности</Link>
            <Link href="/marketplaces">Интеграции</Link>
            <Link href="/pricing">Тарифы</Link>
            <Link href="/demo">Кейсы</Link>
          </div>

          <div className="home-reference-footer-column">
            <strong>Ресурсы</strong>
            <Link href="/help">Блог</Link>
            <Link href="/help#start">База знаний</Link>
            <Link href="/help#faq">FAQ</Link>
            <Link href="/help">Статус сервисов</Link>
          </div>

          <div className="home-reference-footer-column">
            <strong>Компания</strong>
            <Link href="/contacts">О нас</Link>
            <Link href="/contacts">Партнёрам</Link>
            <Link href="/contacts">Контакты</Link>
            <Link href="/contacts">Вакансии</Link>
          </div>

          <div className="home-reference-footer-column home-reference-footer-support">
            <strong>Поддержка</strong>
            <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>
            <span>Пн — Пт, 9:00 — 18:00 (МСК)</span>
          </div>
        </div>

        <div className="public-container home-reference-footer-bottom">
          <span>© 2024 MPReply. Все права защищены.</span>
          <nav aria-label="Документы">
            <Link href="/privacy">Политика конфиденциальности</Link>
            <Link href="/terms">Условия использования</Link>
            <Link href="/privacy">Обработка данных</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";

import { alternateLocale, localizedPath, type Locale } from "../../lib/i18n";
import { getSiteConfig } from "../../lib/site-config";
import { PublicBrandMark } from "./PublicBrandMark";

const homeNavigation = {
  ru: [
    { href: "/features", label: "Возможности" },
    { href: "/marketplaces", label: "Интеграции" },
    { href: "/pricing", label: "Тарифы" },
    { href: "/help", label: "Помощь" },
  ],
  en: [
    { href: "/features", label: "Features" },
    { href: "/marketplaces", label: "Integrations" },
    { href: "/pricing", label: "Pricing" },
    { href: "/help", label: "Help" },
  ],
} as const;

const copy = {
  ru: {
    skip: "Перейти к содержимому",
    home: "MPReply — главная",
    nav: "Основная навигация",
    login: "Войти",
    register: "Создать аккаунт",
    product: "Продукт",
    resources: "Ресурсы",
    documents: "Документы",
    support: "Поддержка",
    features: "Возможности",
    integrations: "Интеграции",
    pricing: "Тарифы",
    demo: "Демо",
    knowledge: "База знаний",
    help: "Помощь",
    privacy: "Политика конфиденциальности",
    terms: "Условия использования",
    data: "Обработка данных",
    contacts: "Контакты",
    description: <>Автоответы на отзывы, вопросы<br />и сообщения покупателей<br />на маркетплейсах.</>,
    supportNote: "Единственный публичный адрес поддержки",
    rights: "Все права защищены.",
    language: "Switch to English",
  },
  en: {
    skip: "Skip to content",
    home: "MPReply — home",
    nav: "Main navigation",
    login: "Log in",
    register: "Create account",
    product: "Product",
    resources: "Resources",
    documents: "Legal",
    support: "Support",
    features: "Features",
    integrations: "Integrations",
    pricing: "Pricing",
    demo: "Demo",
    knowledge: "Getting started",
    help: "Help",
    privacy: "Privacy Policy",
    terms: "Terms of Use",
    data: "Data processing",
    contacts: "Contact",
    description: <>AI-assisted replies for reviews, questions,<br />and customer messages<br />across marketplaces.</>,
    supportNote: "Official public support address",
    rights: "All rights reserved.",
    language: "Переключить на русский",
  },
} as const;

type HomeApprovedShellProps = {
  children: ReactNode;
  locale?: Locale;
};

function HomeLogo({ locale, label }: { locale: Locale; label: string }) {
  return (
    <Link className="home-reference-logo" href={localizedPath(locale, "/")} aria-label={label}>
      <PublicBrandMark />
      <strong>MPReply</strong>
    </Link>
  );
}

export function HomeApprovedShell({ children, locale = "ru" }: HomeApprovedShellProps) {
  const labels = copy[locale];
  const config = getSiteConfig(locale);
  const otherLocale = alternateLocale(locale);
  const path = (value: string) => localizedPath(locale, value);

  return (
    <div className="public-root homepage-reference-root">
      <a className="skip-link" href="#main-content">{labels.skip}</a>

      <header className="home-reference-header">
        <div className="public-container home-reference-header-inner">
          <HomeLogo locale={locale} label={labels.home} />
          <nav className="home-reference-nav" aria-label={labels.nav}>
            {homeNavigation[locale].map((item, index) => (
              <Link href={path(item.href)} key={`${item.label}-${index}`}>{item.label}</Link>
            ))}
          </nav>
          <div className="home-reference-header-actions">
            <Link
              className="home-reference-login"
              href={localizedPath(otherLocale, "/")}
              hrefLang={otherLocale}
              aria-label={labels.language}
            >
              {otherLocale.toUpperCase()}
            </Link>
            <Link className="home-reference-login" href={path("/auth/login")}>{labels.login}</Link>
            <Link className="button button-primary" href={path("/auth/register?intent=connect-marketplace")}>
              {labels.register} <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content">{children}</main>

      <footer className="home-reference-footer">
        <div className="public-container home-reference-footer-grid">
          <div className="home-reference-footer-brand">
            <HomeLogo locale={locale} label={labels.home} />
            <p>{labels.description}</p>
          </div>

          <div className="home-reference-footer-column">
            <strong>{labels.product}</strong>
            <Link href={path("/features")}>{labels.features}</Link>
            <Link href={path("/marketplaces")}>{labels.integrations}</Link>
            <Link href={path("/pricing")}>{labels.pricing}</Link>
            <Link href={path("/demo")}>{labels.demo}</Link>
          </div>

          <div className="home-reference-footer-column">
            <strong>{labels.resources}</strong>
            <Link href={`${path("/help")}#start`}>{labels.knowledge}</Link>
            <Link href={`${path("/help")}#faq`}>FAQ</Link>
            <Link href={path("/help")}>{labels.help}</Link>
          </div>

          <div className="home-reference-footer-column">
            <strong>{labels.documents}</strong>
            <Link href={path("/privacy")}>{labels.privacy}</Link>
            <Link href={path("/terms")}>{labels.terms}</Link>
            <Link href={path("/privacy")}>{labels.data}</Link>
            <Link href={path("/contacts")}>{labels.contacts}</Link>
          </div>

          <div className="home-reference-footer-column home-reference-footer-support">
            <strong>{labels.support}</strong>
            <a href={`mailto:${config.contactEmail}`}>{config.contactEmail}</a>
            <span>{labels.supportNote}</span>
          </div>
        </div>

        <div className="public-container home-reference-footer-bottom">
          <span>© {new Date().getFullYear()} MPReply. {labels.rights}</span>
          <nav aria-label={labels.documents}>
            <Link href={path("/privacy")}>{labels.privacy}</Link>
            <Link href={path("/terms")}>{labels.terms}</Link>
            <Link href={path("/privacy")}>{labels.data}</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

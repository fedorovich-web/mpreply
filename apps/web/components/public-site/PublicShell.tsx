import Link from "next/link";
import type { ReactNode } from "react";

import { localizedPath, type Locale } from "../../lib/i18n";
import { getSiteConfig } from "../../lib/site-config";
import { PublicBrandMark } from "./PublicBrandMark";
import { PublicHeader } from "./PublicHeader";

type PublicShellProps = {
  children: ReactNode;
  locale?: Locale;
};

const shellCopy = {
  ru: {
    skip: "Перейти к содержимому",
    homeLabel: "MPReply — главная",
    defaultDescription: "Автоответы на отзывы, вопросы и сообщения покупателей на маркетплейсах.",
    product: "Продукт",
    features: "Возможности",
    integrations: "Интеграции",
    pricing: "Тарифы",
    demo: "Посмотреть демо",
    service: "Сервис",
    knowledge: "База знаний",
    contacts: "Контакты",
    support: "Поддержка",
    helpFaq: "Помощь и FAQ",
    contactUs: "Связаться с нами",
    documents: "Документы",
    privacy: "Политика конфиденциальности",
    terms: "Условия использования",
    rights: "Все права защищены.",
    closer: "Ближе к вашим клиентам",
    sections: "Разделы сайта",
    footerNav: "Навигация в подвале",
    pricingFooter: "Информация о MPReply",
    pricingDescription: "Автоматическая обработка отзывов, вопросов и сообщений на маркетплейсах.",
    supportOnly: "Единственный публичный адрес поддержки",
    writeSupport: "Написать в поддержку",
  },
  en: {
    skip: "Skip to content",
    homeLabel: "MPReply — home",
    defaultDescription: "AI-assisted replies and automation for marketplace reviews, questions, and customer messages.",
    product: "Product",
    features: "Features",
    integrations: "Integrations",
    pricing: "Pricing",
    demo: "View demo",
    service: "Resources",
    knowledge: "Getting started",
    contacts: "Contact",
    support: "Support",
    helpFaq: "Help & FAQ",
    contactUs: "Contact us",
    documents: "Legal",
    privacy: "Privacy Policy",
    terms: "Terms of Use",
    rights: "All rights reserved.",
    closer: "Stay closer to your customers",
    sections: "Site sections",
    footerNav: "Footer navigation",
    pricingFooter: "About MPReply",
    pricingDescription: "Automated handling of marketplace reviews, questions, and customer messages.",
    supportOnly: "Official public support address",
    writeSupport: "Contact support",
  },
} as const;

function FooterLogo({ locale, label }: { locale: Locale; label: string }) {
  return (
    <Link className="public-footer-logo" href={localizedPath(locale, "/")} aria-label={label}>
      <PublicBrandMark />
      <strong>MPReply</strong>
    </Link>
  );
}

export function PublicShell({ children, locale = "ru" }: PublicShellProps) {
  const labels = shellCopy[locale];
  const config = getSiteConfig(locale);
  const path = (value: string) => localizedPath(locale, value);

  return (
    <div className="public-root">
      <a className="skip-link" href="#main-content">{labels.skip}</a>

      <PublicHeader locale={locale} />

      <main id="main-content">{children}</main>

      <footer className="public-footer public-footer-default">
        <div className="public-container public-footer-main">
          <div className="public-footer-brand">
            <FooterLogo locale={locale} label={labels.homeLabel} />
            <p>{labels.defaultDescription}</p>
          </div>

          <div className="public-footer-column">
            <strong>{labels.product}</strong>
            <Link href={path("/features")}>{labels.features}</Link>
            <Link href={path("/marketplaces")}>{labels.integrations}</Link>
            <Link href={path("/pricing")}>{labels.pricing}</Link>
            <Link href={path("/demo")}>{labels.demo}</Link>
          </div>

          <div className="public-footer-column">
            <strong>{labels.service}</strong>
            <Link href={`${path("/help")}#start`}>{labels.knowledge}</Link>
            <Link href={`${path("/help")}#faq`}>FAQ</Link>
            <Link href={path("/contacts")}>{labels.contacts}</Link>
          </div>

          <div className="public-footer-column">
            <strong>{labels.support}</strong>
            <a href={`mailto:${config.contactEmail}`}>{config.contactEmail}</a>
            <Link href={path("/help")}>{labels.helpFaq}</Link>
            <Link href={path("/contacts")}>{labels.contactUs}</Link>
          </div>
        </div>

        <div className="public-container public-footer-bottom">
          <span>© {new Date().getFullYear()} MPReply. {labels.rights}</span>
          <nav aria-label={labels.documents}>
            <Link href={path("/privacy")}>{labels.privacy}</Link>
            <Link href={path("/terms")}>{labels.terms}</Link>
          </nav>
        </div>
      </footer>

      <footer className="public-footer public-footer-compact" aria-label={labels.footerNav}>
        <div className="public-container public-footer-compact-inner">
          <div className="public-footer-compact-brand">
            <FooterLogo locale={locale} label={labels.homeLabel} />
            <span>{labels.closer}</span>
          </div>

          <nav className="public-footer-compact-nav" aria-label={labels.sections}>
            <Link href={path("/features")}>{labels.features}</Link>
            <Link href={path("/marketplaces")}>{labels.integrations}</Link>
            <Link href={path("/pricing")}>{labels.pricing}</Link>
            <Link href={path("/demo")}>{locale === "ru" ? "Демо" : "Demo"}</Link>
            <Link href={path("/help")}>{locale === "ru" ? "Помощь" : "Help"}</Link>
            <Link href={path("/contacts")}>{labels.contacts}</Link>
          </nav>

          <div className="public-footer-compact-meta">
            <span>© {new Date().getFullYear()} MPReply<br />{labels.rights}</span>
          </div>
        </div>
      </footer>

      <footer className="public-footer public-footer-pricing" aria-label={labels.pricingFooter}>
        <div className="public-container public-footer-pricing-main">
          <div className="public-footer-pricing-brand">
            <FooterLogo locale={locale} label={labels.homeLabel} />
            <p>{labels.pricingDescription}</p>
          </div>

          <div className="public-footer-pricing-column">
            <strong>{labels.product}</strong>
            <Link href={path("/features")}>{labels.features}</Link>
            <Link href={path("/pricing")}>{labels.pricing}</Link>
            <Link href={path("/marketplaces")}>{labels.integrations}</Link>
            <Link href={path("/demo")}>{locale === "ru" ? "Демо" : "Demo"}</Link>
          </div>

          <div className="public-footer-pricing-column">
            <strong>{labels.support}</strong>
            <Link href={path("/help")}>{locale === "ru" ? "Помощь" : "Help"}</Link>
            <Link href={path("/marketplaces")}>{labels.integrations}</Link>
            <Link href={path("/contacts")}>{labels.contactUs}</Link>
          </div>

          <div className="public-footer-pricing-column public-footer-pricing-contacts">
            <strong>{labels.contacts}</strong>
            <a href={`mailto:${config.contactEmail}`}>{config.contactEmail}</a>
            <span>{labels.supportOnly}</span>
            <Link href={path("/contacts")}>{labels.writeSupport}</Link>
          </div>
        </div>

        <div className="public-container public-footer-pricing-bottom">
          <span>© {new Date().getFullYear()} MPReply. {labels.rights}</span>
          <nav aria-label={labels.documents}>
            <Link href={path("/privacy")}>{labels.privacy}</Link>
            <Link href={path("/terms")}>{labels.terms}</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

import Link from "next/link";

import { localizedPath, type Locale } from "../../lib/i18n";
import { getSiteConfig } from "../../lib/site-config";
import { PublicBrandMark } from "./PublicBrandMark";
import { PublicFooterGroup } from "./PublicFooterGroup";

const copy = {
  ru: {
    home: "MPReply — главная",
    product: "Продукт",
    resources: "Ресурсы",
    documents: "Документы",
    support: "Поддержка",
    features: "Возможности",
    integrations: "Интеграции",
    pricing: "Тарифы",
    demo: "Демо",
    help: "Помощь",
    privacy: "Политика конфиденциальности",
    terms: "Условия использования",
    contacts: "Контакты",
    description: <>Автоответы на отзывы, вопросы<br />и сообщения покупателей<br />на маркетплейсах.</>,
    rights: "Все права защищены.",
  },
  en: {
    home: "MPReply — home",
    product: "Product",
    resources: "Resources",
    documents: "Legal",
    support: "Support",
    features: "Features",
    integrations: "Integrations",
    pricing: "Pricing",
    demo: "Demo",
    help: "Help",
    privacy: "Privacy Policy",
    terms: "Terms of Use",
    contacts: "Contact",
    description: <>AI-assisted replies for reviews, questions,<br />and customer messages<br />across marketplaces.</>,
    rights: "All rights reserved.",
  },
} as const;

export function PublicFooter({ locale = "ru" }: { locale?: Locale }) {
  const labels = copy[locale];
  const config = getSiteConfig(locale);
  const path = (value: string) => localizedPath(locale, value);

  return (
    <footer className="home-reference-footer">
      <div className="public-container home-reference-footer-grid">
        <div className="home-reference-footer-brand">
          <Link className="home-reference-logo" href={path("/")} aria-label={labels.home}>
            <PublicBrandMark />
          </Link>
          <p>{labels.description}</p>
        </div>

        <PublicFooterGroup title={labels.product} className="home-reference-footer-column">
          <Link href={path("/features")}>{labels.features}</Link>
          <Link href={path("/marketplaces")}>{labels.integrations}</Link>
          <Link href={path("/pricing")}>{labels.pricing}</Link>
          <Link href={path("/demo")}>{labels.demo}</Link>
        </PublicFooterGroup>

        <PublicFooterGroup title={labels.resources} className="home-reference-footer-column">
          <Link href={path("/help")}>{labels.help}</Link>
          <Link href={path("/contacts")}>{labels.contacts}</Link>
        </PublicFooterGroup>

        <PublicFooterGroup title={labels.documents} className="home-reference-footer-column">
          <Link href={path("/privacy")}>{labels.privacy}</Link>
          <Link href={path("/terms")}>{labels.terms}</Link>
        </PublicFooterGroup>

        <PublicFooterGroup title={labels.support} className="home-reference-footer-column home-reference-footer-support">
          <a href={`mailto:${config.contactEmail}`}>{config.contactEmail}</a>
        </PublicFooterGroup>
      </div>

      <div className="public-container home-reference-footer-bottom">
        <span>© {new Date().getFullYear()} MPReply. {labels.rights}</span>
      </div>
    </footer>
  );
}

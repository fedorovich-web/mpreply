import type { Metadata } from "next";
import { headers } from "next/headers";

import { htmlLanguage, localeFromRequestHeader, localeRequestHeader } from "../lib/i18n";
import { siteConfig } from "../lib/site-config";
import "../styles/globals.css";
import "../styles/brand-theme.css";
import "../styles/marketing-site.css";
import "../styles/marketing-pages.css";
import "../styles/help-legal-approved.css";
import "../styles/help-center.css";
import "../styles/homepage-approved.css";
import "../styles/public-mockup-fidelity.css";
import "../styles/public-mockup-pages.css";
import "../styles/marketplace-logo-assets.css";
import "../styles/public-mockup-render-tuning.css";
import "../styles/public-mockup-brand-fidelity.css";
import "../styles/public-mockup-cta-fidelity.css";
import "../styles/public-mockup-decorative-fidelity.css";
import "../styles/public-mockup-final-details.css";
import "../styles/public-mockup-mascot.css";
import "../styles/public-features-sidebar-fidelity.css";
import "../styles/public-detail-hero-fidelity.css";
import "../styles/public-pricing-integration-fidelity.css";
import "../styles/public-compact-footer.css";
import "../styles/public-header-fidelity.css";
import "../styles/public-inner-blue-reference.css";
import "../styles/public-contact-404-render.css";
import "../styles/homepage-reference-restore.css";
import "../styles/public-supplied-heroes.css";
import "../styles/public-approved-raster-icons.css";
import "../styles/approved-assets.css";
import "../styles/public-section-spacing.css";
import "../styles/public-readable-type.css";
import "../styles/public-heading-scale.css";
import "../styles/public-hero-system.css";
import "../styles/demo-entry.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.origin),
  title: {
    default: "MPReply — ИИ-ответы для маркетплейсов",
    template: "%s | MPReply",
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  category: "business",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", type: "image/png", sizes: "96x96" },
    ],
    apple: "/apple-touch-icon.png",
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: siteConfig.name,
    title: "MPReply — ИИ-ответы для маркетплейсов",
    description: siteConfig.description,
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "MPReply — ИИ-ответы для маркетплейсов",
    description: siteConfig.description,
  },
  robots: {
    index: true,
    follow: true,
  },
};

const themeScript = `
(() => {
  try {
    const current = localStorage.getItem("mpreply-theme");
    const legacy = localStorage.getItem("respio-theme");
    const saved = current ?? legacy;
    const theme = saved === "dark" || saved === "light" ? saved : "light";
    localStorage.setItem("mpreply-theme", theme);
    if (legacy !== null) localStorage.removeItem("respio-theme");
    document.documentElement.dataset.theme = theme;
  } catch {
    document.documentElement.dataset.theme = "light";
  }
})();`;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const locale = localeFromRequestHeader(requestHeaders.get(localeRequestHeader));

  return (
    <html lang={htmlLanguage(locale)} suppressHydrationWarning>
      <head>
        <script nonce={requestHeaders.get("x-nonce") ?? undefined} dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";

import { siteConfig } from "../lib/site-config";
import "../styles/globals.css";
import "../styles/brand-theme.css";
import "../styles/marketing-site.css";
import "../styles/marketing-pages.css";
import "../styles/marketplaces-approved.css";
import "../styles/homepage-approved.css";
import "../styles/homepage-fidelity.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.origin),
  title: {
    default: "MPReply — ИИ-ответы для маркетплейсов",
    template: "%s | MPReply",
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  category: "business",
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
    const saved = localStorage.getItem("respio-theme");
    const theme = saved === "dark" || saved === "light" ? saved : "light";
    document.documentElement.dataset.theme = theme;
  } catch {
    document.documentElement.dataset.theme = "light";
  }
})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

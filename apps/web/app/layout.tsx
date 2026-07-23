import type { Metadata } from "next";

import { siteConfig } from "../lib/site-config";
import "../styles/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.origin),
  title: {
    default: "MP Reply — ИИ-ответы на отзывы, вопросы и чаты маркетплейсов",
    template: "%s | MP Reply",
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
    title: "MP Reply — ИИ-ответы на отзывы, вопросы и чаты маркетплейсов",
    description: siteConfig.description,
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "MP Reply — ИИ-ответы для маркетплейсов",
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
    const saved = localStorage.getItem("mpreply-theme");
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
        <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-title" content="MP Reply" />
        <link rel="manifest" href="/site.webmanifest" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

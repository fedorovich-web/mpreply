import type { Metadata } from "next";

import { siteConfig } from "../lib/site-config";
import "../styles/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.origin),
  title: {
    default: "Respio — ИИ-ответы на отзывы и вопросы маркетплейсов",
    template: "%s | Respio",
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
    title: "Respio — ИИ-ответы на отзывы и вопросы маркетплейсов",
    description: siteConfig.description,
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "Respio — ИИ-ответы для маркетплейсов",
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

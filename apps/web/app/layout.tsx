import type { Metadata } from "next";

import { siteConfig } from "../lib/site-config";
import "../styles/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.origin),
  title: {
    default: "Respio — AI-ответы на отзывы и вопросы маркетплейсов",
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
    title: "Respio — AI-ответы на отзывы и вопросы маркетплейсов",
    description: siteConfig.description,
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "Respio — AI-ответы для маркетплейсов",
    description: siteConfig.description,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}

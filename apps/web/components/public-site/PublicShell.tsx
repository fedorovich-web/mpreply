import type { ReactNode } from "react";

import type { Locale } from "../../lib/i18n";
import { PublicFooter } from "./PublicFooter";
import { PublicHeader } from "./PublicHeader";

type PublicShellProps = {
  children: ReactNode;
  locale?: Locale;
  home?: boolean;
};

const skipLabels = {
  ru: "Перейти к содержимому",
  en: "Skip to content",
} as const;

export function PublicShell({ children, locale = "ru", home = false }: PublicShellProps) {
  return (
    <div className={home ? "public-root homepage-reference-root" : "public-root"}>
      <a className="skip-link" href="#main-content">{skipLabels[locale]}</a>
      <PublicHeader locale={locale} />
      <main id="main-content">{children}</main>
      <PublicFooter locale={locale} />
    </div>
  );
}

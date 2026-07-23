import Link from "next/link";
import type { ReactNode } from "react";

import { marketplaces } from "../../lib/site-config";
import { BrandLogo } from "./BrandLogo";
import { PublicHeader } from "./PublicHeader";
import { PublicTrialModal } from "./PublicTrialModal";

type PublicShellProps = {
  children: ReactNode;
};

export function PublicShell({ children }: PublicShellProps) {
  return (
    <div className="public-root">
      <a className="skip-link" href="#main-content">Перейти к содержимому</a>

      <PublicHeader />

      <main id="main-content">{children}</main>

      <footer className="public-footer">
        <div className="public-container public-footer-grid">
          <div className="public-footer-brand">
            <Link className="public-footer-logo" href="/" aria-label="MP Reply — главная">
              <BrandLogo
                className="public-footer-brand-logo"
                imageClassName="public-footer-brand-logo-image"
                alt=""
              />
            </Link>
            <p>
              Автоматические ИИ-ответы на отзывы, вопросы и чаты покупателей с учётом данных товара, правил продавца и настроек согласования.
            </p>
          </div>

          <div>
            <strong>Продукт</strong>
            <Link href="/features">Возможности</Link>
            <Link href="/#models">ИИ-модели</Link>
            <Link href="/pricing">Тарифы</Link>
            <Link href="/demo">Как работает сервис</Link>
            <Link href="/contacts">Контакты</Link>
          </div>
          <div>
            <strong>Маркетплейсы</strong>
            {marketplaces.map((marketplace) => (
              <Link key={marketplace.key} href={marketplace.path}>{marketplace.name}</Link>
            ))}
          </div>
          <div>
            <strong>Документы</strong>
            <Link href="/privacy">Конфиденциальность</Link>
            <Link href="/terms">Условия использования</Link>
          </div>
        </div>

        <div className="public-container public-footer-bottom">
          <span>© {new Date().getFullYear()} MP Reply</span>
          <span>Wildberries · Ozon · Яндекс Маркет · Авито</span>
        </div>
      </footer>

      <PublicTrialModal />
    </div>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";

import { marketplaces } from "../../lib/site-config";
import { PublicHeader } from "./PublicHeader";

type PublicShellProps = {
  children: ReactNode;
};

export function PublicShell({ children }: PublicShellProps) {
  return (
    <div className="public-root">
      <a className="skip-link" href="#main-content">
        Перейти к содержимому
      </a>

      <PublicHeader />

      <main id="main-content">{children}</main>

      <footer className="public-footer">
        <div className="public-container public-footer-topline">
          <div className="public-footer-brand">
            <Link className="public-footer-logo" href="/" aria-label="Respio — главная">
              <span className="public-brand-mark" aria-hidden="true">R</span>
              <strong>Respio</strong>
            </Link>
            <p>
              Автоматизирует ответы на отзывы и вопросы маркетплейсов, проверяет рискованные случаи до отправки и оставляет понятную историю действий.
            </p>
          </div>
        </div>

        <div className="public-container public-footer-grid">
          <div>
            <strong>Продукт</strong>
            <Link href="/features">Возможности</Link>
            <Link href="/#safetygate">SafetyGate</Link>
            <Link href="/pricing">Тарифы</Link>
            <Link href="/demo">Как работает Respio</Link>
          </div>
          <div>
            <strong>Маркетплейсы</strong>
            {marketplaces.map((marketplace) => (
              <Link key={marketplace.key} href={marketplace.path}>
                <span>{marketplace.name}</span>
                <small>{marketplace.statusLabel}</small>
              </Link>
            ))}
          </div>
          <div>
            <strong>Ресурсы</strong>
            <Link href="/resources">Материалы</Link>
            <Link href="/contacts">Контакты</Link>
          </div>
          <div>
            <strong>Документы</strong>
            <Link href="/privacy">Конфиденциальность</Link>
            <Link href="/terms">Условия использования</Link>
          </div>
        </div>

        <div className="public-container public-footer-bottom">
          <span>© {new Date().getFullYear()} Respio</span>
          <span>Информация о планируемых интеграциях не означает их текущую production-доступность.</span>
        </div>
      </footer>
    </div>
  );
}

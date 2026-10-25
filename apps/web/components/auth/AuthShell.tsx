import Link from "next/link";
import type { ReactNode } from "react";

import { localizedPath, type Locale } from "../../lib/i18n";
import styles from "./AuthShell.module.css";

type AuthShellProps = {
  children: ReactNode;
  description: string;
  eyebrow: string;
  footer?: ReactNode;
  locale?: Locale;
  title: string;
};

export function AuthShell({
  children,
  description,
  eyebrow,
  footer,
  locale = "ru",
  title,
}: AuthShellProps) {
  return (
    <main className={styles.page}>
      <section className={styles.formPanel} aria-labelledby="auth-title">
        <div className={styles.formContainer}>
          <Link className={styles.brand} href={localizedPath(locale, "/")} aria-label={locale === "ru" ? "MPReply — на главную" : "MPReply — home"}>
            <span>MPReply</span>
          </Link>

          <div className={styles.heading}>
            <p className="eyebrow">{eyebrow}</p>
            <h1 id="auth-title">{title}</h1>
            <p className="auth-description">{description}</p>
          </div>

          <div className={styles.content}>{children}</div>

          {footer ? <div className={styles.footer}>{footer}</div> : null}
        </div>
      </section>

      <aside className={styles.previewPanel} aria-labelledby="auth-overview-title">
        <div className={styles.previewCopy}>
          <p className={styles.previewKicker}>{locale === "ru" ? "Как работает MPReply" : "How MPReply works"}</p>
          <h2 id="auth-overview-title">{locale === "ru" ? "Автоматизация с проверкой там, где она нужна" : "Automation with review where needed"}</h2>
          <p>{locale === "ru" ? "MPReply собирает обращения покупателей, помогает подготовить ответы и передаёт сложные случаи на проверку." : "MPReply collects customer messages, helps prepare replies, and sends exceptions for review."}</p>
        </div>

        <ol className={styles.workflow}>
          <li className={styles.workflowItem}>
            <div className={styles.workflowContent}>
              <strong>{locale === "ru" ? "Обращения в очереди" : "Customer messages in one queue"}</strong>
              <span>{locale === "ru" ? "Отзывы, вопросы и поддерживаемые сообщения собраны в одном месте." : "Reviews, questions, and supported messages are collected in one place."}</span>
            </div>
          </li>
          <li className={styles.workflowItem}>
            <div className={styles.workflowContent}>
              <strong>{locale === "ru" ? "Подготовка ответа" : "Reply preparation"}</strong>
              <span>{locale === "ru" ? "ИИ помогает сформулировать ответ с учётом контекста и тона бренда." : "AI helps prepare a reply using context and your brand tone."}</span>
            </div>
          </li>
          <li className={styles.workflowItem}>
            <div className={styles.workflowContent}>
              <strong>{locale === "ru" ? "Отправка по правилам" : "Sending according to your rules"}</strong>
              <span>{locale === "ru" ? "Безопасные ответы отправляются автоматически, сложные случаи остаются на проверке." : "Safe replies are sent automatically; exceptions stay under review."}</span>
            </div>
          </li>
        </ol>

        <p className={styles.marketplaceNote}>{locale === "ru" ? "Подключайте кабинеты Wildberries, Ozon, Яндекс Маркета и Авито." : "Connect your Wildberries, Ozon, Yandex Market, and Avito accounts."}</p>
      </aside>
    </main>
  );
}

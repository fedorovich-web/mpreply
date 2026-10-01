import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./AuthShell.module.css";

type AuthShellProps = {
  children: ReactNode;
  description: string;
  eyebrow: string;
  footer?: ReactNode;
  showYandexButton?: boolean;
  title: string;
};

export function AuthShell({
  children,
  description,
  eyebrow,
  footer,
  showYandexButton = false,
  title,
}: AuthShellProps) {
  return (
    <main className={styles.page}>
      <section className={styles.formPanel} aria-labelledby="auth-title">
        <div className={styles.formContainer}>
          <Link className={styles.brand} href="/" aria-label="MPReply — на главную">
            <span>MPReply</span>
          </Link>

          <div className={styles.heading}>
            <p className="eyebrow">{eyebrow}</p>
            <h1 id="auth-title">{title}</h1>
            <p className="auth-description">{description}</p>
          </div>

          <div className={styles.content}>{children}</div>

          {showYandexButton ? (
            <div className={styles.socialSection}>
              <div className={styles.divider}><span>или</span></div>
              <button
                className={styles.yandexButton}
                disabled
                type="button"
                aria-label="Продолжить с Яндекс ID — скоро"
                title="Вход через Яндекс ID появится после подключения OAuth"
              >
                <span className={styles.yandexMark} aria-hidden="true">Я</span>
                <span>Продолжить с Яндекс ID</span>
                <span className={styles.soon}>Скоро</span>
              </button>
            </div>
          ) : null}

          {footer ? <div className={styles.footer}>{footer}</div> : null}
        </div>
      </section>

      <aside className={styles.previewPanel} aria-labelledby="auth-overview-title">
        <div className={styles.previewCopy}>
          <p className={styles.previewKicker}>Как работает MPReply</p>
          <h2 id="auth-overview-title">Автоматизация с проверкой там, где она нужна</h2>
          <p>MPReply собирает обращения покупателей, помогает подготовить ответы и передаёт сложные случаи на проверку.</p>
        </div>

        <ol className={styles.workflow}>
          <li className={styles.workflowItem}>
            <div className={styles.workflowContent}>
              <strong>Обращения в очереди</strong>
              <span>Отзывы, вопросы и поддерживаемые сообщения собраны в одном месте.</span>
            </div>
          </li>
          <li className={styles.workflowItem}>
            <div className={styles.workflowContent}>
              <strong>Подготовка ответа</strong>
              <span>ИИ помогает сформулировать ответ с учётом контекста и тона бренда.</span>
            </div>
          </li>
          <li className={styles.workflowItem}>
            <div className={styles.workflowContent}>
              <strong>Отправка по правилам</strong>
              <span>Безопасные ответы отправляются автоматически, сложные случаи остаются на проверке.</span>
            </div>
          </li>
        </ol>

        <p className={styles.marketplaceNote}>Подключайте кабинеты Wildberries, Ozon, Яндекс Маркета и Авито.</p>
      </aside>
    </main>
  );
}

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
            <span className={styles.brandMark} aria-hidden="true">M</span>
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

      <aside className={styles.previewPanel} aria-label="Превью интерфейса MPReply">
        <div className={styles.previewGlow} aria-hidden="true" />
        <div className={styles.previewCopy}>
          <span className={styles.previewKicker}>MPReply workspace</span>
          <h2>Все обращения покупателей — в одном рабочем окне</h2>
          <p>Отзывы, вопросы и AI-черновики без переключения между кабинетами маркетплейсов.</p>
        </div>

        <div className={styles.workspace} aria-hidden="true">
          <div className={styles.workspaceTopbar}>
            <div>
              <span className={styles.workspaceLabel}>Единая очередь</span>
              <strong>12 требуют внимания</strong>
            </div>
            <span className={styles.liveBadge}>Live</span>
          </div>

          <div className={styles.marketplaces}>
            <span>Wildberries</span>
            <span>Ozon</span>
            <span>Яндекс Маркет</span>
          </div>

          <div className={styles.reviewCard}>
            <div className={styles.reviewMeta}>
              <span className={styles.avatar}>АК</span>
              <div>
                <strong>Алексей К.</strong>
                <span>Wildberries · 5 ★</span>
              </div>
              <time>2 мин</time>
            </div>
            <p>Спасибо, товар пришёл быстро. Подскажите, есть ли такая модель в другом цвете?</p>
          </div>

          <div className={styles.replyCard}>
            <div className={styles.replyHeader}>
              <span className={styles.aiDot} />
              <strong>AI-черновик готов</strong>
              <span className={styles.confidence}>96%</span>
            </div>
            <p>Алексей, спасибо за отзыв. Да, модель доступна в нескольких цветах — актуальные варианты уже отображаются в карточке товара.</p>
            <div className={styles.replyActions}>
              <span>Проверено правилами</span>
              <span className={styles.sendAction}>Отправить ответ</span>
            </div>
          </div>
        </div>
      </aside>
    </main>
  );
}

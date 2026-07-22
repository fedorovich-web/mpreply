"use client";

import { useEffect, useId, useRef, useState } from "react";

import { trialOffer } from "../../lib/public-pricing";

export function PublicTrialModal() {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState("public-site");

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ source?: string }>).detail;
      setSource(detail?.source || "public-site");
      setOpen(true);
    };

    window.addEventListener("respio:trial-open", handleOpen);
    return () => window.removeEventListener("respio:trial-open", handleOpen);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);

      if (event.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), a[href]',
          ),
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="public-trial-modal" role="presentation">
      <button
        className="public-trial-modal-backdrop"
        type="button"
        aria-label="Закрыть окно бесплатного теста"
        onClick={() => setOpen(false)}
      />
      <div
        ref={dialogRef}
        className="public-trial-dialog public-trial-dialog-v94 public-trial-dialog-v95 public-trial-dialog-v96"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <button
          ref={closeButtonRef}
          className="public-trial-close"
          type="button"
          aria-label="Закрыть"
          onClick={() => setOpen(false)}
        />

        <div className="public-trial-dialog-copy public-trial-dialog-copy-v94 public-trial-dialog-copy-v95 public-trial-dialog-copy-v96">
          <p className="public-eyebrow">{trialOffer.shortLabel}</p>
          <h2 id={titleId}>Проверьте Respio в работе</h2>
          <p id={descriptionId}>
            Оставьте контакты — откроем тест и покажем, как Respio готовит автоответы
            на реальные отзывы, вопросы и чаты по карточке товара, базе знаний и правилам продавца.
          </p>
          <div className="public-trial-benefits-v96" aria-label="Что входит в бесплатный тест">
            <div><span aria-hidden="true" />{trialOffer.answerLimit} ответов на {trialOffer.durationDays} дней</div>
            <div><span aria-hidden="true" />До {trialOffer.marketplaceLimit} маркетплейсов в тесте</div>
            <div><span aria-hidden="true" />Отзывы, вопросы и чаты в одном потоке</div>
            <div><span aria-hidden="true" />Согласование включается только по выбранным правилам</div>
          </div>
        </div>

        <form className="public-trial-form public-trial-form-v94 public-trial-form-v95 public-trial-form-v96" action="/auth/register" method="get">
          <input type="hidden" name="trial" value={`${trialOffer.durationDays}-days`} />
          <input type="hidden" name="answers" value={trialOffer.answerLimit} />
          <input type="hidden" name="marketplaceLimit" value={trialOffer.marketplaceLimit} />
          <input type="hidden" name="source" value={source} />

          <div className="public-trial-form-head-v94 public-trial-form-head-v95 public-trial-form-head-v96">
            <strong>Заявка на бесплатный тест</strong>
            <span>{trialOffer.answerLimit} ответов · {trialOffer.durationDays} дней · до {trialOffer.marketplaceLimit} маркетплейсов</span>
          </div>

          <label>
            <span>Имя</span>
            <input name="name" type="text" autoComplete="name" required placeholder="Иван" />
          </label>

          <label>
            <span>Рабочая почта</span>
            <input name="email" type="email" autoComplete="email" required placeholder="name@company.ru" />
          </label>

          <label>
            <span>Телефон</span>
            <input name="phone" type="tel" autoComplete="tel" required placeholder="+7 900 000-00-00" />
          </label>

          <button className="button button-primary" type="submit">
            Начать бесплатный тест
          </button>
          <small>Платный пакет не подключается автоматически. Маркетплейсы выбираются после входа в кабинет.</small>
        </form>
      </div>
    </div>
  );
}

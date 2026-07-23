"use client";

import { useEffect, useId, useRef, useState } from "react";

import { trialOffer } from "../../lib/public-pricing";
import { PUBLIC_TRIAL_POPOVER_ID } from "./PublicTrialCta";

export function PublicTrialModal() {
  const titleId = useId();
  const descriptionId = useId();
  const modalRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const previousOverflowRef = useRef("");
  const bodyScrollLockedRef = useRef(false);
  const [source, setSource] = useState("public-site");

  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    const setSourceFromRequest = (requestedSource?: string) => {
      delete document.documentElement.dataset.mpreplyTrialSource;
      setSource(requestedSource || "public-site");
    };

    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ source?: string }>).detail;
      setSourceFromRequest(detail?.source);
      if (!modal.matches(":popover-open")) modal.showPopover();
    };

    const syncPopoverState = () => {
      const isOpen = modal.matches(":popover-open");

      if (isOpen && !bodyScrollLockedRef.current) {
        const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const requestedSource = trigger?.dataset.trialSource;
        if (requestedSource) setSourceFromRequest(requestedSource);

        previousActiveElementRef.current = trigger;
        previousOverflowRef.current = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        bodyScrollLockedRef.current = true;
        window.requestAnimationFrame(() => closeButtonRef.current?.focus());
        return;
      }

      if (!isOpen && bodyScrollLockedRef.current) {
        document.body.style.overflow = previousOverflowRef.current;
        bodyScrollLockedRef.current = false;
        previousActiveElementRef.current?.focus();
        previousActiveElementRef.current = null;
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !modal.matches(":popover-open") || !dialogRef.current) return;

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
    };

    window.addEventListener("mpreply:trial-open", handleOpen);
    window.addEventListener("keydown", handleKeyDown);
    modal.addEventListener("toggle", syncPopoverState);

    const pendingSource = document.documentElement.dataset.mpreplyTrialSource;
    if (pendingSource) {
      setSourceFromRequest(pendingSource);
      if (!modal.matches(":popover-open")) modal.showPopover();
    } else if (modal.matches(":popover-open")) {
      syncPopoverState();
    }

    return () => {
      window.removeEventListener("mpreply:trial-open", handleOpen);
      window.removeEventListener("keydown", handleKeyDown);
      modal.removeEventListener("toggle", syncPopoverState);
      if (bodyScrollLockedRef.current) document.body.style.overflow = previousOverflowRef.current;
    };
  }, []);

  return (
    <div
      ref={modalRef}
      id={PUBLIC_TRIAL_POPOVER_ID}
      className="public-trial-modal"
      popover="auto"
    >
      <div className="public-trial-modal-layout">
        <button
          className="public-trial-modal-backdrop"
          type="button"
          aria-label="Закрыть окно бесплатного теста"
          popoverTarget={PUBLIC_TRIAL_POPOVER_ID}
          popoverTargetAction="hide"
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
            popoverTarget={PUBLIC_TRIAL_POPOVER_ID}
            popoverTargetAction="hide"
          />

          <div className="public-trial-dialog-copy public-trial-dialog-copy-v94 public-trial-dialog-copy-v95 public-trial-dialog-copy-v96">
            <p className="public-eyebrow">{trialOffer.shortLabel}</p>
            <h2 id={titleId}>Проверьте автоответы на своих обращениях</h2>
            <p id={descriptionId}>
              Оставьте контакты — откроем тест и покажем, как система готовит автоответы
              на реальные отзывы, вопросы и чаты по карточке товара, базе знаний и правилам продавца.
            </p>
            <div
              className="public-trial-benefits-v96"
              role="list"
              aria-label="Что входит в бесплатный тест"
            >
              <div role="listitem">
                <span aria-hidden="true" />
                {trialOffer.answerLimit} ответов на {trialOffer.durationDays} дней
              </div>
              <div role="listitem">
                <span aria-hidden="true" />
                До {trialOffer.marketplaceLimit} маркетплейсов в тесте
              </div>
              <div role="listitem">
                <span aria-hidden="true" />
                Отзывы, вопросы и чаты в одном потоке
              </div>
              <div role="listitem">
                <span aria-hidden="true" />
                Согласование включается только по выбранным правилам
              </div>
            </div>
          </div>

          <form
            className="public-trial-form public-trial-form-v94 public-trial-form-v95 public-trial-form-v96"
            action="/auth/register"
            method="get"
          >
            <input type="hidden" name="trial" value={`${trialOffer.durationDays}-days`} />
            <input type="hidden" name="answers" value={trialOffer.answerLimit} />
            <input
              type="hidden"
              name="marketplaceLimit"
              value={trialOffer.marketplaceLimit}
            />
            <input type="hidden" name="source" value={source} />

            <div className="public-trial-form-head-v94 public-trial-form-head-v95 public-trial-form-head-v96">
              <strong>Заявка на бесплатный тест</strong>
              <span>
                {trialOffer.answerLimit} ответов · {trialOffer.durationDays} дней · до{" "}
                {trialOffer.marketplaceLimit} маркетплейсов
              </span>
            </div>

            <label>
              <span>Имя</span>
              <input
                name="name"
                type="text"
                autoComplete="name"
                required
                placeholder="Иван"
              />
            </label>

            <label>
              <span>Рабочая почта</span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="name@company.ru"
              />
            </label>

            <label>
              <span>Телефон</span>
              <input
                name="phone"
                type="tel"
                autoComplete="tel"
                required
                placeholder="+7 900 000-00-00"
              />
            </label>

            <button className="button button-primary" type="submit">
              Начать бесплатный тест
            </button>
            <small>
              Платный пакет не подключается автоматически. Маркетплейсы выбираются после входа
              в кабинет.
            </small>
          </form>
        </div>
      </div>
    </div>
  );
}

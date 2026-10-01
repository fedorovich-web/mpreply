"use client";

import { useId, useMemo, useState } from "react";
import type { CSSProperties } from "react";

import { estimateAddOnPurchase, estimateMonthlyPrice, replyPacks } from "../../lib/pricing-calculator";
import type { Locale } from "../../lib/i18n";
import { useClientReady } from "../../lib/use-client-ready";

const planNames = {
  ru: { start: "Старт", team: "Команда", business: "Бизнес" },
  en: { start: "Start", team: "Team", business: "Business" },
} as const;

function money(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

function number(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US").format(value);
}

function boundedNumber(value: string, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return value.trim() && Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

const maxComparisonReplies = 3000;

function rangePosition(amount: number, maximum = 20000) {
  return Math.round(Math.log(amount / 50) / Math.log(maximum / 50) * 1000);
}

function rangeAmount(position: number, maximum = 20000) {
  return Math.min(maximum, Math.max(50, Math.round((50 * (maximum / 50) ** (position / 1000)) / 50) * 50));
}

export function PricingCalculators({ locale = "ru" }: { locale?: Locale }) {
  const ready = useClientReady();
  const [packAmountInput, setPackAmountInput] = useState("100");
  const [monthlyRepliesInput, setMonthlyRepliesInput] = useState("1000");
  const [salaryInput, setSalaryInput] = useState("50000");
  const [workHoursInput, setWorkHoursInput] = useState("160");
  const [manualMinutesInput, setManualMinutesInput] = useState("3");
  const [reviewShareInput, setReviewShareInput] = useState("100");
  const [reviewMinutesInput, setReviewMinutesInput] = useState("1");
  const packRangeId = useId();
  const volumeId = useId();
  const salaryId = useId();
  const workHoursId = useId();
  const manualMinutesId = useId();
  const reviewShareId = useId();
  const reviewMinutesId = useId();
  const packAmount = Math.ceil(boundedNumber(packAmountInput, 100, 50, 20000) / 50) * 50;
  const monthlyReplies = Math.ceil(boundedNumber(monthlyRepliesInput, 1000, 50, maxComparisonReplies) / 50) * 50;
  const packPurchase = useMemo(() => estimateAddOnPurchase(packAmount), [packAmount]);
  const estimate = useMemo(() => estimateMonthlyPrice(monthlyReplies), [monthlyReplies]);
  const selectedPack = replyPacks.find((pack) => pack.replies === packAmount);
  const salary = boundedNumber(salaryInput, 50000, 50000, 1000000);
  const workHours = boundedNumber(workHoursInput, 160, 1, 744);
  const manualMinutes = boundedNumber(manualMinutesInput, 3, 0.1, 120);
  const reviewShare = boundedNumber(reviewShareInput, 100, 0, 100);
  const reviewMinutes = boundedNumber(reviewMinutesInput, 1, 0, 120);
  const manualHours = monthlyReplies * manualMinutes / 60;
  const reviewHours = monthlyReplies * reviewShare / 100 * reviewMinutes / 60;
  const manualLaborRub = salary;
  const assistedRub = estimate.totalRub;
  const differenceRub = manualLaborRub - assistedRub;
  const isRu = locale === "ru";
  const packSummary = packPurchase.packs.map((item) => number(item.replies, locale)).join(" + ");

  return (
    <div className="pricing-calculators">
      <section className="pricing-calculator-section" aria-labelledby="pricing-pack-calculator-title">
        <div className="public-container">
          <div className="pricing-calculator-heading">

            <h2 id="pricing-pack-calculator-title">{isRu ? "Подберите дополнительные ответы" : "Choose extra replies"}</h2>
            <p>{isRu
              ? "Выберите нужное количество с шагом 50. Калькулятор подберёт сочетание пакетов к вашему тарифу; неиспользованные ответы останутся на балансе."
              : "Enter the amount you need in steps of 50. The calculator combines add-on packs for your plan; unused replies remain in your balance."}</p>
          </div>
          <div className="pricing-pack-selector">
            <div className="pricing-pack-intro">
              <label htmlFor={packRangeId}>{isRu ? "Сколько ответов хотите добавить?" : "How many replies do you want to add?"}</label>
              <div className="pricing-pack-exact">
                <input disabled={!ready}
                  aria-label={isRu ? "Точное количество дополнительных ответов" : "Exact number of extra replies"}
                  inputMode="numeric"
                  max={20000}
                  min={50}
                  onBlur={() => setPackAmountInput(String(packAmount))}
                  onChange={(event) => setPackAmountInput(event.target.value)}
                  step={50}
                  type="number"
                  value={packAmountInput}
                />
                <span>{isRu ? "ответов" : "replies"}</span>
              </div>
            </div>
            <div className="pricing-pack-options" role="group" aria-label={isRu ? "Быстрый выбор количества" : "Quick quantity selection"}>
              {replyPacks.map((option) => (
                <button disabled={!ready}
                  aria-pressed={packAmount === option.replies}
                  className={packAmount === option.replies ? "is-selected" : undefined}
                  key={option.code}
                  onClick={() => setPackAmountInput(String(option.replies))}
                  type="button"
                >
                  {number(option.replies, locale)}
                </button>
              ))}
            </div>
            <input disabled={!ready}
              aria-valuetext={`${number(packAmount, locale)} ${isRu ? "ответов" : "replies"}`}
              id={packRangeId}
              max={1000}
              min={0}
              onChange={(event) => setPackAmountInput(String(rangeAmount(Number(event.target.value))))}
              step={1}
              style={{ "--range-progress": `${rangePosition(packAmount) / 10}%` } as CSSProperties}
              type="range"
              value={rangePosition(packAmount)}
            />
            <div className="pricing-range-ends"><span>50</span><span>20 000</span></div>
            <div className="pricing-pack-result" aria-live="polite">
              <div>
                <span>{isRu ? "Вы получите" : "You receive"}</span>
                <strong>{number(packPurchase.replies, locale)} {isRu ? "ответов" : "replies"}</strong>
              </div>
              <div>
                <span>{isRu ? "Стоимость" : "Price"}</span>
                <strong>{money(packPurchase.costRub, locale)}</strong>
              </div>
              <div>
                <span>{isRu ? "Цена одного ответа" : "Per reply"}</span>
                <strong>{new Intl.NumberFormat(isRu ? "ru-RU" : "en-US", { maximumFractionDigits: 2 }).format(packPurchase.costRub / packPurchase.replies)} ₽</strong>
              </div>
            </div>
            <p className="pricing-pack-composition">{selectedPack && packPurchase.packs.length === 1
              ? (isRu ? "Один пакет без дробления" : "One pack")
              : `${isRu ? "Пакеты в расчёте" : "Packs in estimate"}: ${packSummary}`}
              {packPurchase.replies > packAmount ? ` · ${isRu ? "неиспользованные" : "unused"} ${number(packPurchase.replies - packAmount, locale)} ${isRu ? "ответов сохранятся" : "replies carry over"}` : ""}</p>
            <p className="pricing-calculator-note">{isRu
              ? "Покупка станет доступна после подключения оплаты на рабочем домене. Пока это расчёт, а не заказ."
              : "Purchases will open after payment is connected on the production domain. This is an estimate, not an order."}</p>
          </div>
        </div>
      </section>

      <section className="pricing-calculator-section pricing-benefit-section" aria-labelledby="pricing-benefit-title">
        <div className="public-container">
          <div className="pricing-calculator-heading">

            <h2 id="pricing-benefit-title">{isRu ? "Сравните ручную работу и MPReply" : "Compare manual work and MPReply"}</h2>
            <p>{isRu
              ? "Выберите количество ответов в месяц. Зарплату и время работы можно настроить под вашу команду."
              : "Choose your monthly reply volume. You can adjust salary and work time for your team."}</p>
          </div>
          <div className="pricing-benefit-controls">
            <div className="pricing-volume-heading">
              <label htmlFor={volumeId}>{isRu ? "Ответов в месяц" : "Replies per month"}</label>
              <input disabled={!ready}
                aria-label={isRu ? "Точное количество ответов в месяц" : "Exact number of replies per month"}
                inputMode="numeric"
                max={maxComparisonReplies}
                min={50}
                onBlur={() => setMonthlyRepliesInput(String(monthlyReplies))}
                onChange={(event) => setMonthlyRepliesInput(event.target.value)}
                step={50}
                type="number"
                value={monthlyRepliesInput}
              />
            </div>
            <div className="pricing-volume-presets" role="group" aria-label={isRu ? "Быстрый выбор объёма" : "Quick volume selection"}>
              {[300, 500, 800, 1000, 1600, 3000].map((amount) => (
                <button disabled={!ready} aria-pressed={monthlyReplies === amount} className={monthlyReplies === amount ? "is-selected" : undefined} key={amount} onClick={() => setMonthlyRepliesInput(String(amount))} type="button">{number(amount, locale)}</button>
              ))}
            </div>
            <input disabled={!ready} aria-valuetext={`${number(monthlyReplies, locale)} ${isRu ? "ответов" : "replies"}`} id={volumeId} max={1000} min={0} onChange={(event) => setMonthlyRepliesInput(String(rangeAmount(Number(event.target.value), maxComparisonReplies)))} step={1} style={{ "--range-progress": `${rangePosition(monthlyReplies, maxComparisonReplies) / 10}%` } as CSSProperties} type="range" value={rangePosition(monthlyReplies, maxComparisonReplies)} />
            <div className="pricing-range-ends"><span>50</span><span>{number(maxComparisonReplies, locale)}</span></div>
          </div>
          <div className="pricing-benefit-results" aria-live="polite">
            <div>
              <span>{isRu ? "Менеджер · ручная подготовка" : "Manager · manual preparation"}</span>
              <strong>{money(manualLaborRub, locale)}</strong>
              <p>{number(Math.round(manualHours * 10) / 10, locale)} {isRu ? "ч работы" : "work hours"} · {money(manualLaborRub / monthlyReplies, locale)} {isRu ? "за ответ" : "per reply"}</p>
            </div>
            <div>
              <span>{isRu ? "MPReply · тариф и пакеты" : "MPReply · plan and packs"}</span>
              <strong>{money(assistedRub, locale)}</strong>
              <p>{planNames[locale][estimate.plan.code]} {money(estimate.plan.priceRub, locale)}{estimate.addOns.packs.length ? ` + ${isRu ? "пакеты" : "packs"} ${money(estimate.addOns.costRub, locale)}` : ""} · {number(Math.round(reviewHours * 10) / 10, locale)} {isRu ? "ч проверки отдельно" : "review hours separately"}</p>
            </div>
            <div className="pricing-benefit-difference">
              <span>{differenceRub >= 0 ? (isRu ? "Разница между зарплатой и тарифом" : "Difference between salary and plan") : (isRu ? "Тариф дороже зарплаты" : "Plan costs more than salary")}</span>
              <strong>{money(Math.abs(differenceRub), locale)}</strong>
              <p>{isRu ? "В месяц при выбранном объёме" : "Per month at the selected volume"}</p>
            </div>
          </div>
          <details className="pricing-benefit-assumptions">
            <summary>{isRu ? "Настроить зарплату и время работы" : "Adjust salary and work time"}</summary>
            <div className="pricing-benefit-fields">
              <div><label htmlFor={salaryId}>{isRu ? "Зарплата одного менеджера, ₽/мес (от 50 000)" : "One manager's salary, ₽/mo (from 50,000)"}</label><input disabled={!ready} id={salaryId} min={50000} max={1000000} onBlur={() => setSalaryInput(String(salary))} onChange={(event) => setSalaryInput(event.target.value)} type="number" value={salaryInput} /></div>
              <div><label htmlFor={workHoursId}>{isRu ? "Рабочих часов в месяц" : "Work hours per month"}</label><input disabled={!ready} id={workHoursId} min={1} max={744} onBlur={() => setWorkHoursInput(String(workHours))} onChange={(event) => setWorkHoursInput(event.target.value)} type="number" value={workHoursInput} /></div>
              <div><label htmlFor={manualMinutesId}>{isRu ? "Минут на ответ вручную" : "Minutes per manual reply"}</label><input disabled={!ready} id={manualMinutesId} min={0.1} max={120} onBlur={() => setManualMinutesInput(String(manualMinutes))} onChange={(event) => setManualMinutesInput(event.target.value)} step={0.5} type="number" value={manualMinutesInput} /></div>
              <div><label htmlFor={reviewShareId}>{isRu ? "Ответов на проверку, %" : "Replies reviewed, %"}</label><input disabled={!ready} id={reviewShareId} min={0} max={100} onBlur={() => setReviewShareInput(String(reviewShare))} onChange={(event) => setReviewShareInput(event.target.value)} type="number" value={reviewShareInput} /></div>
              <div><label htmlFor={reviewMinutesId}>{isRu ? "Минут на проверку" : "Minutes per review"}</label><input disabled={!ready} id={reviewMinutesId} min={0} max={120} onBlur={() => setReviewMinutesInput(String(reviewMinutes))} onChange={(event) => setReviewMinutesInput(event.target.value)} step={0.5} type="number" value={reviewMinutesInput} /></div>
            </div>
          </details>
          <details className="pricing-calculation-method">
            <summary>{isRu ? "Как рассчитана разница" : "How the difference is calculated"}</summary>
            <p className="pricing-calculator-note">{isRu
              ? `${number(monthlyReplies, locale)} ответов × ${number(manualMinutes, locale)} мин = ${number(Math.round(manualHours * 10) / 10, locale)} ч из ${number(workHours, locale)} рабочих часов в месяц. Зарплата менеджера — ${money(salary, locale)} — не зависит от количества ответов. MPReply: стоимость тарифа и дополнительных ответов. Проверка ответов займёт ${number(Math.round(reviewHours * 10) / 10, locale)} ч. Если менеджер остаётся в штате, его зарплата продолжает выплачиваться; показанная разница сравнивает зарплату и стоимость сервиса.`
              : `${number(monthlyReplies, locale)} replies × ${number(manualMinutes, locale)} min = ${number(Math.round(manualHours * 10) / 10, locale)} hours out of ${number(workHours, locale)} monthly work hours. The manager's salary of ${money(salary, locale)} stays the same at every reply volume. MPReply includes the plan and extra replies. Reviewing replies takes ${number(Math.round(reviewHours * 10) / 10, locale)} hours. If the manager stays employed, their salary is still paid; the displayed difference compares salary and service cost.`}</p>
          </details>
        </div>
      </section>
    </div>
  );
}

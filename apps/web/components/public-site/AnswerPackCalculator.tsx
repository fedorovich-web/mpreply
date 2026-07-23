"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";

import { publicPricingPlans } from "../../lib/public-pricing";

const numberFormatter = new Intl.NumberFormat("ru-RU");

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function rangeProgress(value: number, min: number, max: number): CSSProperties {
  const percentage = ((value - min) / (max - min)) * 100;
  return { "--range-progress": `${percentage}%` } as CSSProperties;
}

export function AnswerPackCalculator() {
  const [monthlyAnswers, setMonthlyAnswers] = useState(1000);
  const [reserveMonths, setReserveMonths] = useState(3);

  const result = useMemo(() => {
    const requiredAnswers = monthlyAnswers * reserveMonths;
    const recommendedPlan = publicPricingPlans.find(
      (plan) => plan.answersValue >= requiredAnswers,
    );

    if (!recommendedPlan) {
      return { requiredAnswers, recommendedPlan: null, coverageMonths: null, reserve: null };
    }

    return {
      requiredAnswers,
      recommendedPlan,
      coverageMonths: Math.max(1, Math.floor(recommendedPlan.answersValue / monthlyAnswers)),
      reserve: recommendedPlan.answersValue - requiredAnswers,
    };
  }, [monthlyAnswers, reserveMonths]);

  return (
    <section className="answer-pack-calculator-v79 answer-pack-calculator-v86 answer-pack-calculator-v87 answer-pack-calculator-v88 answer-pack-calculator-v89 answer-pack-calculator-v90" aria-labelledby="answer-pack-calculator-title">
      <div className="answer-pack-calculator-copy-v79 answer-pack-calculator-copy-v86 answer-pack-calculator-copy-v87 answer-pack-calculator-copy-v88 answer-pack-calculator-copy-v89 answer-pack-calculator-copy-v90">
        <p className="public-eyebrow">Калькулятор объёма</p>
        <h2 id="answer-pack-calculator-title">Подберите пакет под поток обращений</h2>
        <p>
          Укажите среднее число отзывов, вопросов и чатов в месяц — калькулятор рассчитает нужный объём ответов, рекомендуемый пакет и запас баланса.
        </p>
      </div>

      <div className="answer-pack-calculator-grid-v79 answer-pack-calculator-grid-v86 answer-pack-calculator-grid-v87 answer-pack-calculator-grid-v88 answer-pack-calculator-grid-v89 answer-pack-calculator-grid-v90">
        <div className="answer-pack-calculator-controls-v79 answer-pack-calculator-controls-v86 answer-pack-calculator-controls-v87 answer-pack-calculator-controls-v88 answer-pack-calculator-controls-v89 answer-pack-calculator-controls-v90">
          <div className="answer-pack-control-intro-v86 answer-pack-control-intro-v87 answer-pack-control-intro-v88 answer-pack-control-intro-v89 answer-pack-control-intro-v90">
            <span>Быстрый расчёт</span>
            <p>Два значения показывают, какой пакет закроет ваш поток обращений без ежемесячной подписки.</p>
          </div>

          <div className="answer-pack-field-v79 answer-pack-field-v86 answer-pack-field-v87 answer-pack-field-v88 answer-pack-field-v89 answer-pack-field-v90">
            <div className="answer-pack-field-heading-v86 answer-pack-field-heading-v87 answer-pack-field-heading-v88 answer-pack-field-heading-v89 answer-pack-field-heading-v90">
              <label htmlFor="monthly-answers">Обращений в месяц</label>
              <output htmlFor="monthly-answers">{numberFormatter.format(monthlyAnswers)}</output>
            </div>
            <p>Средний поток отзывов, вопросов и чатов по подключённым кабинетам.</p>
            <input
              id="monthly-answers"
              type="range"
              min="100"
              max="5000"
              step="100"
              value={monthlyAnswers}
              style={rangeProgress(monthlyAnswers, 100, 5000)}
              onChange={(event) => setMonthlyAnswers(clampNumber(Number(event.target.value), 100, 5000))}
            />
            <small><span>100</span><span>5 000</span></small>
          </div>

          <div className="answer-pack-field-v79 answer-pack-field-v86 answer-pack-field-v87 answer-pack-field-v88 answer-pack-field-v89 answer-pack-field-v90">
            <div className="answer-pack-field-heading-v86 answer-pack-field-heading-v87 answer-pack-field-heading-v88 answer-pack-field-heading-v89 answer-pack-field-heading-v90">
              <label htmlFor="reserve-months">Запас на период</label>
              <output htmlFor="reserve-months">{reserveMonths} мес.</output>
            </div>
            <p>Период, на который нужен запас ответов без пополнения баланса.</p>
            <input
              id="reserve-months"
              type="range"
              min="1"
              max="12"
              step="1"
              value={reserveMonths}
              style={rangeProgress(reserveMonths, 1, 12)}
              onChange={(event) => setReserveMonths(clampNumber(Number(event.target.value), 1, 12))}
            />
            <small><span>1 месяц</span><span>12 месяцев</span></small>
          </div>
        </div>

        <aside className="answer-pack-calculator-result-v79 answer-pack-calculator-result-v86 answer-pack-calculator-result-v87 answer-pack-calculator-result-v88 answer-pack-calculator-result-v89 answer-pack-calculator-result-v90" aria-live="polite">
          <div className="answer-pack-result-header-v86 answer-pack-result-header-v87 answer-pack-result-header-v88 answer-pack-result-header-v89 answer-pack-result-header-v90">
            <p className="answer-pack-result-label-v79 answer-pack-result-label-v86 answer-pack-result-label-v87 answer-pack-result-label-v88 answer-pack-result-label-v89 answer-pack-result-label-v90">Нужно ответов</p>
            <strong className="answer-pack-result-volume-v79 answer-pack-result-volume-v86 answer-pack-result-volume-v87 answer-pack-result-volume-v88 answer-pack-result-volume-v89 answer-pack-result-volume-v90">
              {numberFormatter.format(result.requiredAnswers)} ответов
            </strong>
            <span>Списываются только опубликованные или отправленные ответы</span>
          </div>

          {result.recommendedPlan ? (
            <>
              <div className="answer-pack-result-plan-v79 answer-pack-result-plan-v86 answer-pack-result-plan-v87 answer-pack-result-plan-v88 answer-pack-result-plan-v89 answer-pack-result-plan-v90">
                <span>Рекомендуемый пакет</span>
                <b>{result.recommendedPlan.name} · {result.recommendedPlan.answers}</b>
              </div>
              <dl className="answer-pack-result-metrics-v79 answer-pack-result-metrics-v86 answer-pack-result-metrics-v87 answer-pack-result-metrics-v88 answer-pack-result-metrics-v89 answer-pack-result-metrics-v90">
                <div><dt>Стоимость</dt><dd>{result.recommendedPlan.price} ₽</dd></div>
                <div><dt>Цена ответа</dt><dd>{result.recommendedPlan.pricePerAnswer.replace(" за ответ", "")}</dd></div>
                <div><dt>Примерный запас</dt><dd>{result.coverageMonths} мес.</dd></div>
                <div><dt>Остаток</dt><dd>{numberFormatter.format(result.reserve ?? 0)}</dd></div>
              </dl>
              <div className="answer-pack-result-action-shell-v86 answer-pack-result-action-shell-v87 answer-pack-result-action-shell-v88 answer-pack-result-action-shell-v89 answer-pack-result-action-shell-v90">
                <Link className="button button-primary answer-pack-result-action-v79 answer-pack-result-action-v86 answer-pack-result-action-v87 answer-pack-result-action-v88 answer-pack-result-action-v89 answer-pack-result-action-v90" href={`/contacts?package=${result.recommendedPlan.key}`}>
                  Выбрать рекомендованный пакет
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="answer-pack-result-plan-v79 answer-pack-result-plan-v86 answer-pack-result-plan-v87 answer-pack-result-plan-v88 answer-pack-result-plan-v89 answer-pack-result-plan-v90">
                <span>Нужен больший объём</span>
                <b>Более 15 000 ответов</b>
              </div>
              <p className="answer-pack-result-note-v79 answer-pack-result-note-v86 answer-pack-result-note-v87 answer-pack-result-note-v88 answer-pack-result-note-v89 answer-pack-result-note-v90">Подберём пакет под число магазинов, сезонные пики и ежедневный поток обращений.</p>
              <div className="answer-pack-result-action-shell-v86 answer-pack-result-action-shell-v87 answer-pack-result-action-shell-v88 answer-pack-result-action-shell-v89 answer-pack-result-action-shell-v90">
                <Link className="button button-primary answer-pack-result-action-v79 answer-pack-result-action-v86 answer-pack-result-action-v87 answer-pack-result-action-v88 answer-pack-result-action-v89 answer-pack-result-action-v90" href="/contacts?package=custom">
                  Рассчитать индивидуальный пакет
                </Link>
              </div>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}

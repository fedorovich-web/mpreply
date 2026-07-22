"use client";

import { useId, useState } from "react";
import styles from "./ReviewResolutionWorkspace.module.css";

type ScenarioKey = "positive" | "neutral" | "negative";
type RiskTone = "low" | "medium" | "high";

type Scenario = {
  key: ScenarioKey;
  tab: string;
  marketplace: string;
  author: string;
  stars: string;
  review: string;
  product: string;
  productMeta: string;
  problem: string;
  sentiment: string;
  risk: string;
  riskTone: RiskTone;
  action: string;
  facts: readonly string[];
  resolutionTitle: string;
  resolutionState: string;
  response: string;
  resolutionActions: readonly string[];
  publishState: string;
  auditNote: string;
};

const SCENARIOS: readonly Scenario[] = [
  {
    key: "positive",
    tab: "Положительный",
    marketplace: "Wildberries",
    author: "Елена · заказ #9214",
    stars: "★★★★★",
    review:
      "Подошли идеально, тяга у пылесоса стала заметно лучше. Закажу ещё комплект родителям.",
    product: "Фильтр HEPA Pro · 2 шт.",
    productMeta: "Повторная покупка · совместимость проверена",
    problem: "Покупатель доволен и готов повторить заказ",
    sentiment: "Положительный отзыв",
    risk: "Низкий риск",
    riskTone: "low",
    action: "Опубликовать ответ автоматически",
    facts: [
      "Повторная покупка подтверждена",
      "Товар подошёл к указанной модели",
      "Ответ соответствует правилам продавца",
    ],
    resolutionTitle: "Готовый ответ без ручной правки",
    resolutionState: "Автоматически",
    response:
      "Здравствуйте, Елена. Спасибо за подробный отзыв. Рады, что фильтры подошли и тяга пылесоса стала лучше. Будем рады видеть вас снова.",
    resolutionActions: [
      "Поблагодарить за отзыв",
      "Учесть повторную покупку",
      "Не обещать лишнего",
      "Опубликовать по правилам",
    ],
    publishState: "Опубликовано автоматически",
    auditNote: "Статус сохранён в журнале",
  },
  {
    key: "neutral",
    tab: "Нейтральный",
    marketplace: "Ozon",
    author: "Марина · заказ #7448",
    stars: "★★★★☆",
    review:
      "Фильтры подошли, но упаковка была помята. На работе товара это не повлияло.",
    product: "Фильтр HEPA Pro · 2 шт.",
    productMeta: "Упаковка помята · товар работает",
    problem: "Есть замечание, но товар работает",
    sentiment: "Нейтральный отзыв",
    risk: "Средний риск",
    riskTone: "medium",
    action: "Опубликовать автоматически по правилу",
    facts: [
      "Покупатель подтверждает работу товара",
      "Есть замечание к упаковке",
      "Ответ не обещает компенсацию",
    ],
    resolutionTitle: "Аккуратный ответ по замечанию",
    resolutionState: "Автопубликация по правилу",
    response:
      "Здравствуйте, Марина. Спасибо за отзыв и сигнал по упаковке. Рады, что фильтры подошли и работают корректно. Мы учтём замечание при дальнейшей обработке заказов.",
    resolutionActions: [
      "Поблагодарить",
      "Не спорить с замечанием",
      "Подтвердить работу товара",
      "Соблюсти правила ответа",
    ],
    publishState: "Готово к автопубликации",
    auditNote: "Сценарий сохранён в журнале",
  },
  {
    key: "negative",
    tab: "Негативный",
    marketplace: "Wildberries",
    author: "Анна · заказ #8841",
    stars: "★☆☆☆☆",
    review:
      "Фильтр не подошёл к X-240. В карточке написано, что совместим. Деньги потрачены зря.",
    product: "Фильтр HEPA Pro · 2 шт.",
    productMeta: "Негативный отзыв · включён сценарий согласования",
    problem: "Покупатель сообщает о несовместимости",
    sentiment: "Негативный отзыв",
    risk: "Высокий риск",
    riskTone: "high",
    action: "Подготовить ответ по правилам продавца",
    facts: [
      "Покупатель пишет о несовместимости",
      "Сценарий зависит от правил продавца",
      "Решение зависит от настроек продавца",
    ],
    resolutionTitle: "Ответ с запросом данных",
    resolutionState: "Согласование по настройке",
    response:
      "Здравствуйте, Анна. Спасибо, что сообщили о проблеме. Пожалуйста, напишите в чат модель устройства и фото крепления — мы проверим совместимость по карточке и правилам продавца.",
    resolutionActions: [
      "Запросить данные",
      "Проверить карточку",
      "Не обещать решение без правила",
      "Выполнить выбранный сценарий",
    ],
    publishState: "Готово по сценарию продавца",
    auditNote: "Статус сохранён в журнале",
  },
] as const;

function getScenario(key: ScenarioKey): Scenario {
  return SCENARIOS.find((scenario) => scenario.key === key) ?? SCENARIOS[0];
}

export function ReviewResolutionWorkspace() {
  const [activeKey, setActiveKey] = useState<ScenarioKey>("positive");
  const active = getScenario(activeKey);
  const baseId = useId();

  return (
    <section className={styles.workspace} aria-label="Сценарий обработки отзыва">
      <div className={styles.toolbar}>
        <div className={styles.tabs} role="tablist" aria-label="Сценарии обработки отзывов">
          {SCENARIOS.map((scenario) => {
            const selected = scenario.key === activeKey;
            return (
              <button
                key={scenario.key}
                id={`${baseId}-${scenario.key}-tab`}
                className={styles.tab}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${baseId}-${scenario.key}-panel`}
                tabIndex={selected ? 0 : -1}
                data-active={selected ? "true" : "false"}
                onClick={() => setActiveKey(scenario.key)}
              >
                {scenario.tab}
              </button>
            );
          })}
        </div>
      </div>

      <div
        id={`${baseId}-${active.key}-panel`}
        className={styles.grid}
        role="tabpanel"
        aria-labelledby={`${baseId}-${active.key}-tab`}
      >
        <div className={styles.reviewCard}>
          <div className={styles.reviewHead}>
            <div className={styles.market}>
              <span className={styles.marketLogo}>WB</span>
              <div>
                <strong>{active.marketplace}</strong>
                <small>{active.author}</small>
              </div>
            </div>
            <span className={styles.stars} role="img" aria-label="Оценка отзыва">{active.stars}</span>
          </div>

          <blockquote>{active.review}</blockquote>

          <div className={styles.product}>
            <strong>{active.product}</strong>
            <span>{active.productMeta}</span>
          </div>

          <div className={styles.reviewSignals} role="list" aria-label="Краткая сводка обращения">
            <div role="listitem">
              <span>Тип</span>
              <strong>{active.sentiment}</strong>
            </div>
            <div role="listitem">
              <span>Следующий шаг</span>
              <strong>{active.action}</strong>
            </div>
            <div role="listitem">
              <span>Контекст</span>
              <strong>{active.productMeta}</strong>
            </div>
          </div>
        </div>

        <div className={styles.analysisCard}>
          <p className={styles.kicker}>01 · Диагностика и проверка</p>
          <h3>Что определил Respio</h3>

          <div className={styles.analysisGrid}>
            <div className={styles.analysisRow}>
              <span>Ситуация</span>
              <strong>{active.problem}</strong>
            </div>
            <div className={styles.analysisRow}>
              <span>Тон</span>
              <strong>{active.sentiment}</strong>
            </div>
            <div className={styles.analysisRow}>
              <span>Риск</span>
              <strong className={styles[active.riskTone]}>{active.risk}</strong>
            </div>
            <div className={styles.analysisRow}>
              <span>Автоматизация</span>
              <strong>{active.action}</strong>
            </div>
          </div>

          <div className={styles.facts}>
            {active.facts.map((fact) => (
              <div className={styles.fact} key={fact}>
                <span aria-hidden="true">✓</span>
                <p>{fact}</p>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.resolutionCard}>
          <div className={styles.resolutionHead}>
            <div>
              <p className={styles.kicker}>02 · Персональный ответ и решение</p>
              <h3>{active.resolutionTitle}</h3>
            </div>
            <span className={styles.resolutionState}>{active.resolutionState}</span>
          </div>

          <div className={styles.response}>{active.response}</div>

          <div className={styles.actions}>
            {active.resolutionActions.map((action) => (
              <div className={styles.action} key={action}>
                <span aria-hidden="true">✓</span>
                <p>{action}</p>
              </div>
            ))}
          </div>

          <div className={styles.resolutionFooter}>
            <strong>{active.publishState}</strong>
            {active.auditNote ? <small>{active.auditNote}</small> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

const ruleCards = [
  {
    name: "Balanced auto",
    mode: "Автоматически",
    status: "Включено",
    description: "Базовое правило для отзывов и вопросов без повышенного риска.",
    conditions: ["Все типы обращений", "Контекст товара обязателен", "Confidence ≥ 0.80"],
  },
  {
    name: "Негативные отзывы",
    mode: "Полуавтоматически",
    status: "Включено",
    description: "Отзывы с оценкой 1–3 звезды отправляются на проверку менеджеру.",
    conditions: ["Только отзывы", "Рейтинг 1–3", "Приоритет 500"],
  },
  {
    name: "Чувствительные темы",
    mode: "Ручная проверка",
    status: "Защита",
    description: "Медицинские, юридические и иные рискованные формулировки не уходят автоматически.",
    conditions: ["SafetyGate", "Рискованные обещания", "PII / policy flags"],
  },
];

const precedence = [
  "Режим организации: auto по умолчанию",
  "Переопределение для конкретного кабинета маркетплейса",
  "Совпавшее правило с наивысшим приоритетом",
  "Проверка контекста товара и confidence threshold",
  "SafetyGate перед автоотправкой",
];

export function AutomationRulesWorkspace() {
  return (
    <div className="automation-workspace">
      <section className="automation-rule-grid" aria-label="Правила автоматизации">
        {ruleCards.map((rule) => (
          <article className="automation-rule-card" key={rule.name}>
            <div className="automation-rule-card-head">
              <div>
                <span className="automation-rule-status">{rule.status}</span>
                <h2>{rule.name}</h2>
              </div>
              <span className="status-badge">{rule.mode}</span>
            </div>
            <p>{rule.description}</p>
            <ul className="automation-condition-list">
              {rule.conditions.map((condition) => (
                <li key={condition}>{condition}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="automation-detail-grid">
        <article className="ai-panel">
          <p className="eyebrow">Приоритет решений</p>
          <h2>Как Respio выбирает режим ответа</h2>
          <ol className="automation-precedence-list">
            {precedence.map((item, index) => (
              <li key={item}>
                <span aria-hidden="true">{index + 1}</span>
                <p>{item}</p>
              </li>
            ))}
          </ol>
        </article>

        <article className="ai-panel automation-safety-card">
          <p className="eyebrow">SafetyGate</p>
          <h2>Автоответ не отправляется вслепую</h2>
          <p>
            После генерации черновик проходит детерминированную проверку. Низкая уверенность,
            отсутствие товарного контекста, рискованные обещания и чувствительные утверждения
            переводят обращение на ручную проверку или блокируют автоотправку.
          </p>
          <div className="automation-decision-row" aria-label="Решения SafetyGate">
            <span className="automation-decision automation-decision-allow">Allow</span>
            <span className="automation-decision automation-decision-review">Manual review</span>
            <span className="automation-decision automation-decision-block">Block</span>
          </div>
        </article>
      </section>
    </div>
  );
}

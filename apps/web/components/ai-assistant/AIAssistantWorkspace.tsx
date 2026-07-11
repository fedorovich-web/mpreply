import { Badge } from "../ui/Badge";

const promptLayers = [
  "System prompt: правила безопасности и тон Respio",
  "Marketplace context: WB / Ozon / Яндекс Маркет / Авито",
  "Message context: отзыв или вопрос, рейтинг, текст покупателя",
  "Product context: название, SKU, бренд, категория, карточка товара",
  "Brand rules + Knowledge Base: будущий слой Sprint 6+",
  "Output contract: JSON с answer, confidence_score, safety_flags",
];

const usageMetrics = [
  { label: "Provider", value: "OpenRouter" },
  { label: "Default model", value: "openai/gpt-5.2" },
  { label: "Fallback", value: "anthropic/claude-sonnet-4.6" },
  { label: "Prompt version", value: "marketplace-reply-v1" },
];

export function AIAssistantWorkspace() {
  return (
    <section className="ai-workspace" aria-label="OpenRouter AI workspace">
      <article className="ai-panel ai-panel-primary">
        <div className="panel-heading panel-heading-row">
          <div>
            <span className="panel-kicker">Generate draft</span>
            <strong>Черновик ответа через OpenRouter</strong>
          </div>
          <Badge tone="info">Sprint 5 API</Badge>
        </div>

        <form className="settings-form ai-form">
          <label>
            Message ID
            <input type="text" name="message_id" placeholder="UUID обращения из Inbox" />
          </label>
          <label>
            Тон ответа
            <select name="tone" defaultValue="neutral">
              <option value="neutral">Нейтральный</option>
              <option value="friendly">Доброжелательный</option>
              <option value="formal">Официальный</option>
              <option value="apologetic">Эмпатичный / с извинением</option>
            </select>
          </label>
          <label>
            Brand rules
            <textarea name="brand_rules" placeholder="Например: не обещать скидки, обращаться на Вы, не использовать эмодзи" />
          </label>
          <label>
            Knowledge Base context
            <textarea name="knowledge_base" placeholder="Факты о товаре, доставке, гарантии или правилах поддержки" />
          </label>
          <button className="button button-primary" type="button">
            Сгенерировать AI-черновик
          </button>
        </form>
      </article>

      <aside className="ai-panel">
        <div className="panel-heading">
          <span className="panel-kicker">Prompt Strategy v1</span>
          <strong>Слои контекста</strong>
        </div>
        <ol className="ai-layer-list">
          {promptLayers.map((layer) => (
            <li key={layer}>{layer}</li>
          ))}
        </ol>
      </aside>

      <article className="ai-panel">
        <div className="panel-heading">
          <span className="panel-kicker">Usage accounting</span>
          <strong>Что логируется</strong>
        </div>
        <div className="detail-grid">
          {usageMetrics.map((item) => (
            <div className="detail-item" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
        <p>
          Backend сохраняет модель, prompt version, latency, input/output tokens, cost estimate и safety flags.
          OpenRouter API key остаётся только на backend и не попадает во frontend.
        </p>
      </article>

      <article className="ai-panel ai-panel-warning">
        <div className="panel-heading">
          <span className="panel-kicker">Safety</span>
          <strong>Когда нужен ручной контроль</strong>
        </div>
        <ul className="safety-list">
          <li>Низкая уверенность модели.</li>
          <li>Нет product context.</li>
          <li>Негативный отзыв 1–3 звезды.</li>
          <li>Риск обещания возврата, замены, компенсации или сроков.</li>
          <li>Медицинские, юридические или потенциально опасные утверждения.</li>
        </ul>
      </article>
    </section>
  );
}

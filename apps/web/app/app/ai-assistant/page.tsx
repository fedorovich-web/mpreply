import { AIAssistantWorkspace } from "../../../components/ai-assistant/AIAssistantWorkspace";

export default function AIAssistantPage() {
  return (
    <section className="app-page app-page-wide">
      <header className="app-header app-header-row">
        <div>
          <p className="eyebrow">ИИ-помощник</p>
          <h1>Черновики ответов с контекстом обращения</h1>
          <p>
            Respio берёт отзыв или вопрос из очереди, добавляет сведения о товаре и правила бренда,
            готовит ответ на сервере и сохраняет уровень уверенности, расход токенов и результаты проверки.
          </p>
        </div>
        <div className="app-header-actions">
          <span className="status-badge">Ключ ИИ только на сервере</span>
          <span className="status-badge">SafetyGate</span>
        </div>
      </header>

      <AIAssistantWorkspace />
    </section>
  );
}

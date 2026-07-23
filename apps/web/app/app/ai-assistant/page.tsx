import { AIAssistantWorkspace } from "../../../components/ai-assistant/AIAssistantWorkspace";

export default function AIAssistantPage() {
  return (
    <section className="app-page app-page-wide">
      <header className="app-header app-header-row">
        <div>
          <p className="eyebrow">AI Assistant</p>
          <h1>AI-черновики на реальном контексте обращений</h1>
          <p>
            Система берёт отзыв или вопрос из Inbox, добавляет контекст товара и настройки ответов,
            генерирует ответ через backend-only OpenRouter и сохраняет confidence, usage и safety flags.
          </p>
        </div>
        <div className="app-header-actions">
          <span className="status-badge">OpenRouter backend-only</span>
          <span className="status-badge">SafetyGate</span>
        </div>
      </header>

      <AIAssistantWorkspace />
    </section>
  );
}

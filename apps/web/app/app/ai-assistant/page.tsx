import { AIAssistantWorkspace } from "../../../components/ai-assistant/AIAssistantWorkspace";

export default function AIAssistantPage() {
  return (
    <section className="app-page app-page-wide">
      <header className="app-header app-header-row">
        <div>
          <p className="eyebrow">AI Assistant</p>
          <h1>AI-черновики на реальном контексте обращений</h1>
          <p>
            Respio берёт отзыв или вопрос из Inbox, добавляет контекст товара и правила бренда,
            генерирует ответ через backend-only Groq/Qwen 3.8 и сохраняет confidence, usage и safety flags.
          </p>
        </div>
        <div className="app-header-actions">
          <span className="status-badge">Groq backend-only</span>
          <span className="status-badge">SafetyGate</span>
        </div>
      </header>

      <AIAssistantWorkspace />
    </section>
  );
}

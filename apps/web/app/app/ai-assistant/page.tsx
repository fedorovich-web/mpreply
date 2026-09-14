import { ScopedAIAssistantWorkspace } from "../../../components/ai-assistant/ScopedAIAssistantWorkspace";

export default function AIAssistantPage() {
  return (
    <section className="app-page app-page-wide ai-assistant-page">
      <header className="app-header app-header-row ai-assistant-page-header">
        <div>
          <p className="eyebrow">ИИ-ассистент</p>
          <h1>Подготовьте ответ и передайте его на проверку</h1>
          <p>
            Выберите обращение, задайте стиль и добавьте важные факты. В MPReply обращение, контекст и готовый текст остаются в одном рабочем пространстве — черновик можно сразу отредактировать и передать на проверку.
          </p>
        </div>
        <div className="app-header-actions" aria-label="Возможности ИИ-ассистента">
          <span className="status-badge">Контекст рядом</span>
          <span className="status-badge">Редактирование до проверки</span>
        </div>
      </header>

      <ScopedAIAssistantWorkspace />
    </section>
  );
}

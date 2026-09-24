import { ScopedAIAssistantWorkspace } from "../../../components/ai-assistant/ScopedAIAssistantWorkspace";

export default function AIAssistantPage() {
  return (
    <section className="app-page app-page-wide ai-assistant-page">
      <header className="app-header app-header-row ai-assistant-page-header">
        <div>
          <p className="eyebrow">Ответы с ИИ</p>
          <h1>Подготовьте ответ покупателю с помощью ИИ</h1>
          <p>
            Выберите обращение, задайте тон и добавьте важные факты о товаре. MPReply подготовит черновик, который можно сразу отредактировать и передать на проверку.
          </p>
        </div>
        <div className="app-header-actions" aria-label="Возможности подготовки ответа">
          <span className="status-badge">Контекст рядом</span>
          <span className="status-badge">Редактирование до проверки</span>
        </div>
      </header>

      <ScopedAIAssistantWorkspace />
    </section>
  );
}

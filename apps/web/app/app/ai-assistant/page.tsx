import { ScopedAIAssistantWorkspace } from "../../../components/ai-assistant/ScopedAIAssistantWorkspace";

export default function AIAssistantPage() {
  return (
    <section className="app-page app-page-wide ai-assistant-page">
      <header className="app-header ai-assistant-page-header">
        <h1>Ответы с ИИ</h1>
        <p>
          Выберите обращение, задайте тон и добавьте важные факты о товаре. MPReply подготовит черновик, который можно отредактировать перед проверкой.
        </p>
      </header>

      <ScopedAIAssistantWorkspace />
    </section>
  );
}

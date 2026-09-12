import { AIAssistantWorkspace } from "../../../components/ai-assistant/AIAssistantWorkspace";

export default function AIAssistantPage() {
  return (
    <section className="app-page app-page-wide">
      <header className="app-header app-header-row">
        <div>
          <p className="eyebrow">ИИ-ассистент</p>
          <h1>Подготовьте ответ с учётом контекста обращения</h1>
          <p>
            Выберите отзыв, вопрос или сообщение, задайте стиль ответа и добавьте нужные факты о товаре. MPReply подготовит черновик и покажет, есть ли причины отправить его на дополнительную проверку.
          </p>
        </div>
        <div className="app-header-actions">
          <span className="status-badge">Контекст товара</span>
          <span className="status-badge">Проверка рисков</span>
        </div>
      </header>

      <AIAssistantWorkspace />
    </section>
  );
}

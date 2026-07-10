import { AIAssistantWorkspace } from "../../../components/ai-assistant/AIAssistantWorkspace";

export default function AIAssistantPage() {
  return (
    <section className="app-page app-page-wide">
      <section className="app-header app-header-row">
        <div>
          <p className="eyebrow">AI Assistant</p>
          <h1>OpenRouter AI для черновиков ответов</h1>
          <p>
            Sprint 5 подключает backend-only OpenRouter provider, prompt strategy v1, генерацию AI-черновиков,
            usage/cost logging и safety flags до будущей автоотправки.
          </p>
        </div>
        <div className="app-header-actions">
          <span className="status-badge">Backend-only key</span>
          <span className="status-badge">Prompt v1</span>
        </div>
      </section>

      <AIAssistantWorkspace />
    </section>
  );
}

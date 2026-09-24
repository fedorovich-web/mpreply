import { ScopedAIAssistantWorkspace } from "../../../../components/ai-assistant/ScopedAIAssistantWorkspace";

export default function EnglishAIAssistantPage() {
  return (
    <section className="app-page app-page-wide ai-assistant-page">
      <header className="app-header ai-assistant-page-header">
        <h1>AI replies</h1>
        <p>
          Choose a customer message, set the reply tone, and add verified product facts. MPReply prepares a draft that your team can edit before review.
        </p>
      </header>

      <ScopedAIAssistantWorkspace />
    </section>
  );
}

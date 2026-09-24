import { AutomationRulesWorkspace } from "../../../components/automation-rules/AutomationRulesWorkspace";

export default function AutomationRulesPage() {
  return (
    <section className="app-page app-page-wide automation-page">
      <header className="app-header automation-page-header">
        <h1>Автоматизация</h1>
        <p>
          Задайте условия и порядок применения правил: простые обращения можно обрабатывать автоматически, а спорные ситуации оставлять на проверку.
        </p>
      </header>

      <AutomationRulesWorkspace />
    </section>
  );
}

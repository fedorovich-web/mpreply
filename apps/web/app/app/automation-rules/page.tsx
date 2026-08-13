import { AutomationRulesWorkspace } from "../../../components/automation-rules/AutomationRulesWorkspace";

export default function AutomationRulesPage() {
  return (
    <section className="app-page app-page-wide">
      <header className="app-header">
        <h1>Правила автоответов</h1>
        <p>Определите, какие обращения MPReply обрабатывает автоматически, а какие передаёт на проверку.</p>
      </header>

      <AutomationRulesWorkspace />
    </section>
  );
}

import { AutomationRulesWorkspace } from "../../../../components/automation-rules/AutomationRulesWorkspace";

export default function EnglishAutomationRulesPage() {
  return (
    <section className="app-page app-page-wide automation-rules-page">
      <header className="app-header automation-rules-page-header">
        <h1>Automation</h1>
        <p>
          Define rule conditions and evaluation order so routine customer messages can be handled automatically while exceptions stay under review.
        </p>
      </header>

      <AutomationRulesWorkspace />
    </section>
  );
}

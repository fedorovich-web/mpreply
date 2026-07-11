import { AutomationRulesWorkspace } from "../../../components/automation-rules/AutomationRulesWorkspace";

export default function AutomationRulesPage() {
  return (
    <section className="app-page app-page-wide">
      <section className="app-header app-header-row">
        <div>
          <p className="eyebrow">Automation Rules</p>
          <h1>Автоматические ответы с понятными правилами и SafetyGate</h1>
          <p>
            Respio работает в auto-first режиме: подходящие обращения обрабатываются автоматически,
            а сомнительные случаи переводятся на ручную проверку по детерминированным условиям.
          </p>
        </div>
        <div className="app-header-actions">
          <span className="status-badge">Auto by default</span>
          <span className="status-badge">Safety fallback</span>
        </div>
      </section>

      <AutomationRulesWorkspace />
    </section>
  );
}

import { AutomationRulesWorkspace } from "../../../components/automation-rules/AutomationRulesWorkspace";

export default function AutomationRulesPage() {
  return (
    <section className="app-page app-page-wide">
      <section className="app-header app-header-row">
        <div>
          <p className="eyebrow">Правила автоматизации</p>
          <h1>Автоматические ответы с понятными правилами и SafetyGate</h1>
          <p>
            Respio сначала применяет автоматический режим: подходящие обращения обрабатываются без участия менеджера,
            а сомнительные случаи переводятся на ручную проверку по детерминированным условиям.
          </p>
        </div>
        <div className="app-header-actions">
          <span className="status-badge">Автоматически по умолчанию</span>
          <span className="status-badge">Проверка рискованных ответов</span>
        </div>
      </section>

      <AutomationRulesWorkspace />
    </section>
  );
}

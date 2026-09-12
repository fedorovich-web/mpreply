import { AutomationRulesWorkspace } from "../../../components/automation-rules/AutomationRulesWorkspace";

export default function AutomationRulesPage() {
  return (
    <section className="app-page app-page-wide automation-page">
      <header className="app-header app-header-row automation-page-header">
        <div>
          <p className="eyebrow">Автоматизация</p>
          <h1>Определите, когда MPReply может отвечать автоматически</h1>
          <p>
            Для каждого правила задайте условия, приоритет и уровень контроля: обычные ситуации можно обрабатывать автоматически, а спорные и рискованные — оставлять на ручную проверку.
          </p>
        </div>
        <div className="app-header-actions" aria-label="Возможности автоматизации">
          <span className="status-badge">Условия и приоритет</span>
          <span className="status-badge">Контроль перед отправкой</span>
        </div>
      </header>

      <AutomationRulesWorkspace />
    </section>
  );
}

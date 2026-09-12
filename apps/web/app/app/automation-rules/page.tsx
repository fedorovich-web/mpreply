import { AutomationRulesWorkspace } from "../../../components/automation-rules/AutomationRulesWorkspace";

export default function AutomationRulesPage() {
  return (
    <section className="app-page app-page-wide">
      <section className="app-header app-header-row">
        <div>
          <p className="eyebrow">Автоматизация</p>
          <h1>Настройте, какие обращения можно отвечать автоматически</h1>
          <p>
            Создавайте правила для разных типов обращений, рейтингов и товаров. Обычные ситуации можно обрабатывать автоматически, а спорные и рискованные — направлять менеджеру.
          </p>
        </div>
        <div className="app-header-actions">
          <span className="status-badge">Правила автоответов</span>
          <span className="status-badge">Ручная проверка</span>
        </div>
      </section>

      <AutomationRulesWorkspace />
    </section>
  );
}

import type { Metadata } from "next";

import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Материалы",
  description:
    "Практические материалы Respio об автоматизации ответов, SafetyGate, AI prompt strategy, marketplace API и операционной надёжности.",
  path: "/resources",
});

const materials = [
  ["Auto-first без слепой автоотправки", "Как отделить безопасную автоматизацию от неконтролируемой публикации AI-текста."],
  ["Почему одного prompt недостаточно", "Роль SafetyGate, правил, квот, idempotency и worker execution."],
  ["Marketplace adapter как архитектурная граница", "Почему API-специфику Wildberries, Ozon, Яндекс Маркета и Авито нельзя смешивать в одном сервисе."],
  ["AI usage и cost accounting", "Какие метрики фиксировать для контроля моделей, токенов, latency и себестоимости."],
  ["Статусы вместо скрытой магии", "Как state machine делает ошибки, retry и ручную проверку прозрачными."],
  ["Безопасность API-ключей", "Backend-only хранение, шифрование, fingerprint, rotation и запрет на утечки во frontend и логи."],
];

export default function ResourcesPage() {
  return (
    <PublicShell>
      <section className="public-hero public-hero-compact">
        <div className="public-container public-hero-copy public-hero-copy-centered">
          <p className="eyebrow">Материалы</p>
          <h1>Практика безопасной автоматизации ответов на маркетплейсах</h1>
          <p className="public-lead">Контентная основа для будущего resource hub. Без выдуманных кейсов, цифр и неподтверждённых обещаний.</p>
        </div>
      </section>
      <section className="public-section">
        <div className="public-container resource-grid">
          {materials.map(([title, description]) => (
            <article className="resource-card" key={title}>
              <span className="panel-kicker">Guide outline</span>
              <h2>{title}</h2>
              <p>{description}</p>
              <span className="resource-state">Материал в редакционном плане</span>
            </article>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}

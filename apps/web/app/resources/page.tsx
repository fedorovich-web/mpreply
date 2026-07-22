import type { Metadata } from "next";
import { MarketingGlyph } from "../../components/public-site/MarketingGlyph";
import { PublicShell } from "../../components/public-site/PublicShell";
import { PublicTrialCta } from "../../components/public-site/PublicTrialCta";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Материалы об ответах на отзывы и вопросы маркетплейсов",
  description:
    "Практические материалы MPReply: автоматизация ответов, работа с негативом, база знаний, правила автопубликации и контроль качества ИИ.",
  path: "/resources",
});

const materials = [
  {
    icon: "reviews" as const,
    label: "Гайд",
    title: "Как отвечать на отзывы без шаблонных фраз",
    text: "Структура сильного ответа, работа с оценкой, повторной покупкой и негативом без лишних обещаний.",
  },
  {
    icon: "questions" as const,
    label: "Чек-лист",
    title: "Какие данные нужны ИИ для точного ответа о товаре",
    text: "Характеристики, инструкции, FAQ, ограничения и правила, которые снижают риск выдуманных фактов.",
  },
  {
    icon: "settings" as const,
    label: "Методика",
    title: "Как настроить безопасную автопубликацию",
    text: "Стоп-темы, категории риска, сценарии автопубликации и настройки согласования.",
  },
  {
    icon: "chats" as const,
    label: "Практика",
    title: "Чаты покупателей: где ИИ помогает, а где нужен менеджер",
    text: "Типовые вопросы, сохранение контекста диалога, эскалация и контроль обещаний продавца.",
  },
  {
    icon: "history" as const,
    label: "Аудит",
    title: "Какие метрики показывают качество автоматизации",
    text: "Доля автопубликации, правки, эскалации, скорость ответа и повторяющиеся пробелы в данных.",
  },
  {
    icon: "context" as const,
    label: "Шаблон",
    title: "Структура базы знаний продавца",
    text: "Как хранить информацию о товарах, совместимости, возвратах и ограничениях, чтобы ответы были единообразными.",
  },
] as const;

export default function ResourcesPage() {
  return (
    <PublicShell>
      <section className="public-subhero">
        <div className="public-container public-subhero-grid">
          <div className="public-subhero-copy">
            <p className="public-eyebrow">База знаний MPReply</p>
            <h1>Практические материалы для автоматизации общения с покупателями</h1>
            <p className="public-lead">
              Не общие статьи об ИИ, а конкретные правила для отзывов, вопросов, чатов, базы знаний и автоматической публикации.
            </p>
          </div>
          <aside className="public-proof-panel-v73">
            <MarketingGlyph variant="context" />
            <h2>Основные темы</h2>
            <ul>
              <li>Ответы на отзывы и негатив</li>
              <li>Вопросы о товаре и фактология</li>
              <li>Чаты и настройки согласования</li>
              <li>Правила автопубликации</li>
            </ul>
          </aside>
        </div>
      </section>

      <div className="public-section">
        <div className="public-container">
          <div className="resource-library-grid resource-library-grid-v73">
            {materials.map((material) => (
              <article className="resource-library-card" key={material.title}>
                <MarketingGlyph variant={material.icon} />
                <span className="resource-state">{material.label}</span>
                <h2>{material.title}</h2>
                <p>{material.text}</p>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="public-section public-cta-section">
        <div className="public-container home-final-cta-card public-page-final-cta">
          <div>
            <p className="public-eyebrow">Проверить на практике</p>
            <h2>Примените правила на реальных обращениях</h2>
            <p>Семь дней и 400 ответов бесплатно.</p>
          </div>
          <PublicTrialCta className="button button-primary public-cta-on-dark" source="resources-footer">Начать тест</PublicTrialCta>
        </div>
      </div>
    </PublicShell>
  );
}

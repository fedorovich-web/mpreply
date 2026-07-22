import type { Metadata } from "next";

import { MarketingGlyph } from "../../components/public-site/MarketingGlyph";
import { PublicShell } from "../../components/public-site/PublicShell";
import { PublicTrialCta } from "../../components/public-site/PublicTrialCta";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Блог MPReply — автоматические ответы на отзывы и вопросы маркетплейсов",
  description:
    "Блог MPReply о том, как автоматизировать ответы на отзывы, вопросы и чаты маркетплейсов: автопубликация, база знаний, правила продавца и качество ИИ-ответов.",
  path: "/blog",
});

const posts = [
  {
    icon: "reviews" as const,
    label: "Отзывы",
    title: "Как отвечать на негативные отзывы без шаблонных отписок",
    text: "Разбираем структуру ответа: признать проблему, проверить факт, объяснить решение и сохранить тон бренда.",
  },
  {
    icon: "questions" as const,
    label: "Вопросы о товаре",
    title: "Какие данные нужны для точных ответов о размере, составе и совместимости",
    text: "Карточка товара, характеристики, инструкции, FAQ и база знаний помогают отвечать конкретно, а не общими фразами.",
  },
  {
    icon: "settings" as const,
    label: "Автопубликация",
    title: "Как настроить автоматическую публикацию ответов без обязательной ручной очереди",
    text: "Правила продавца определяют, какие ответы публикуются сразу, какие остаются ответами для команды и где требуется согласование.",
  },
  {
    icon: "chats" as const,
    label: "Чаты",
    title: "Как сохранять контекст диалога в чатах маркетплейсов",
    text: "Повторные вопросы, уточнения и история сообщений требуют другого сценария, чем одиночный отзыв или вопрос о товаре.",
  },
] as const;

export default function BlogPage() {
  return (
    <PublicShell>
      <section className="public-subhero blog-page-hero-v89">
        <div className="public-container public-subhero-grid">
          <div className="public-subhero-copy">
            <p className="public-eyebrow">Блог MPReply</p>
            <h1>Практика автоматических ответов на маркетплейсах</h1>
            <p className="public-lead">
              Разбираем SEO, репутацию, клиентскую поддержку, автопубликацию и качество ИИ-ответов для продавцов Wildberries, Ozon, Яндекс Маркета и Авито.
            </p>
          </div>
          <aside className="public-proof-panel-v73" aria-label="Темы блога MPReply">
            <MarketingGlyph variant="recommendations" />
            <h2>Темы блога</h2>
            <ul>
              <li>Отзывы и репутация продавца</li>
              <li>Вопросы о товаре и карточка товара</li>
              <li>Чаты и повторные обращения</li>
              <li>Автопубликация и контроль качества</li>
            </ul>
          </aside>
        </div>
      </section>

      <section className="public-section" aria-labelledby="blog-list-title">
        <div className="public-container">
          <header className="section-heading section-heading-wide">
            <p className="public-eyebrow">Материалы</p>
            <h2 id="blog-list-title">Гайды для продавцов маркетплейсов</h2>
            <p>Публикации помогают настроить правила ответов, подготовить базу знаний и понять, какие обращения можно автоматизировать первыми.</p>
          </header>
          <div className="resource-library-grid resource-library-grid-v73">
            {posts.map((post) => (
              <article className="resource-library-card" key={post.title}>
                <MarketingGlyph variant={post.icon} />
                <span className="resource-state">{post.label}</span>
                <h3>{post.title}</h3>
                <p>{post.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <div className="public-section public-cta-section">
        <div className="public-container home-final-cta-card public-page-final-cta">
          <div>
            <p className="public-eyebrow">Проверить вместо теории</p>
            <h2>Запустите автоматические ответы на своих обращениях</h2>
            <p>MPReply даст 400 ответов на 7 дней, чтобы проверить автопубликацию на реальных отзывах, вопросах и чатах.</p>
          </div>
          <PublicTrialCta className="button button-primary public-cta-on-dark" source="blog-footer">
            Начать бесплатный тест
          </PublicTrialCta>
        </div>
      </div>
    </PublicShell>
  );
}

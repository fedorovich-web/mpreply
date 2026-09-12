import type { Metadata } from "next";

import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Политика конфиденциальности",
  description: "Проект политики конфиденциальности MPReply: категории данных, цели обработки, безопасность, сроки хранения и права пользователей.",
  path: "/privacy",
});

const sections = [
  ["privacy-general", "1. Общие положения"],
  ["privacy-operator", "2. Кто является оператором"],
  ["privacy-data", "3. Какие данные могут обрабатываться"],
  ["privacy-purpose", "4. Цели обработки"],
  ["privacy-ai", "5. AI и передача контекста"],
  ["privacy-credentials", "6. Marketplace credentials"],
  ["privacy-retention", "7. Хранение и удаление"],
  ["privacy-rights", "8. Права пользователей"],
  ["privacy-security", "9. Безопасность"],
  ["privacy-changes", "10. Изменения документа"],
] as const;

export default function PrivacyPage() {
  return (
    <PublicShell>
      <section className="legal-hero legal-approved-hero">
        <div className="public-container legal-hero-inner">
          <p className="eyebrow">Legal draft</p>
          <h1>Политика конфиденциальности</h1>
          <p className="public-lead">Редакция: 10 июля 2026 года. Юридический черновик для технической основы MPReply.</p>
        </div>
      </section>

      <div className="public-container legal-approved-layout">
        <aside className="legal-toc" aria-label="Содержание политики конфиденциальности">
          <span>Содержание</span>
          <nav>
            {sections.map(([id, label]) => <a href={`#${id}`} key={id}>{label}</a>)}
          </nav>
        </aside>

        <article className="legal-approved-document">
          <aside className="legal-warning">
            <strong>До production-запуска требуется юридическая финализация.</strong>
            <p>Нужно заполнить сведения об операторе, проверить фактическую инфраструктуру, процессы, подрядчиков, локализацию, сроки хранения, формы согласия и применимые требования законодательства.</p>
          </aside>

          <section id="privacy-general"><h2>1. Общие положения</h2><p>Настоящий документ описывает предполагаемые принципы обработки информации в SaaS MPReply. Он не заменяет обязательные документы конкретного оператора и не подтверждает, что все описанные процессы уже запущены в production.</p></section>
          <section id="privacy-operator"><h2>2. Кто является оператором</h2><p>Сведения о юридическом лице или индивидуальном предпринимателе, выступающем оператором, должны быть добавлены до коммерческого запуска: наименование, адрес, контактный канал и иные обязательные реквизиты.</p></section>
          <section id="privacy-data"><h2>3. Какие данные могут обрабатываться</h2><ul><li>данные аккаунта: email, идентификатор пользователя, настройки;</li><li>данные workspace и состава команды;</li><li>credentials маркетплейсов — только на backend и в зашифрованном виде;</li><li>отзывы, вопросы, сообщения и связанные метаданные, полученные через доступные API;</li><li>AI usage: модель, токены, latency, cost estimate, prompt version;</li><li>технические журналы, audit events и integration events с минимизацией персональных данных.</li></ul></section>
          <section id="privacy-purpose"><h2>4. Цели обработки</h2><ul><li>предоставление SaaS-функций и аутентификации;</li><li>синхронизация обращений и отправка ответов;</li><li>генерация AI-черновиков и контроль автоматизации;</li><li>обнаружение ошибок, обеспечение безопасности и аудит действий;</li><li>поддержка пользователей и развитие продукта.</li></ul></section>
          <section id="privacy-ai"><h2>5. AI и передача контекста</h2><p>В LLM-провайдер должен передаваться только контекст, необходимый для генерации ответа. Не следует отправлять лишние персональные данные, секреты, API-ключи или внутреннюю техническую информацию.</p></section>
          <section id="privacy-credentials"><h2>6. Marketplace credentials</h2><p>Ключи маркетплейсов не должны попадать во frontend, обычные API responses или обычные логи. В технической основе MPReply предусмотрены backend-only обработка, шифрование at rest, fingerprint и rotation lifecycle.</p></section>
          <section id="privacy-retention"><h2>7. Хранение и удаление</h2><p>Конкретные сроки хранения должны быть определены до production-запуска для каждой категории данных. Архитектура должна поддерживать минимизацию, удаление и экспорт данных в объёме, необходимом для применимых обязательств.</p></section>
          <section id="privacy-rights"><h2>8. Права пользователей</h2><p>Порядок обращений по вопросам доступа, исправления, удаления и ограничения обработки должен быть указан после утверждения оператора и официального контактного канала.</p></section>
          <section id="privacy-security"><h2>9. Безопасность</h2><p>Базовые меры включают tenant isolation, RBAC, шифрование credentials, rate limits, secret management, audit trail, резервное копирование, минимизацию PII и запрет на публикацию секретов во frontend.</p></section>
          <section id="privacy-changes"><h2>10. Изменения документа</h2><p>Дата и содержание изменений должны фиксироваться. Существенные изменения должны публиковаться до вступления новой редакции в силу, если это требуется применимыми правилами и договорными обязательствами.</p></section>
        </article>
      </div>
    </PublicShell>
  );
}

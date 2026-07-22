import type { Metadata } from "next";

import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Условия использования",
  description: "Основные условия использования сервиса Respio.",
  path: "/terms",
  noIndex: true,
});

export default function TermsPage() {
  return (
    <PublicShell>
      <section className="legal-hero">
        <div className="public-container legal-hero-inner">
          <p className="public-eyebrow">Документы</p>
          <h1>Условия использования</h1>
          <p>Черновая публичная редакция. Перед приёмом оплаты и запуском trial entitlement документ должен быть проверен юристом.</p>
        </div>
      </section>
      <div className="public-container legal-document">
        <section>
          <h2>1. Назначение сервиса</h2>
          <p>Respio помогает готовить, проверять и публиковать ответы на обращения покупателей в пределах подключённых интеграций и настроенных пользователем правил.</p>
        </section>
        <section>
          <h2>2. Ответственность пользователя</h2>
          <p>Пользователь отвечает за корректность предоставленных данных, правила публикации, права доступа к кабинетам и окончательное решение по рискованным обращениям.</p>
        </section>
        <section>
          <h2>3. Ограничения автоматизации</h2>
          <p>ИИ может ошибаться. Автопубликация должна использоваться только для сценариев, которые пользователь явно разрешил и для которых доступен достаточный контекст.</p>
        </section>
        <section>
          <h2>4. Бесплатный тест и тарифы</h2>
          <p>Фактические лимиты, сроки, стоимость, порядок оплаты и прекращения доступа должны соответствовать информации в биллинге и окончательной коммерческой оферте.</p>
        </section>
      </div>
    </PublicShell>
  );
}

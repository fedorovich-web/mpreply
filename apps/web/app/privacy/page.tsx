import type { Metadata } from "next";

import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Политика конфиденциальности",
  description: "Основные правила обработки данных на публичном сайте и в сервисе Respio.",
  path: "/privacy",
  noIndex: true,
});

export default function PrivacyPage() {
  return (
    <PublicShell>
      <section className="legal-hero">
        <div className="public-container legal-hero-inner">
          <p className="public-eyebrow">Документы</p>
          <h1>Политика конфиденциальности</h1>
          <p>Черновая публичная редакция. Перед коммерческим запуском документ должен быть проверен юристом и дополнен реквизитами оператора данных.</p>
        </div>
      </section>
      <div className="public-container legal-document">
        <section>
          <h2>1. Какие данные могут обрабатываться</h2>
          <p>Контактные данные, сведения об аккаунте, технические данные сессии, настройки подключений и информация, необходимая для работы выбранных функций сервиса.</p>
        </section>
        <section>
          <h2>2. Для чего используются данные</h2>
          <p>Для регистрации, предоставления доступа к сервису, поддержки пользователя, обеспечения безопасности, выполнения договорных обязательств и улучшения продукта.</p>
        </section>
        <section>
          <h2>3. Данные маркетплейсов</h2>
          <p>Права доступа и состав данных должны ограничиваться тем, что необходимо для выбранной интеграции. Сервис не должен запрашивать доступ к финансам или операциям, не связанным с заявленной функцией.</p>
        </section>
        <section>
          <h2>4. Хранение и защита</h2>
          <p>Сроки хранения, места обработки, перечень подрядчиков и меры защиты должны быть указаны в окончательной юридической редакции и соответствовать фактической архитектуре Respio.</p>
        </section>
      </div>
    </PublicShell>
  );
}

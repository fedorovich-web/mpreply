import Link from "next/link";

const integrations = [
  {
    name: "Wildberries",
    status: "Доступно для подключения",
    description: "Отзывы и вопросы через официальный API. Первый marketplace adapter для MVP.",
    href: "/app/integrations/wildberries",
    badge: "MVP",
  },
  {
    name: "Ozon",
    status: "Проверка API",
    description: "Не включаем production-send до финальной проверки official docs.",
    href: "/app/integrations",
    badge: "Post-MVP",
  },
  {
    name: "Яндекс Маркет",
    status: "Кандидат на Sprint после WB",
    description: "Поддержка будет включена после стабилизации WB pipeline.",
    href: "/app/integrations",
    badge: "Next",
  },
  {
    name: "Авито",
    status: "Требует official verification",
    description: "Не обещаем отправку ответов без подтверждённых API contracts.",
    href: "/app/integrations",
    badge: "Research",
  },
];

export default function IntegrationsPage() {
  return (
    <main className="app-page">
      <section className="app-header">
        <p className="eyebrow">Integrations</p>
        <h1>Подключение маркетплейсов</h1>
        <p>
          Sprint 3 добавляет ручной запуск WB sync, импорт отзывов и вопросов, deduplication и integration events.
        </p>
      </section>

      <section className="integration-grid" aria-label="Список интеграций">
        {integrations.map((integration) => (
          <article className="integration-card" key={integration.name}>
            <div className="integration-card-header">
              <div>
                <span className="status-badge">{integration.badge}</span>
                <h2>{integration.name}</h2>
              </div>
            </div>
            <p className="integration-status">{integration.status}</p>
            <p>{integration.description}</p>
            <Link className="button button-secondary" href={integration.href}>
              {integration.name === "Wildberries" ? "Подключить" : "Подробнее"}
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}

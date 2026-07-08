const sampleMessages = [
  {
    source: "Wildberries",
    type: "Отзыв",
    status: "Нужен ответ",
    product: "Товар WB",
    text: "Покупатель оставил отзыв. После sync здесь будет реальный текст обращения.",
    badge: "needs_reply",
  },
  {
    source: "Wildberries",
    type: "Вопрос",
    status: "Нужен ответ",
    product: "Товар WB",
    text: "Покупатель задал вопрос. Sprint 3 добавляет импорт и API списка обращений.",
    badge: "question",
  },
];

export default function InboxPage() {
  return (
    <main className="app-page">
      <section className="app-header">
        <p className="eyebrow">Inbox</p>
        <h1>Единая очередь обращений</h1>
        <p>
          Sprint 3 добавляет backend API для списка обращений, деталей сообщения и базовых действий.
          После синхронизации WB отзывы и вопросы попадают сюда с дедупликацией.
        </p>
      </section>

      <section className="inbox-layout" aria-label="Inbox layout preview">
        <aside className="inbox-filters" aria-label="Фильтры обращений">
          <h2>Фильтры</h2>
          <button className="filter-chip" type="button">Все</button>
          <button className="filter-chip" type="button">Нужен ответ</button>
          <button className="filter-chip" type="button">Отзывы</button>
          <button className="filter-chip" type="button">Вопросы</button>
          <button className="filter-chip" type="button">Wildberries</button>
        </aside>

        <section className="message-list" aria-label="Список обращений">
          {sampleMessages.map((message) => (
            <article className="message-card" key={`${message.type}-${message.badge}`}>
              <div className="message-card-topline">
                <span className="status-badge">{message.source}</span>
                <span className="status-badge">{message.type}</span>
              </div>
              <h2>{message.product}</h2>
              <p>{message.text}</p>
              <strong>{message.status}</strong>
            </article>
          ))}
        </section>

        <aside className="message-detail" aria-label="Детали обращения">
          <span className="status-badge">Детали</span>
          <h2>Карточка обращения</h2>
          <p>
            Правая панель будет показывать текст покупателя, товар, статус, AI-ответ, safety flags,
            историю действий и кнопки ручной обработки.
          </p>
          <div className="detail-block">
            <strong>API endpoints</strong>
            <span>GET /api/messages</span>
            <span>GET /api/messages/&lbrace;id&rbrace;</span>
            <span>PATCH /api/messages/&lbrace;id&rbrace;</span>
          </div>
        </aside>
      </section>
    </main>
  );
}

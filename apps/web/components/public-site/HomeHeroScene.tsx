export function HomeHeroScene() {
  const rows = [
    { initials: "АК", name: "Анна К.", text: "Отличный товар, спасибо!", time: "5 мин назад", type: "Отзыв", tone: "green" },
    { initials: "ИС", name: "Игорь С.", text: "Когда будет доставка в Казань?", time: "28 мин назад", type: "Вопрос", tone: "blue" },
    { initials: "МП", name: "Мария П.", text: "Здравствуйте! Подскажите по размеру.", time: "1 час назад", type: "Сообщение", tone: "cyan" },
    { initials: "АВ", name: "Алексей В.", text: "Можно ли вернуть товар?", time: "3 часа назад", type: "Отзыв", tone: "green" },
  ] as const;

  return (
    <div className="homepage-hero-scene" aria-label="Пример интерфейса MPReply">
      <div className="homepage-hero-glow" aria-hidden="true" />
      <div className="homepage-hero-window">
        <aside className="homepage-hero-window-sidebar" aria-hidden="true">
          <div className="homepage-mini-brand">
            <span className="homepage-mini-brand-mark">▤</span>
            <strong>MPReply</strong>
          </div>
          <div className="homepage-mini-nav is-active"><span>▧</span><b>Все обращения</b><small>134</small></div>
          <div className="homepage-mini-nav"><span>☆</span><b>Отзывы</b><small>56</small></div>
          <div className="homepage-mini-nav"><span>⊙</span><b>Вопросы</b><small>34</small></div>
          <div className="homepage-mini-nav"><span>▱</span><b>Сообщения</b><small>28</small></div>
          <div className="homepage-mini-nav"><span>⌁</span><b>На проверке</b><small>12</small></div>
          <div className="homepage-mini-nav"><span>○</span><b>Архив</b><small /></div>
        </aside>

        <div className="homepage-hero-window-main">
          <div className="homepage-hero-window-titlebar">
            <strong>Все обращения</strong>
            <div className="homepage-window-user" aria-hidden="true"><span>♧</span><span className="homepage-window-avatar">А</span></div>
          </div>
          <div className="homepage-window-toolbar" aria-hidden="true">
            <span className="homepage-window-search">⌕ &nbsp; Поиск по обращениям...</span>
            <span>Все площадки⌄</span>
            <span>Сначала новые⌄</span>
          </div>
          <div className="homepage-window-list">
            {rows.map((row) => (
              <div className="homepage-window-row" key={row.name}>
                <span className={`homepage-window-row-avatar is-${row.tone}`}>{row.initials}</span>
                <div className="homepage-window-row-copy">
                  <strong>{row.name}</strong>
                  <small>{row.text}</small>
                </div>
                <time>{row.time}</time>
                <span className={`homepage-window-type is-${row.tone}`}>{row.type}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="homepage-hero-ai-card">
        <div className="homepage-hero-ai-title"><span>✦</span><strong>Ответ с помощью ИИ</strong></div>
        <p>Здравствуйте, Анна! Спасибо за ваш отзыв! Нам очень приятно, что товар вам понравился.</p>
        <div className="homepage-hero-ai-actions" aria-hidden="true">
          <span>Дружелюбный⌄</span>
          <b>Отправить&nbsp; →</b>
        </div>
      </div>

      <div className="homepage-hero-handnote" aria-hidden="true">
        <span>↙</span>
        Быстрые<br />и точные<br />ответы 24/7
      </div>
    </div>
  );
}

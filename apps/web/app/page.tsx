import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero-section">
        <div className="hero-content">
          <p className="eyebrow">Auto-first SaaS для продавцов маркетплейсов</p>
          <h1>Автоответы на отзывы и вопросы маркетплейсов</h1>
          <p className="hero-text">
            Respio подключается к WB, Ozon, Яндекс Маркету и Авито через API,
            автоматически готовит и отправляет ответы с помощью AI, а спорные обращения
            переводит на ручную проверку.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/app">
              Запустить автоответы
            </Link>
            <Link className="button button-secondary" href="/demo">
              Посмотреть демо
            </Link>
          </div>
        </div>
        <div className="dashboard-preview" aria-label="Превью панели Respio">
          <div className="preview-toolbar">
            <span />
            <span />
            <span />
          </div>
          <div className="preview-grid">
            <div className="preview-card strong">Автоответы активны</div>
            <div className="preview-card">Требуют проверки: 3</div>
            <div className="preview-card wide">WB · Отзыв · AI-ответ отправлен</div>
            <div className="preview-card wide warning">Вопрос требует проверки: не хватает данных о товаре</div>
          </div>
        </div>
      </section>
    </main>
  );
}

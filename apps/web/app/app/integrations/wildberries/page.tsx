export default function WildberriesIntegrationPage() {
  return (
    <main className="app-page">
      <section className="app-header">
        <p className="eyebrow">Wildberries</p>
        <h1>Подключение WB API</h1>
        <p>
          Введите API-ключ с правами для отзывов и вопросов. Respio сохранит ключ только на backend в
          зашифрованном виде и после сохранения покажет только маску ключа.
        </p>
      </section>

      <section className="settings-layout">
        <article className="settings-card">
          <h2>Новый API-ключ</h2>
          <form className="settings-form">
            <label>
              Organization ID
              <input type="text" name="organization_id" placeholder="UUID workspace" />
            </label>
            <label>
              Название подключения
              <input type="text" name="display_name" placeholder="WB основной кабинет" />
            </label>
            <label>
              API-ключ Wildberries
              <input type="password" name="credentials" placeholder="Вставьте API-ключ" />
            </label>
            <label>
              Режим ответов
              <select name="default_response_mode" defaultValue="inherit">
                <option value="inherit">Наследовать workspace default</option>
                <option value="auto">Автоматический</option>
                <option value="semi_auto">С подтверждением</option>
              </select>
            </label>
            <button className="button button-primary" type="button">
              Сохранить подключение
            </button>
          </form>
        </article>

        <aside className="security-note">
          <h2>Security baseline</h2>
          <ul>
            <li>Ключ не попадает во frontend после сохранения.</li>
            <li>В базе хранится только encrypted value.</li>
            <li>В UI показывается только masked fingerprint.</li>
            <li>Validate / rotate / revoke пишутся в audit log.</li>
            <li>Sync и отправка ответов стартуют в Sprint 3.</li>
          </ul>
        </aside>
      </section>
    </main>
  );
}

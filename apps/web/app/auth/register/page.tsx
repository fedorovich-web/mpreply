import Link from "next/link";

export default function RegisterPage() {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="register-title">
        <p className="eyebrow">Respio account</p>
        <h1 id="register-title">Создать аккаунт</h1>
        <p className="auth-description">
          После регистрации создайте workspace и подключите Wildberries API-ключ. Автоответы будут
          включены по умолчанию.
        </p>
        <form className="auth-form">
          <label>
            Имя
            <input name="name" type="text" autoComplete="name" placeholder="Роман" />
          </label>
          <label>
            Email
            <input name="email" type="email" autoComplete="email" placeholder="you@example.com" />
          </label>
          <label>
            Пароль
            <input name="password" type="password" autoComplete="new-password" placeholder="Минимум 10 символов" />
          </label>
          <button className="button button-primary" type="submit">
            Зарегистрироваться
          </button>
        </form>
        <p className="auth-footer">
          Уже есть аккаунт? <Link href="/auth/login">Войти</Link>
        </p>
      </section>
    </main>
  );
}

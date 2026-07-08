import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <p className="eyebrow">Respio workspace</p>
        <h1 id="login-title">Вход</h1>
        <p className="auth-description">
          Войдите, чтобы управлять автоответами, правилами, интеграциями и очередью ручной проверки.
        </p>
        <form className="auth-form">
          <label>
            Email
            <input name="email" type="email" autoComplete="email" placeholder="you@example.com" />
          </label>
          <label>
            Пароль
            <input name="password" type="password" autoComplete="current-password" placeholder="Ваш пароль" />
          </label>
          <button className="button button-primary" type="submit">
            Войти
          </button>
        </form>
        <p className="auth-footer">
          Нет аккаунта? <Link href="/auth/register">Создать аккаунт</Link>
        </p>
      </section>
    </main>
  );
}

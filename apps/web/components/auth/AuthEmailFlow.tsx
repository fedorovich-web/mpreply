"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { ApiError, apiRequest } from "../../lib/api/client";
import { messageResponseSchema } from "../../lib/api/schemas";
import { localizedPath, type Locale } from "../../lib/i18n";
import { AuthShell } from "./AuthShell";

type AuthEmailMode = "forgot-password" | "resend-verification" | "reset-password" | "verify-email";

type RequestMode = "forgot-password" | "resend-verification";

const copy = {
  ru: {
    "forgot-password": {
      title: "Восстановить пароль",
      description: "Укажите email аккаунта. Если он существует, мы отправим одноразовую ссылку для сброса пароля.",
      endpoint: "/api/auth/forgot-password",
      submit: "Отправить ссылку",
    },
    "resend-verification": {
      title: "Подтвердить email",
      description: "Укажите email, если письмо подтверждения не пришло или ссылка уже истекла.",
      endpoint: "/api/auth/resend-verification",
      submit: "Отправить письмо ещё раз",
    },
  },
  en: {
    "forgot-password": {
      title: "Recover your password",
      description: "Enter your account email. If an account exists, we will send a one-time password reset link.",
      endpoint: "/api/auth/forgot-password",
      submit: "Send reset link",
      success: "If an account exists, check its email for a password reset link.",
    },
    "resend-verification": {
      title: "Verify your email",
      description: "Enter your email if the verification message has not arrived or the link has expired.",
      endpoint: "/api/auth/resend-verification",
      submit: "Resend verification email",
      success: "If this address needs verification, check your email for a new verification link.",
    },
  },
};

function ErrorMessage({ error, locale = "ru" }: { error: unknown; locale?: Locale }) {
  if (!error) return null;
  let message = locale === "ru" ? "Не удалось выполнить запрос." : "Could not complete the request.";
  if (error instanceof ApiError) {
    if (locale === "ru") message = error.message;
    else if (error.status === 429) message = "Too many attempts. Wait a moment and try again.";
    else if (error.status === 422) message = "Check your email address and try again.";
    else if (error.status >= 500) message = "The service is temporarily unavailable. Try again later.";
  }
  return (
    <p className="form-error" role="alert">
      {message}
    </p>
  );
}

function EmailRequestForm({ mode, locale }: { mode: RequestMode; locale: Locale }) {
  const [email, setEmail] = useState("");
  const config = copy[locale][mode];
  const mutation = useMutation({
    mutationFn: () => apiRequest(config.endpoint, messageResponseSchema, {
      method: "POST",
      body: { email: email.trim() },
    }),
  });

  return (
    <AuthCard title={config.title} description={config.description} locale={locale}>
      {mutation.data ? (
        <>
          <p role="status">{locale === "en" ? copy.en[mode].success : mutation.data.message}</p>
          <Link href={localizedPath(locale, "/auth/login")}>{locale === "ru" ? "Вернуться ко входу" : "Back to login"}</Link>
        </>
      ) : (
        <form className="auth-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
          <label>
            Email
            <input
              autoComplete="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <ErrorMessage error={mutation.error} locale={locale} />
          <button className="button button-primary" disabled={mutation.isPending} type="submit">
            {mutation.isPending ? locale === "ru" ? "Подождите..." : "Please wait..." : config.submit}
          </button>
        </form>
      )}
    </AuthCard>
  );
}

function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const mutation = useMutation({
    mutationFn: () => apiRequest("/api/auth/reset-password", messageResponseSchema, {
      method: "POST",
      body: { token, new_password: password },
    }),
  });

  return (
    <AuthCard title="Новый пароль" description="Задайте новый пароль. После сброса все предыдущие сессии аккаунта будут отозваны.">
      {!token ? (
        <>
          <p className="form-error" role="alert">Ссылка для сброса пароля некорректна.</p>
          <Link href="/auth/forgot-password">Запросить новую ссылку</Link>
        </>
      ) : mutation.data ? (
        <>
          <p role="status">{mutation.data.message}</p>
          <Link className="button button-primary" href="/auth/login">Войти</Link>
        </>
      ) : (
        <form className="auth-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
          <label>
            Новый пароль
            <input
              autoComplete="new-password"
              minLength={10}
              name="new-password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <ErrorMessage error={mutation.error} />
          <button className="button button-primary" disabled={mutation.isPending} type="submit">
            {mutation.isPending ? "Подождите..." : "Изменить пароль"}
          </button>
        </form>
      )}
    </AuthCard>
  );
}

function VerifyEmailAction({ token }: { token: string }) {
  const request = useRef<Promise<{ message: string }> | null>(null);
  const [data, setData] = useState<{ message: string } | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    request.current ??= apiRequest("/api/auth/verify-email", messageResponseSchema, {
      method: "POST",
      body: { token },
    });
    void request.current.then(
      (result) => { if (active) setData(result); },
      (failure: unknown) => { if (active) setError(failure); },
    );
    return () => { active = false; };
  }, [token]);

  return (
    <AuthCard title="Подтверждение email" description="Проверяем одноразовую ссылку подтверждения.">
      {!token ? (
        <>
          <p className="form-error" role="alert">Ссылка подтверждения некорректна.</p>
          <Link href="/auth/resend-verification">Получить новую ссылку</Link>
        </>
      ) : !data && !error ? (
        <p role="status">Подтверждаем email...</p>
      ) : data ? (
        <>
          <p role="status">{data.message}</p>
          <Link className="button button-primary" href="/auth/login">Войти</Link>
        </>
      ) : (
        <>
          <ErrorMessage error={error} />
          <Link href="/auth/resend-verification">Получить новую ссылку</Link>
        </>
      )}
    </AuthCard>
  );
}

function AuthCard({ title, description, children, locale = "ru" }: { title: string; description: string; children: ReactNode; locale?: Locale }) {
  return (
    <AuthShell
      description={description}
      eyebrow={locale === "ru" ? "Аккаунт MPReply" : "MPReply account"}
      footer={<p className="auth-footer"><Link href={localizedPath(locale, "/auth/login")}>{locale === "ru" ? "Вернуться ко входу" : "Back to login"}</Link></p>}
      locale={locale}
      title={title}
    >
      <div className="auth-form">{children}</div>
    </AuthShell>
  );
}

export function AuthEmailFlow({ mode, locale = "ru" }: { mode: AuthEmailMode; locale?: Locale }) {
  if (mode === "reset-password" || mode === "verify-email") return <TokenEmailFlow mode={mode} />;
  return <EmailRequestForm key={`${locale}:${mode}`} mode={mode} locale={locale} />;
}

function TokenEmailFlow({ mode }: { mode: "reset-password" | "verify-email" }) {
  const token = useSearchParams().get("token") ?? "";
  return mode === "reset-password"
    ? <ResetPasswordForm key={token} token={token} />
    : <VerifyEmailAction key={token} token={token} />;
}

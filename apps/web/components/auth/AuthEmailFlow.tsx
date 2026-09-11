"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { ApiError, apiRequest } from "../../lib/api/client";
import { messageResponseSchema } from "../../lib/api/auth-schemas";

type AuthEmailMode = "forgot-password" | "resend-verification" | "reset-password" | "verify-email";

type RequestMode = "forgot-password" | "resend-verification";

const copy: Record<RequestMode, { title: string; description: string; endpoint: string; submit: string }> = {
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
};

function ErrorMessage({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p className="form-error" role="alert">
      {error instanceof ApiError ? error.message : "Не удалось выполнить запрос."}
    </p>
  );
}

function EmailRequestForm({ mode }: { mode: RequestMode }) {
  const [email, setEmail] = useState("");
  const config = copy[mode];
  const mutation = useMutation({
    mutationFn: () => apiRequest(config.endpoint, messageResponseSchema, {
      method: "POST",
      body: { email: email.trim() },
    }),
  });

  return (
    <AuthCard title={config.title} description={config.description}>
      {mutation.data ? (
        <>
          <p role="status">{mutation.data.message}</p>
          <Link href="/auth/login">Вернуться ко входу</Link>
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
          <ErrorMessage error={mutation.error} />
          <button className="button button-primary" disabled={mutation.isPending} type="submit">
            {mutation.isPending ? "Подождите..." : config.submit}
          </button>
        </form>
      )}
    </AuthCard>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
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

function VerifyEmailAction() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const started = useRef(false);
  const mutation = useMutation({
    mutationFn: () => apiRequest("/api/auth/verify-email", messageResponseSchema, {
      method: "POST",
      body: { token },
    }),
  });

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    mutation.mutate();
  }, [mutation, token]);

  return (
    <AuthCard title="Подтверждение email" description="Проверяем одноразовую ссылку подтверждения.">
      {!token ? (
        <>
          <p className="form-error" role="alert">Ссылка подтверждения некорректна.</p>
          <Link href="/auth/resend-verification">Получить новую ссылку</Link>
        </>
      ) : mutation.isPending || mutation.isIdle ? (
        <p role="status">Подтверждаем email...</p>
      ) : mutation.data ? (
        <>
          <p role="status">{mutation.data.message}</p>
          <Link className="button button-primary" href="/auth/login">Войти</Link>
        </>
      ) : (
        <>
          <ErrorMessage error={mutation.error} />
          <Link href="/auth/resend-verification">Получить новую ссылку</Link>
        </>
      )}
    </AuthCard>
  );
}

function AuthCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-email-title">
        <p className="eyebrow">MPReply account</p>
        <h1 id="auth-email-title">{title}</h1>
        <p className="auth-description">{description}</p>
        <div className="auth-form">{children}</div>
        <p className="auth-footer"><Link href="/auth/login">Вернуться ко входу</Link></p>
      </section>
    </main>
  );
}

export function AuthEmailFlow({ mode }: { mode: AuthEmailMode }) {
  if (mode === "reset-password") return <ResetPasswordForm />;
  if (mode === "verify-email") return <VerifyEmailAction />;
  return <EmailRequestForm mode={mode} />;
}

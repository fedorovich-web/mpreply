"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { ApiError, apiRequest } from "../../lib/api/client";
import { authSessionSchema } from "../../lib/api/schemas";

type AuthMode = "login" | "register";

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/auth/${mode}`, authSessionSchema, {
        method: "POST",
        body:
          mode === "register"
            ? { email: email.trim(), password, name: name.trim() || null }
            : { email: email.trim(), password },
      }),
    onSuccess: () => {
      const requestedNext = searchParams.get("next");
      const target = requestedNext?.startsWith("/app/") ? requestedNext : "/app/dashboard";
      router.replace(target);
      router.refresh();
    },
  });

  const isLogin = mode === "login";

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby={`${mode}-title`}>
        <p className="eyebrow">{isLogin ? "Рабочее пространство" : "Создание аккаунта"}</p>
        <h1 id={`${mode}-title`}>{isLogin ? "Вход" : "Создать аккаунт"}</h1>
        <p className="auth-description">
          {isLogin
            ? "Войдите, чтобы управлять автоответами, правилами, интеграциями и очередью ручной проверки."
            : "После регистрации создайте workspace и подключите Wildberries API-ключ. Автоответы будут включены по умолчанию."}
        </p>

        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          {!isLogin ? (
            <label>
              Имя
              <input
                autoComplete="name"
                maxLength={255}
                name="name"
                onChange={(event) => setName(event.target.value)}
                placeholder="Роман"
                type="text"
                value={name}
              />
            </label>
          ) : null}
          <label>
            Email
            <input
              autoComplete="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            Пароль
            <input
              autoComplete={isLogin ? "current-password" : "new-password"}
              minLength={isLogin ? 1 : 10}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder={isLogin ? "Ваш пароль" : "Минимум 10 символов"}
              required
              type="password"
              value={password}
            />
          </label>

          {mutation.error ? (
            <p className="form-error" role="alert">
              {mutation.error instanceof ApiError ? mutation.error.message : "Не удалось выполнить запрос."}
            </p>
          ) : null}

          <button className="button button-primary" disabled={mutation.isPending} type="submit">
            {mutation.isPending ? "Подождите..." : isLogin ? "Войти" : "Зарегистрироваться"}
          </button>
        </form>

        <p className="auth-footer">
          {isLogin ? (
            <>Нет аккаунта? <Link href="/auth/register">Создать аккаунт</Link></>
          ) : (
            <>Уже есть аккаунт? <Link href="/auth/login">Войти</Link></>
          )}
        </p>
      </section>
    </main>
  );
}

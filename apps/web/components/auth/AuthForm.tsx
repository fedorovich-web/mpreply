"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { ApiError, apiRequest } from "../../lib/api/client";
import { authSessionSchema } from "../../lib/api/schemas";

type AuthMode = "login" | "register";

const previewRows = [
  ["WB", "Анна К.", "Отличное качество, быстрая доставка!", "Готов к отправке"],
  ["OZ", "Дмитрий С.", "Подойдёт ли размер M на рост 174 см?", "На проверке"],
  ["М", "Елена М.", "Когда появится этот цвет?", "Черновик готов"],
] as const;

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
      <div className="auth-shell">
        <aside className="auth-product-panel" aria-label="Рабочее пространство MPReply">
          <Link className="auth-product-brand" href="/" aria-label="MPReply — главная">
            <span className="public-brand-mark" aria-hidden="true">M</span>
            <strong>MPReply</strong>
          </Link>

          <div className="auth-product-copy">
            <p className="eyebrow">Единое рабочее пространство</p>
            <h2>Обращения покупателей, ИИ-ответы и контроль команды — рядом</h2>
            <p>Wildberries, Ozon, Яндекс Маркет и Авито подключаются к одной очереди. Типовые сценарии можно автоматизировать, сложные — оставлять на проверку.</p>
          </div>

          <div className="auth-preview" aria-hidden="true">
            <div className="auth-preview-window">
              <div className="auth-preview-head">
                <div><span>MP</span><strong>Все обращения</strong></div>
                <small>единая очередь</small>
              </div>
              <div className="auth-preview-body">
                <div className="auth-preview-sidebar">
                  <strong>Очередь</strong>
                  <span>Все обращения</span>
                  <span>Отзывы</span>
                  <span>Вопросы</span>
                  <span>Сообщения</span>
                </div>
                <div className="auth-preview-queue">
                  {previewRows.map(([source, name, text, status], index) => (
                    <div className={`auth-preview-row${index === 0 ? " is-active" : ""}`} key={`${source}-${name}`}>
                      <span>{source}</span>
                      <div><strong>{name}</strong><p>{text}</p></div>
                      <small>{status}</small>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="auth-preview-draft">
              <div><span>✦</span><strong>Ответ с помощью ИИ</strong><small>черновик</small></div>
              <p>Спасибо за ваш отзыв! Рады, что товар вам понравился. Будем рады видеть вас снова.</p>
              <span className="auth-preview-draft-action">Дружелюбный&nbsp;&nbsp; · &nbsp;&nbsp;Готов к отправке</span>
            </div>
          </div>

          <div className="auth-marketplaces" aria-label="Поддерживаемые маркетплейсы">
            <span>WB</span><span>OZ</span><span>ЯМ</span><span>A</span>
            <small>4 готовые интеграции</small>
          </div>
        </aside>

        <section className="auth-form-panel" aria-labelledby={`${mode}-title`}>
          <div className="auth-card">
            <Link className="auth-brand" href="/" aria-label="MPReply — главная">
              <span className="public-brand-mark" aria-hidden="true">M</span>
              <strong>MPReply</strong>
            </Link>

            <p className="eyebrow">{isLogin ? "Рабочий кабинет" : "Новый аккаунт"}</p>
            <h1 id={`${mode}-title`}>{isLogin ? "Войти в MPReply" : "Создать аккаунт"}</h1>
            <p className="auth-description">
              {isLogin
                ? "Вернитесь к общей очереди, ответам на проверке, правилам автоматизации и подключённым площадкам."
                : "Создайте рабочее пространство, затем подключите Wildberries, Ozon, Яндекс Маркет или Авито и настройте правила обработки обращений."}
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
                    placeholder="Ваше имя"
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
                  {mutation.error instanceof ApiError ? mutation.error.message : "Не удалось выполнить запрос. Попробуйте ещё раз."}
                </p>
              ) : null}

              <button className="button button-primary" disabled={mutation.isPending} type="submit">
                {mutation.isPending ? "Подождите..." : isLogin ? "Войти" : "Продолжить"}
              </button>
            </form>

            <p className="auth-footer">
              {isLogin ? (
                <>Нет аккаунта? <Link href="/auth/register?intent=connect-marketplace">Создать аккаунт</Link></>
              ) : (
                <>Уже есть аккаунт? <Link href="/auth/login">Войти</Link></>
              )}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

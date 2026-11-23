"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ApiError, apiRequest } from "../../lib/api/client";
import { authSessionSchema, messageResponseSchema, userSchema } from "../../lib/api/schemas";
import { localizedPath, type Locale } from "../../lib/i18n";
import { getSiteConfig } from "../../lib/site-config";
import { PublicBrandMark } from "../public-site/PublicBrandMark";
import { YandexAuthButton, yandexErrorMessage } from "./YandexAuthButton";

type AuthMode = "login" | "register";

const copy = {
  ru: {
    workspace: "Рабочее пространство MPReply",
    home: "MPReply — главная",
    eyebrow: "Единое рабочее пространство",
    panelTitle: "Обращения покупателей, ИИ-ответы и контроль команды — рядом",
    panelText: "Wildberries, Ozon, Яндекс Маркет и Авито подключаются к одной очереди. Типовые сценарии можно автоматизировать, сложные — оставлять на проверку.",
    loginEyebrow: "Рабочий кабинет",
    registerEyebrow: "Новый аккаунт",
    loginTitle: "Войти в MPReply",
    registerTitle: "Создать аккаунт",
    loginDescription: "Вернитесь к общей очереди, ответам на проверке, правилам автоматизации и подключённым площадкам.",
    registerDescription: "Создайте рабочее пространство, затем подключите Wildberries, Ozon, Яндекс Маркет или Авито и настройте правила обработки обращений.",
    name: "Имя",
    namePlaceholder: "Ваше имя",
    password: "Пароль",
    loginPassword: "Ваш пароль",
    registerPassword: "Минимум 10 символов",
    pending: "Подождите...",
    login: "Войти",
    continue: "Продолжить",
    noAccount: "Нет аккаунта?",
    createAccount: "Создать аккаунт",
    haveAccount: "Уже есть аккаунт?",
    forgotPassword: "Забыли пароль?",
    resendVerification: "Отправить письмо подтверждения ещё раз",
    verificationSent: "Если адрес доступен для регистрации, мы отправили письмо для подтверждения email. Откройте ссылку в письме, затем войдите в MPReply.",
  },
  en: {
    workspace: "MPReply workspace",
    home: "MPReply — home",
    eyebrow: "One shared workspace",
    panelTitle: "Customer messages, AI-assisted replies, and team review in one place",
    panelText: "Connect Wildberries, Ozon, Yandex Market, and Avito to one queue. Automate routine scenarios and keep exceptions under team review.",
    loginEyebrow: "Workspace access",
    registerEyebrow: "New account",
    loginTitle: "Log in to MPReply",
    registerTitle: "Create your account",
    loginDescription: "Return to the shared queue, replies waiting for review, automation rules, and connected marketplaces.",
    registerDescription: "Create a workspace, connect Wildberries, Ozon, Yandex Market, or Avito, and set up how your team handles customer messages.",
    name: "Name",
    namePlaceholder: "Your name",
    password: "Password",
    loginPassword: "Your password",
    registerPassword: "At least 10 characters",
    pending: "Please wait...",
    login: "Log in",
    continue: "Continue",
    noAccount: "New to MPReply?",
    createAccount: "Create account",
    haveAccount: "Already have an account?",
    forgotPassword: "Forgot password?",
    resendVerification: "Resend verification email",
    verificationSent: "If this address is available for registration, we sent a link to verify your email. Open the link in the email, then log in to MPReply.",
  },
} as const;

export function AuthForm({ mode, locale = "ru" }: { mode: AuthMode; locale?: Locale }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const isLogin = mode === "login";
  const labels = copy[locale];
  const oauthError = yandexErrorMessage(searchParams.get("oauth_error"), locale);
  const pendingYandexLink = isLogin && searchParams.get("oauth_error") === "account_link_required";
  const requestedNext = searchParams.get("next");
  const intent = searchParams.get("intent");
  const appPrefix = locale === "en" ? "/en/app/" : "/app/";
  const appRoot = locale === "en" ? "/en/app" : "/app";
  const publicHome = getSiteConfig(locale).origin + localizedPath(locale, "/");

  const safeRequestedNext = requestedNext?.startsWith(appPrefix) ? requestedNext : null;
  const target = safeRequestedNext
    ?? (intent === "connect-marketplace" ? `${appRoot}/integrations` : `${appRoot}/dashboard`);
  const shouldCheckSession = isLogin && !searchParams.has("oauth_error");
  const session = useQuery({
    queryKey: ["auth", "login-session"],
    queryFn: ({ signal }) => apiRequest("/api/auth/me", userSchema, { signal }),
    enabled: shouldCheckSession,
    refetchOnMount: "always",
    retry: false,
  });
  const shouldResumeSession = shouldCheckSession && session.isFetchedAfterMount
    && session.isSuccess && session.data.status === "active";
  useEffect(() => {
    if (shouldResumeSession) router.replace(target);
  }, [router, shouldResumeSession, target]);


  const alternateAuthHref = (() => {
    const query = new URLSearchParams();
    if (safeRequestedNext) query.set("next", safeRequestedNext);
    if (intent === "connect-marketplace") query.set("intent", "connect-marketplace");
    const queryString = query.toString();
    const path = localizedPath(locale, isLogin ? "/auth/register" : "/auth/login");
    return queryString ? `${path}?${queryString}` : path;
  })();

  const mutation = useMutation({
    mutationFn: async () => {
      const options = {
        method: "POST",
        body:
          mode === "register"
            ? { email: email.trim(), password, name: name.trim() || null }
            : { email: email.trim(), password },
      };
      if (!isLogin) return apiRequest(`/api/auth/${mode}`, messageResponseSchema, options);
      await apiRequest(`/api/auth/${mode}`, authSessionSchema, options);
      if (!pendingYandexLink) return { yandexLinkFailed: false };
      try {
        await apiRequest("/api/auth/yandex/link/complete", messageResponseSchema, { method: "POST" });
        return { yandexLinkFailed: false };
      } catch {
        return { yandexLinkFailed: true };
      }
    },
    onSuccess: (result) => {
      if (!isLogin) {
        setPassword("");
        return;
      }
      if ("yandexLinkFailed" in result && result.yandexLinkFailed) {
        router.replace(`${appRoot}/account?oauth_error=link_retry_required`);
        router.refresh();
        return;
      }
      router.replace(target);
      router.refresh();
    },
  });

  if (shouldResumeSession || (shouldCheckSession && !session.isFetchedAfterMount && session.isFetching)) {
    return (
      <main className="auth-page" aria-busy="true">
        <div className="auth-card"><p role="status">{labels.pending}</p></div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <aside className="auth-product-panel" aria-label={labels.workspace}>
          <Link className="auth-product-brand" href={publicHome} aria-label={labels.home}>
            <PublicBrandMark />
          </Link>

          <div className="auth-product-copy">
            <p className="eyebrow">{labels.eyebrow}</p>
            <h2>{labels.panelTitle}</h2>
            <p>{labels.panelText}</p>
          </div>

        </aside>

        <section className="auth-form-panel" aria-labelledby={`${mode}-title`}>
          <div className="auth-card">
            <Link className="auth-brand" href={publicHome} aria-label={labels.home}>
              <PublicBrandMark />
            </Link>

            <p className="eyebrow">{isLogin ? labels.loginEyebrow : labels.registerEyebrow}</p>
            <h1 id={`${mode}-title`}>{isLogin ? labels.loginTitle : labels.registerTitle}</h1>
            <p className="auth-description">
              {isLogin ? labels.loginDescription : labels.registerDescription}
            </p>

            {!isLogin && mutation.isSuccess ? (
              <p className="auth-description" role="status">{labels.verificationSent}</p>
            ) : (
              <form
                className="auth-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  mutation.mutate();
                }}
              >
                {!isLogin ? (
                  <label>
                    {labels.name}
                    <input
                      autoComplete="name"
                      maxLength={255}
                      name="name"
                      onChange={(event) => setName(event.target.value)}
                      placeholder={labels.namePlaceholder}
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
                  {labels.password}
                  <input
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    minLength={isLogin ? 1 : 10}
                    name="password"
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={isLogin ? labels.loginPassword : labels.registerPassword}
                    required
                    type="password"
                    value={password}
                  />
                </label>

                {mutation.error ? (
                  <p className="form-error" role="alert">
                    {pendingYandexLink && mutation.error instanceof ApiError && mutation.error.status === 409
                      ? locale === "ru" ? "Подтверждение Яндекса истекло или выбран другой аккаунт. Нажмите «Войти через Яндекс» и повторите вход." : "Yandex confirmation expired or belongs to another account. Start Yandex sign-in again."
                      : authErrorMessage(mutation.error, isLogin, locale)}
                  </p>
                ) : null}

                <button className="button button-primary" disabled={mutation.isPending} type="submit">
                  {mutation.isPending ? labels.pending : pendingYandexLink
                    ? locale === "ru" ? "Подтвердить и связать Яндекс" : "Confirm and link Yandex"
                    : isLogin ? labels.login : labels.continue}
                </button>
              </form>
            )}

            {isLogin ? (
              <p className="auth-footer"><Link href={localizedPath(locale, "/auth/forgot-password")}>{labels.forgotPassword}</Link></p>
            ) : null}
            <p className="auth-footer"><Link href={localizedPath(locale, "/auth/resend-verification")}>{labels.resendVerification}</Link></p>
            {oauthError ? <p className="form-error" role="alert">{oauthError}</p> : null}
            <YandexAuthButton locale={locale} next={safeRequestedNext} intent={intent} />
            <p className="auth-footer">
              {isLogin ? (
                <>{labels.noAccount} <Link href={alternateAuthHref}>{labels.createAccount}</Link></>
              ) : (
                <>{labels.haveAccount} <Link href={alternateAuthHref}>{labels.login}</Link></>
              )}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function authErrorMessage(error: unknown, isLogin: boolean, locale: Locale): string {
  if (locale === "en") {
    if (error instanceof ApiError) {
      if (error.status === 401) return isLogin ? "Incorrect email or password." : "We could not create an account with these details.";
      if (!isLogin && (error.status === 400 || error.status === 409)) return "An account with this email already exists. Log in or use another address.";
      if (error.status === 422) return "Check the email, password, and other form fields.";
      if (error.status === 429) return "Too many attempts. Wait a moment and try again.";
      if (error.status >= 500) return "The service is temporarily unavailable. Try again later.";
    }
    return isLogin
      ? "Could not log in. Check your connection and try again."
      : "Could not create the account. Check your connection and try again.";
  }

  if (error instanceof ApiError) {
    if (error.status === 401) return isLogin ? "Неверный email или пароль." : "Не удалось создать аккаунт с этими данными.";
    if (!isLogin && (error.status === 400 || error.status === 409)) return "Аккаунт с таким email уже существует. Войдите или используйте другой адрес.";
    if (error.status === 422) return "Проверьте email, пароль и остальные поля формы.";
    if (error.status === 429) return "Слишком много попыток подряд. Подождите немного и попробуйте снова.";
    if (error.status >= 500) return "Сервис временно недоступен. Попробуйте ещё раз позже.";
  }

  return isLogin
    ? "Не удалось войти. Проверьте соединение и попробуйте снова."
    : "Не удалось создать аккаунт. Проверьте соединение и попробуйте снова.";
}

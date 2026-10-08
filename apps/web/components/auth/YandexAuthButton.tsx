"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { apiRequest, buildApiQuery, buildApiUrl } from "../../lib/api/client";
import { authProvidersSchema } from "../../lib/api/schemas";
import type { Locale } from "../../lib/i18n";

export function YandexAuthButton({ locale, next, intent }: { locale: Locale; next?: string | null; intent?: string | null }) {
  const providers = useQuery({ queryKey: ["auth", "providers"], queryFn: () => apiRequest("/api/auth/providers", authProvidersSchema), retry: false, staleTime: 60000 });
  if (!providers.data?.yandex) return null;
  return <a className="button button-secondary auth-yandex-button" href={buildApiUrl(buildApiQuery("/api/auth/yandex/start", {
    locale, next, intent: intent === "connect-marketplace" ? intent : null,
  }))}><Image className="auth-yandex-icon" src="/images/brands/yandex-id.svg" width={24} height={24} alt="" aria-hidden="true" />
    <span>{locale === "ru" ? "Войти через Яндекс" : "Continue with Yandex"}</span></a>;
}

export function yandexErrorMessage(code: string | null, locale: Locale): string | null {
  if (!code) return null;
  if (code === "account_link_required") return locale === "ru"
    ? "На этот email уже есть аккаунт MPReply. Подтвердите вход паролем этого аккаунта — Яндекс подключится автоматически."
    : "An MPReply account already uses this email. Confirm its password to link Yandex automatically.";
  if (code === "email_required") return locale === "ru" ? "Яндекс не передал email. Зарегистрируйтесь по электронной почте." : "Yandex did not provide an email. Register with your email address.";
  if (code === "identity_conflict") return locale === "ru" ? "Этот Яндекс ID уже связан с другим аккаунтом." : "This Yandex ID is already linked to another account.";
  return locale === "ru" ? "Не удалось войти через Яндекс. Повторите попытку или войдите по email." : "Could not sign in with Yandex. Try again or use email.";
}

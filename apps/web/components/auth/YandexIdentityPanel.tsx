"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "../../lib/api/client";
import { authIdentitiesSchema, authorizationUrlSchema } from "../../lib/api/schemas";
import { localizedPath } from "../../lib/i18n";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { yandexErrorMessage } from "./YandexAuthButton";

export function YandexIdentityPanel() {
  const { user, locale } = useWorkspace();
  const ru = locale === "ru";
  const params = useSearchParams();
  const query = useQuery({ queryKey: ["auth", "identities", user.id], queryFn: () => apiRequest("/api/auth/identities", authIdentitiesSchema), retry: false });
  const link = useMutation({
    mutationFn: () => apiRequest("/api/auth/yandex/link/start", authorizationUrlSchema, { method: "POST", body: { locale, next: localizedPath(locale, "/app/account") } }),
    onSuccess: ({ authorization_url }) => window.location.assign(authorization_url),
  });
  const oauthError = yandexErrorMessage(params.get("oauth_error"), locale);
  return <section className="billing-section" aria-labelledby="yandex-identity-title">
    <h2 id="yandex-identity-title">{ru ? "Вход через Яндекс" : "Yandex sign-in"}</h2>
    <p>{ru ? "Свяжите свой Яндекс ID, чтобы входить без пароля MPReply. Электронная почта аккаунта останется прежней." : "Link your Yandex ID to sign in without your MPReply password. Your account email will stay the same."}</p>
    {user.status === "demo" ? <p>{ru ? "В демо нельзя связывать аккаунты." : "Account linking is unavailable in the demo."}</p>
      : query.isPending ? <p role="status">{ru ? "Проверяем способы входа…" : "Checking sign-in methods…"}</p>
        : query.error ? <p role="alert">{ru ? "Не удалось получить способы входа." : "Could not load sign-in methods."} <button className="button button-secondary" onClick={() => void query.refetch()} type="button">{ru ? "Повторить" : "Retry"}</button></p>
          : query.data?.yandex_linked ? <p role="status">{ru ? "Яндекс подключён" : "Yandex is linked"}</p>
            : query.data?.can_link_yandex ? <button className="button button-secondary" disabled={link.isPending} onClick={() => link.mutate()} type="button">{link.isPending ? (ru ? "Открываем Яндекс…" : "Opening Yandex…") : (ru ? "Связать Яндекс" : "Link Yandex")}</button>
              : <p>{ru ? "Связывание с Яндексом пока недоступно." : "Yandex linking is currently unavailable."}</p>}
    {oauthError || link.error ? <p className="form-error" role="alert">{oauthError ?? (ru ? "Не удалось открыть Яндекс. Повторите попытку." : "Could not open Yandex. Please try again.")}</p> : null}
  </section>;
}

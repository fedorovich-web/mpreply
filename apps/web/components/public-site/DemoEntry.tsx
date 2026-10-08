"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { apiRequest } from "../../lib/api/client";
import { authSessionSchema } from "../../lib/api/schemas";
import { localizedPath, type Locale } from "../../lib/i18n";
import { PublicBrandMark } from "./PublicBrandMark";

const copy = {
  ru: {
    home: "На главную",
    title: "Открываем демо-кабинет MPReply",
    description: "Вы перейдёте в настоящий интерфейс сервиса с демонстрационными обращениями. Доступ только для просмотра: добавить ключи, изменить данные или отправить ответ нельзя.",
    pending: "Подготавливаем демо-кабинет…",
    failed: "Не удалось открыть демо-кабинет. Повторите попытку.",
    retry: "Повторить",
  },
  en: {
    home: "Back to home",
    title: "Opening the MPReply demo workspace",
    description: "You will enter the real product interface with sample messages. Access is view-only: you cannot add keys, change data, or send a reply.",
    pending: "Preparing the demo workspace…",
    failed: "Could not open the demo workspace. Please try again.",
    retry: "Try again",
  },
} as const;

export function DemoEntry({ locale }: { locale: Locale }) {
  const router = useRouter();
  const labels = copy[locale];
  const started = useRef(false);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(true);

  const open = useCallback(async () => {
    setError(false);
    setPending(true);
    try {
      await apiRequest("/api/auth/demo", authSessionSchema, { method: "POST" });
      router.replace(localizedPath(locale, "/app/dashboard"));
      router.refresh();
    } catch {
      setError(true);
      setPending(false);
    }
  }, [locale, router]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void open();
  }, [open]);

  return (
    <main className="demo-entry-page">
      <section className="demo-entry-card" aria-labelledby="demo-entry-title">
        <Link className="demo-entry-brand" href={localizedPath(locale, "/")} aria-label={labels.home}><PublicBrandMark /></Link>
        <h1 id="demo-entry-title">{labels.title}</h1>
        <p>{labels.description}</p>
        {error ? <div className="demo-entry-error" role="alert"><p>{labels.failed}</p><button className="button button-primary" type="button" onClick={() => void open()}>{labels.retry}</button></div> : null}
        {pending ? <p className="demo-entry-pending" role="status">{labels.pending}</p> : null}
        <Link className="demo-entry-home" href={localizedPath(locale, "/")}>{labels.home}</Link>
      </section>
    </main>
  );
}

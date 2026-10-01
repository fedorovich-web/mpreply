"use client";

import { useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import Link from "next/link";

import { ApiError, apiRequest } from "../../lib/api/client";
import { localizedPath, type Locale } from "../../lib/i18n";
import { useClientReady } from "../../lib/use-client-ready";

const responseSchema = z.object({ message: z.string() });

const copy = {
  ru: {
    name: "Ваше имя *",
    email: "Рабочая почта *",
    topic: "Тема обращения *",
    message: "Ваше сообщение *",
    placeholder: "Расскажите, чем мы можем помочь...",
    consent: "Я согласен на обработку персональных данных",
    privacy: "Политика конфиденциальности",
    invalid: "Проверьте поля: имя — от 2 до 120 символов, сообщение — от 10 до 5 000 символов. Укажите почту и подтвердите согласие.",
    limited: "Слишком много обращений. Попробуйте отправить позже.",
    submit: "Отправить сообщение",
    sending: "Отправляем…",
    sent: "Сообщение отправлено.",
    error: "Не удалось отправить сообщение. Повторите попытку или напишите нам на",
    topics: ["Техническая поддержка", "Запросить демо", "Партнёрство", "Общий вопрос"],
  },
  en: {
    name: "Your name *",
    email: "Work email *",
    topic: "What can we help with? *",
    message: "Your message *",
    placeholder: "Tell us what you would like help with...",
    consent: "I agree to the processing of my personal data",
    privacy: "Privacy policy",
    invalid: "Check the fields: name must be 2–120 characters and message 10–5,000 characters. Enter your email and confirm consent.",
    limited: "Too many requests. Please try again later.",
    submit: "Send message",
    sending: "Sending…",
    sent: "Message sent.",
    error: "We couldn't send your message. Try again or email us at",
    topics: ["Technical support", "Request a demo", "Partnership", "General question"],
  },
} as const;

const topicValues = ["support", "demo", "partnership", "general"] as const;
const submissionSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(254),
  topic: z.enum(topicValues),
  message: z.string().trim().min(10).max(5000),
  consent: z.literal(true),
});

export function ContactMailForm({
  supportEmail,
  locale = "ru",
}: {
  supportEmail: string;
  locale?: Locale;
}) {
  const labels = copy[locale];
  const clientReady = useClientReady();
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const disabled = !clientReady || state === "sending";
  const requestKey = useRef<{ body: string; key: string } | null>(null);
  const inFlight = useRef(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const topic = String(data.get("topic") ?? "general");
    const message = String(data.get("message") ?? "").trim();
    const parsed = submissionSchema.safeParse({ name, email, topic, message, consent: data.get("consent") === "on" });
    if (!parsed.success) {
      setErrorText(labels.invalid);
      setState("error");
      return;
    }
    const body = JSON.stringify(parsed.data);
    if (requestKey.current?.body !== body) requestKey.current = { body, key: crypto.randomUUID() };
    inFlight.current = true;
    setErrorText(null);
    setState("sending");
    try {
      await apiRequest("/api/contact", responseSchema, {
        method: "POST",
        body: { ...parsed.data, idempotency_key: requestKey.current.key },
      });
      requestKey.current = null;
      form.reset();
      setState("sent");
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) setErrorText(labels.limited);
      if (error instanceof ApiError && error.status === 422) setErrorText(labels.invalid);
      setState("error");
    } finally {
      inFlight.current = false;
    }
  };

  return (
    <form className="contacts-render-form" id="contact-form" method="post" onSubmit={handleSubmit} aria-busy={state === "sending"}>
      <div className="contacts-render-form-grid">
        <label>
          <span>{labels.name}</span>
          <input name="name" autoComplete="name" minLength={2} maxLength={120} disabled={disabled} required />
        </label>
        <label>
          <span>{labels.email}</span>
          <input name="email" type="email" autoComplete="email" maxLength={254} disabled={disabled} required />
        </label>
      </div>

      <label>
        <span>{labels.topic}</span>
        <select name="topic" defaultValue="support" disabled={disabled}>
          {labels.topics.map((topic, index) => <option key={topicValues[index]} value={topicValues[index]}>{topic}</option>)}
        </select>
      </label>

      <label>
        <span>{labels.message}</span>
        <textarea name="message" rows={6} minLength={10} maxLength={5000} placeholder={labels.placeholder} disabled={disabled} required />
      </label>

      <div className="contacts-render-form-footer">
        <label className="contacts-render-consent">
          <input name="consent" type="checkbox" disabled={disabled} required />
          <span>{labels.consent}</span>
        </label>
        <button className="button button-primary" type="submit" disabled={disabled}>
          {state === "sending" ? labels.sending : labels.submit}
        </button>
      </div>
      <Link className="contacts-render-privacy-link" href={localizedPath(locale, "/privacy")}>{labels.privacy}</Link>
      {state === "sent" ? <p className="contacts-render-mail-hint" role="status">{labels.sent}</p> : null}
      {state === "error" ? <p className="contacts-render-mail-hint" role="alert">{errorText ?? <>{labels.error} <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.</>}</p> : null}
    </form>
  );
}

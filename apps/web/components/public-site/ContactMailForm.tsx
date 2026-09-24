"use client";

import type { FormEvent } from "react";

import type { Locale } from "../../lib/i18n";

const copy = {
  ru: {
    name: "Ваше имя *",
    email: "Рабочая почта *",
    topic: "Тема обращения *",
    message: "Ваше сообщение *",
    placeholder: "Расскажите, чем мы можем помочь...",
    consent: "Я согласен на обработку персональных данных",
    submit: "Подготовить письмо",
    hint: "Откроется ваше почтовое приложение с письмом на",
    replyEmail: "Email для ответа",
    topicLabel: "Тема",
    topics: ["Техническая поддержка", "Запросить демо", "Партнёрство", "Общий вопрос"],
  },
  en: {
    name: "Your name *",
    email: "Work email *",
    topic: "What can we help with? *",
    message: "Your message *",
    placeholder: "Tell us what you would like help with...",
    consent: "I agree to the processing of my personal data",
    submit: "Prepare email",
    hint: "Your email app will open with a message addressed to",
    replyEmail: "Reply email",
    topicLabel: "Topic",
    topics: ["Technical support", "Request a demo", "Partnership", "General question"],
  },
} as const;

export function ContactMailForm({
  supportEmail,
  locale = "ru",
}: {
  supportEmail: string;
  locale?: Locale;
}) {
  const labels = copy[locale];

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const topic = String(data.get("topic") ?? labels.topics[3]).trim();
    const message = String(data.get("message") ?? "").trim();

    const subject = `MPReply: ${topic}`;
    const body = [
      `${labels.name.replace(" *", "")}: ${name}`,
      `${labels.replyEmail}: ${email}`,
      `${labels.topicLabel}: ${topic}`,
      "",
      message,
    ].join("\n");

    window.location.href = `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <form className="contacts-render-form" onSubmit={handleSubmit}>
      <div className="contacts-render-form-grid">
        <label>
          <span>{labels.name}</span>
          <input name="name" autoComplete="name" required />
        </label>
        <label>
          <span>{labels.email}</span>
          <input name="email" type="email" autoComplete="email" required />
        </label>
      </div>

      <label>
        <span>{labels.topic}</span>
        <select name="topic" defaultValue={labels.topics[0]} required>
          {labels.topics.map((topic) => <option key={topic}>{topic}</option>)}
        </select>
      </label>

      <label>
        <span>{labels.message}</span>
        <textarea name="message" rows={6} placeholder={labels.placeholder} required />
      </label>

      <div className="contacts-render-form-footer">
        <label className="contacts-render-consent">
          <input type="checkbox" required />
          <span>{labels.consent}</span>
        </label>
        <button className="button button-primary" type="submit">
          {labels.submit} <span aria-hidden="true">→</span>
        </button>
      </div>
      <p className="contacts-render-mail-hint">{labels.hint} {supportEmail}.</p>
    </form>
  );
}

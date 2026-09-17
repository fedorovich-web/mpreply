"use client";

import type { FormEvent } from "react";

export function ContactMailForm({ supportEmail }: { supportEmail: string }) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const topic = String(data.get("topic") ?? "Общий вопрос").trim();
    const message = String(data.get("message") ?? "").trim();

    const subject = `MPReply: ${topic}`;
    const body = [
      `Имя: ${name}`,
      `Email для ответа: ${email}`,
      `Тема: ${topic}`,
      "",
      message,
    ].join("\n");

    window.location.href = `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <form className="contacts-render-form" onSubmit={handleSubmit}>
      <div className="contacts-render-form-grid">
        <label>
          <span>Ваше имя *</span>
          <input name="name" autoComplete="name" required />
        </label>
        <label>
          <span>Рабочая почта *</span>
          <input name="email" type="email" autoComplete="email" required />
        </label>
      </div>

      <label>
        <span>Тема обращения *</span>
        <select name="topic" defaultValue="Техническая поддержка" required>
          <option>Техническая поддержка</option>
          <option>Запросить демо</option>
          <option>Партнёрство</option>
          <option>Общий вопрос</option>
        </select>
      </label>

      <label>
        <span>Ваше сообщение *</span>
        <textarea name="message" rows={6} placeholder="Расскажите, чем мы можем помочь..." required />
      </label>

      <div className="contacts-render-form-footer">
        <label className="contacts-render-consent">
          <input type="checkbox" required />
          <span>Я согласен на обработку персональных данных</span>
        </label>
        <button className="button button-primary" type="submit">
          Подготовить письмо <span aria-hidden="true">→</span>
        </button>
      </div>
      <p className="contacts-render-mail-hint">Откроется ваше почтовое приложение с письмом на {supportEmail}.</p>
    </form>
  );
}

import type { Metadata } from "next";

import { PublicShell } from "../../components/public-site/PublicShell";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Материалы Respio об автоматизации отзывов и вопросов",
  description:
    "Краткие практические разборы Respio: auto-first, SafetyGate, marketplace adapters, повторные попытки, идемпотентность и защита API-ключей.",
  path: "/resources",
});

const notes = [
  {
    title: "Auto-first без слепой автоотправки",
    text: "Автоматический режим имеет смысл только тогда, когда система умеет отличить нормальный случай от исключения. Поэтому перед отправкой Respio проверяет контекст, риск и правила компании.",
    takeaway: "Автоматизировать норму. Эскалировать исключение.",
  },
  {
    title: "Почему одного prompt недостаточно",
    text: "Даже сильная модель не должна самостоятельно решать вопросы о гарантиях, возвратах, компенсациях или недостающих характеристиках товара. Нужны формальные ограничения и причины остановки.",
    takeaway: "ИИ готовит ответ; система решает, можно ли его отправлять.",
  },
  {
    title: "Marketplace adapter как архитектурная граница",
    text: "Wildberries, Ozon, Яндекс Маркет и Авито отличаются авторизацией, payload, ошибками и лимитами. Эти различия должны оставаться внутри отдельного adapter, а не проникать во все сервисы.",
    takeaway: "Новая интеграция не должна порождать параллельную архитектуру.",
  },
  {
    title: "Повторная попытка — не то же самое, что дубль",
    text: "Временная ошибка API может требовать retry. Но повторная задача не должна публиковать второй ответ на то же обращение. Для этого нужны ключи идемпотентности и проверка текущего состояния.",
    takeaway: "Повторять безопасно, не дублировать действие.",
  },
  {
    title: "Почему статус должен объяснять, что произошло",
    text: "Пользователю недостаточно увидеть «ошибка». Важно понять: отправка не началась, ждёт повторной попытки, остановлена SafetyGate или требует ручного решения.",
    takeaway: "Каждая ошибка должна превращаться в понятное состояние и следующее действие.",
  },
  {
    title: "API-ключи не должны попадать в браузер",
    text: "Ключи маркетплейсов хранятся и используются только на сервере, шифруются в базе и не возвращаются в обычных ответах API или журналах в открытом виде.",
    takeaway: "Секрет нужен интеграции, но не интерфейсу пользователя.",
  },
];

export default function ResourcesPage() {
  return (
    <PublicShell>
      <section className="public-subhero public-subhero-resources">
        <div className="public-container public-subhero-grid">
          <div className="public-subhero-copy">
            <p className="eyebrow">Материалы</p>
            <h1>Как устроить автоматизацию ответов без скрытой магии и слепой отправки</h1>
            <p className="public-lead">
              Короткие практические разборы архитектуры, риска и операционной надёжности. Без выдуманных кейсов, цифр и неподтверждённых обещаний.
            </p>
          </div>

          <aside className="resource-intro-panel">
            <span className="panel-kicker">Редакционный принцип</span>
            <strong>Сначала полезное содержание — потом поисковый трафик</strong>
            <p>Материал появляется только тогда, когда действительно отвечает на вопрос продавца или команды поддержки.</p>
          </aside>
        </div>
      </section>

      <div className="public-section">
        <div className="public-container resource-note-list">
          {notes.map((note) => (
            <article className="resource-note" key={note.title}>
              <div className="resource-note-copy">
                <h2>{note.title}</h2>
                <p>{note.text}</p>
              </div>
              <blockquote>{note.takeaway}</blockquote>
            </article>
          ))}
        </div>
      </div>
    </PublicShell>
  );
}

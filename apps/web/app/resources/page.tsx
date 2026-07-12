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
    number: "01",
    title: "Auto-first без слепой автоотправки",
    text: "Автоматический режим имеет смысл только тогда, когда система умеет отличить нормальный случай от исключения. Поэтому перед отправкой Respio проверяет контекст, риск и правила компании.",
    takeaway: "Автоматизировать норму. Эскалировать исключение.",
  },
  {
    number: "02",
    title: "Почему одного prompt недостаточно",
    text: "Даже сильная модель не должна самостоятельно решать вопросы о гарантиях, возвратах, компенсациях или недостающих характеристиках товара. Нужны формальные ограничения и причины остановки.",
    takeaway: "AI готовит ответ; система решает, можно ли его отправлять.",
  },
  {
    number: "03",
    title: "Marketplace adapter как архитектурная граница",
    text: "Wildberries, Ozon, Яндекс Маркет и Авито отличаются авторизацией, payload, ошибками и лимитами. Эти различия должны оставаться внутри отдельного adapter, а не проникать во все сервисы.",
    takeaway: "Новая интеграция не должна порождать параллельную архитектуру.",
  },
  {
    number: "04",
    title: "Повторная попытка — не то же самое, что дубль",
    text: "Временная ошибка API может требовать retry. Но повторная задача не должна публиковать второй ответ на то же обращение. Для этого нужны ключи идемпотентности и проверка текущего состояния.",
    takeaway: "Повторять безопасно, не дублировать действие.",
  },
  {
    number: "05",
    title: "Почему статус должен объяснять, что произошло",
    text: "Пользователю недостаточно увидеть «ошибка». Важно понять: отправка не началась, ждёт повторной попытки, остановлена SafetyGate или требует ручного решения.",
    takeaway: "Каждая ошибка должна превращаться в понятное состояние и следующее действие.",
  },
  {
    number: "06",
    title: "API-ключи не должны попадать во frontend",
    text: "Marketplace credentials хранятся и используются только на backend, шифруются в базе и не возвращаются в обычные API-ответы или логи в открытом виде.",
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
            <article className="resource-note" key={note.number}>
              <span className="resource-note-index">{note.number}</span>
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

import { InboxWorkspace } from "../../../components/inbox/InboxWorkspace";

export default function InboxPage() {
  return (
    <section className="app-page app-page-wide inbox-page">
      <header className="app-header inbox-page-header">
        <h1>Обращения</h1>
        <p>
          Фильтруйте очередь по площадке, типу, статусу, оценке и ответственному — контекст и следующий шаг остаются рядом.
        </p>
      </header>

      <InboxWorkspace />
    </section>
  );
}

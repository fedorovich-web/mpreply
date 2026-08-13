import { InboxWorkspace } from "../../../components/inbox/InboxWorkspace";

export default function InboxPage() {
  return (
    <section className="app-page app-page-wide">
      <header className="app-header">
        <h1>Отзывы, вопросы и чаты</h1>
        <p>Все сообщения покупателей и подготовленные ответы в одной очереди.</p>
      </header>

      <InboxWorkspace />
    </section>
  );
}

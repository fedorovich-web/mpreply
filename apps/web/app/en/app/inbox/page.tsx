import { InboxWorkspace } from "../../../../components/inbox/InboxWorkspace";

export default function EnglishInboxPage() {
  return (
    <section className="app-page app-page-wide inbox-page">
      <header className="app-header inbox-page-header">
        <h1>Messages</h1>
        <p>
          Filter the queue by marketplace, message type, status, rating, or assignee while keeping context and the next action together.
        </p>
      </header>

      <InboxWorkspace />
    </section>
  );
}

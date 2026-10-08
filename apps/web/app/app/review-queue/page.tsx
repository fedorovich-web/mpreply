import { ReviewQueueWorkspace } from "../../../components/review-queue/ReviewQueueWorkspace";

export default function ReviewQueuePage() {
  return (
    <section className="app-page app-page-wide review-queue-page">
      <header className="app-header review-queue-page-header">
        <h1>На проверке</h1>
        <p>
          Проверяйте ответы, которым нужно решение: обращение, товар и причина остановки остаются рядом с текстом ответа.
        </p>
      </header>

      <ReviewQueueWorkspace />
    </section>
  );
}

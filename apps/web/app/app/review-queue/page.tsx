import { ReviewQueueWorkspace } from "../../../components/review-queue/ReviewQueueWorkspace";

export default function ReviewQueuePage() {
  return (
    <section className="app-page app-page-wide">
      <header className="app-header">
        <h1>Ответы на проверке</h1>
        <p>Проверьте спорные или чувствительные ответы перед отправкой покупателю.</p>
      </header>

      <ReviewQueueWorkspace />
    </section>
  );
}

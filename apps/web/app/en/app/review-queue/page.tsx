import { ReviewQueueWorkspace } from "../../../../components/review-queue/ReviewQueueWorkspace";

export default function EnglishReviewQueuePage() {
  return (
    <section className="app-page app-page-wide review-queue-page">
      <header className="app-header review-queue-page-header">
        <h1>Needs review</h1>
        <p>
          Review replies that need a decision while keeping the customer message, product context, and reason for attention next to the reply text.
        </p>
      </header>

      <ReviewQueueWorkspace />
    </section>
  );
}

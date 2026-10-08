import type { CustomerMessage } from "../../lib/api/schemas";

function evidenceUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname && !url.username && !url.password && (!url.port || url.port === "443")
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function selectedDeficiencies(message: CustomerMessage): string[] {
  if (message.marketplace !== "wildberries" || message.type !== "review") return [];
  const value = message.metadata_json.review_deficiencies;
  return Array.isArray(value) && value.length <= 20 && value.every((item) => typeof item === "string" && item.length > 0 && item.length <= 100)
    ? value as string[]
    : [];
}

export function reviewPreview(message: CustomerMessage): string {
  if (message.customer_text) return message.customer_text;
  if (message.marketplace === "avito" && message.type === "review") return "Текст отзыва не передан Авито.";
  if (message.marketplace !== "wildberries" || message.type !== "review") return "";
  const parts = [
    message.customer_photos_json.some((photo) => evidenceUrl(photo)) ? "Фото" : null,
    evidenceUrl(message.metadata_json.review_video_url) ? "Видео" : null,
    selectedDeficiencies(message).length ? "Недостатки" : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Текст отзыва не передан Wildberries.";
}

export function ReviewEvidence({ message }: { message: CustomerMessage }) {
  const photos = message.customer_photos_json.map(evidenceUrl).filter((url): url is string => url !== null);
  const videoUrl = message.marketplace === "wildberries" && message.type === "review"
    ? evidenceUrl(message.metadata_json.review_video_url)
    : null;
  const deficiencies = selectedDeficiencies(message);
  const fallback = message.marketplace === "avito" && message.type === "review"
    ? "Текст отзыва не передан Авито."
    : message.marketplace === "wildberries" && message.type === "review"
      ? "Текст отзыва не передан Wildberries."
      : message.type === "review"
        ? "Текст отзыва не передан маркетплейсом."
        : "Текст обращения не передан маркетплейсом.";

  return (
    <div className="review-evidence">
      <p>{message.customer_text || fallback}</p>
      {deficiencies.length ? (
        <div>
          <span>Выбранные недостатки</span>
          <ul className="history-list">{deficiencies.map((item, index) => <li key={`${index}:${item}`}>{item}</li>)}</ul>
        </div>
      ) : null}
      {photos.length ? (
        <div>
          <span>Фото покупателя</span>
          <ul className="history-list">
            {photos.map((url, index) => <li key={`${index}:${url}`}><a href={url} rel="noopener noreferrer" target="_blank">Фото {index + 1}</a></li>)}
          </ul>
        </div>
      ) : null}
      {videoUrl ? <a href={videoUrl} rel="noopener noreferrer" target="_blank">Видео отзыва</a> : null}
    </div>
  );
}

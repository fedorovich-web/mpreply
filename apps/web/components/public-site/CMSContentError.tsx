"use client";

import { PublicShell } from "./PublicShell";

export function CMSContentError({ reset }: { reset: () => void }) {
  return (
    <PublicShell>
      <main className="public-section">
        <div className="public-container cms-content-error" role="alert">
          <p className="public-eyebrow">Материал временно недоступен</p>
          <h1>Не удалось загрузить публикацию</h1>
          <p>Попробуйте ещё раз. Остальные разделы MP Reply продолжают работать.</p>
          <button className="button button-primary" type="button" onClick={reset}>
            Повторить
          </button>
        </div>
      </main>
    </PublicShell>
  );
}

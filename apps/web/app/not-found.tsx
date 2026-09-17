import Image from "next/image";
import Link from "next/link";

import { PublicIcon, type PublicIconName } from "../components/public-site/PublicIcon";
import { PublicShell } from "../components/public-site/PublicShell";

const suggestions: readonly [PublicIconName, string, string, string][] = [
  ["chart", "Возможности", "Посмотрите, как MPReply помогает работать с обращениями покупателей.", "/features"],
  ["document", "Тарифы", "Сравните планы и выберите подходящий формат работы.", "/pricing"],
  ["link", "Интеграции", "Проверьте доступные подключения маркетплейсов.", "/marketplaces"],
  ["shield-check", "Поддержка", "Найдите ответы на частые вопросы и инструкции.", "/help"],
];

export default function NotFound() {
  return (
    <PublicShell>
      <div className="not-found-render-page">
        <section className="not-found-render-hero">
          <div className="public-container not-found-render-hero-grid">
            <div className="not-found-render-scene" aria-hidden="true">
              <div className="not-found-render-signs">
                <span>Главная?</span>
                <span>Возможности?</span>
                <span>Тарифы?</span>
              </div>
              <Image className="not-found-render-mascot" src="/images/mpreply-mascot.webp" width={320} height={320} alt="" priority />
              <span className="not-found-render-cloud cloud-a" />
              <span className="not-found-render-cloud cloud-b" />
            </div>

            <div className="not-found-render-copy">
              <strong className="not-found-render-code">404</strong>
              <h1>Страница не найдена</h1>
              <p>Возможно, она была перемещена, удалена или адрес введён неверно.</p>
              <p className="not-found-render-muted">Выберите нужный раздел или вернитесь на главную.</p>
              <div className="not-found-render-actions">
                <Link className="button button-primary" href="/">На главную <span aria-hidden="true">→</span></Link>
                <Link className="button button-secondary" href="/contacts">Связаться с нами</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="not-found-render-suggestions">
          <div className="public-container">
            <h2>Возможно, вы искали?</h2>
            <div className="not-found-route-grid">
              {suggestions.map(([icon, title, text, href]) => (
                <Link className="not-found-route-card" href={href} key={href}>
                  <span className="not-found-route-icon" aria-hidden="true"><PublicIcon name={icon} /></span>
                  <strong>{title}</strong>
                  <p>{text}</p>
                  <span className="not-found-route-arrow" aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="not-found-render-final">
          <div className="public-container not-found-render-final-card">
            <span className="not-found-render-final-icon" aria-hidden="true"><PublicIcon name="message" /></span>
            <div><h2>Не нашли, что искали?</h2><p>Напишите в поддержку — поможем найти нужную информацию.</p></div>
            <Link className="button button-primary" href="/contacts">Написать нам <span aria-hidden="true">→</span></Link>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";

import { MarketplaceIntegrationWorkspace, type MarketplaceKey } from "../../../../components/integrations/MarketplaceIntegrationWorkspace";

const pages: Record<string, { marketplace: MarketplaceKey; name: string; description: string }> = {
  wildberries: { marketplace: "wildberries", name: "Wildberries", description: "Отзывы и вопросы" },
  ozon: { marketplace: "ozon", name: "Ozon", description: "Отзывы и вопросы" },
  "yandex-market": { marketplace: "yandex_market", name: "Яндекс Маркет", description: "Отзывы и вопросы" },
  avito: { marketplace: "avito", name: "Авито", description: "Сообщения в чатах" },
};

export function generateStaticParams() {
  return Object.keys(pages).map((marketplace) => ({ marketplace }));
}

export default async function MarketplaceIntegrationPage({ params }: { params: Promise<{ marketplace: string }> }) {
  const { marketplace } = await params;
  const page = pages[marketplace];
  if (!page) notFound();

  return (
    <section className="app-page app-page-wide">
      <header className="app-header app-header-row">
        <div>
          <p className="eyebrow">{page.name}</p>
          <h1>Подключения {page.name}</h1>
          <p>
            {page.description}: добавьте данные доступа, проверьте их и запустите синхронизацию.
            Исходный секрет после сохранения не возвращается в браузер.
          </p>
        </div>
        <div className="app-header-actions">
          <Link className="button button-secondary button-compact" href="/app/integrations">
            Все интеграции
          </Link>
          <span className="status-badge">Настройка подключения</span>
        </div>
      </header>

      <MarketplaceIntegrationWorkspace marketplace={page.marketplace} />
    </section>
  );
}

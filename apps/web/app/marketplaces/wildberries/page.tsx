import type { Metadata } from "next";

import { MarketplaceLanding } from "../../../components/public-site/MarketplaceLanding";
import { createPageMetadata } from "../../../lib/seo";
import { getMarketplaceConfig } from "../../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Отзывы и вопросы Wildberries — ИИ-ответы и автоматизация",
  description:
    "MPReply собирает доступные отзывы и вопросы Wildberries в одну очередь, готовит ответы с контекстом товара и позволяет отправлять типовые ответы автоматически или после проверки.",
  path: "/marketplaces/wildberries",
});

const marketplace = getMarketplaceConfig("wildberries");

export default function MarketplacePage() {
  return <MarketplaceLanding marketplace={marketplace} />;
}

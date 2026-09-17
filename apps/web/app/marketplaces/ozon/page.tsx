import type { Metadata } from "next";

import { MarketplaceLanding } from "../../../components/public-site/MarketplaceLanding";
import { createPageMetadata } from "../../../lib/seo";
import { getMarketplaceConfig } from "../../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Обращения покупателей Ozon — единая очередь MPReply",
  description:
    "Посмотрите, как MPReply организует поддерживаемые обращения Ozon в одной очереди с доступным контекстом, ИИ-черновиками и контролем перед отправкой.",
  path: "/marketplaces/ozon",
});

const marketplace = getMarketplaceConfig("ozon");

export default function MarketplacePage() {
  return <MarketplaceLanding marketplace={marketplace} />;
}

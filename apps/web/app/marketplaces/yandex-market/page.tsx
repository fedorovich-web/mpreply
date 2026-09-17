import type { Metadata } from "next";

import { MarketplaceLanding } from "../../../components/public-site/MarketplaceLanding";
import { createPageMetadata } from "../../../lib/seo";
import { getMarketplaceConfig } from "../../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Отзывы, вопросы и чаты Яндекс Маркета — единая очередь",
  description:
    "MPReply объединяет доступные отзывы, вопросы и чаты Яндекс Маркета в одном рабочем процессе с ИИ-черновиками и контролем перед отправкой.",
  path: "/marketplaces/yandex-market",
});

const marketplace = getMarketplaceConfig("yandex-market");

export default function MarketplacePage() {
  return <MarketplaceLanding marketplace={marketplace} />;
}

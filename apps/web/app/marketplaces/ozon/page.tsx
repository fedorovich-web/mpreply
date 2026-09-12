import type { Metadata } from "next";

import { MarketplaceLanding } from "../../../components/public-site/MarketplaceLanding";
import { createPageMetadata } from "../../../lib/seo";
import { getMarketplaceConfig } from "../../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Автоответы на отзывы и вопросы Ozon с ИИ",
  description:
    "MPReply для Ozon: единая очередь обращений покупателей, ИИ-подготовка ответов, правила автоматизации и контроль перед отправкой.",
  path: "/marketplaces/ozon",
});

const marketplace = getMarketplaceConfig("ozon");

export default function MarketplacePage() {
  return <MarketplaceLanding marketplace={marketplace} />;
}

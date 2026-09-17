import type { Metadata } from "next";

import { MarketplaceLanding } from "../../../components/public-site/MarketplaceLanding";
import { createPageMetadata } from "../../../lib/seo";
import { getMarketplaceConfig } from "../../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Обращения покупателей Ozon — отзывы, вопросы и чаты",
  description:
    "Собирайте поддерживаемые отзывы, вопросы и чаты Ozon в одной очереди MPReply, готовьте ответы с помощью ИИ и оставляйте сложные случаи на проверку менеджеру.",
  path: "/marketplaces/ozon",
});

const marketplace = getMarketplaceConfig("ozon");

export default function MarketplacePage() {
  return <MarketplaceLanding marketplace={marketplace} />;
}

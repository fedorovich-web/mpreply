import type { Metadata } from "next";

import { MarketplaceLanding } from "../../../components/public-site/MarketplaceLanding";
import { createPageMetadata } from "../../../lib/seo";
import { getMarketplaceConfig } from "../../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Автоответы на отзывы и вопросы Wildberries с ИИ",
  description:
    "MPReply для Wildberries: собирайте отзывы и вопросы в единой очереди, готовьте ответы с помощью ИИ и настраивайте автоматическую отправку или проверку менеджером.",
  path: "/marketplaces/wildberries",
});

const marketplace = getMarketplaceConfig("wildberries");

export default function MarketplacePage() {
  return <MarketplaceLanding marketplace={marketplace} />;
}

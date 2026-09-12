import type { Metadata } from "next";

import { MarketplaceLanding } from "../../../components/public-site/MarketplaceLanding";
import { createPageMetadata } from "../../../lib/seo";
import { getMarketplaceConfig } from "../../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Автоответы покупателям Яндекс Маркета с ИИ",
  description:
    "MPReply для Яндекс Маркета: собирайте обращения в единой очереди, готовьте ответы с помощью ИИ и управляйте автоматической отправкой из одного рабочего пространства.",
  path: "/marketplaces/yandex-market",
});

const marketplace = getMarketplaceConfig("yandex-market");

export default function MarketplacePage() {
  return <MarketplaceLanding marketplace={marketplace} />;
}

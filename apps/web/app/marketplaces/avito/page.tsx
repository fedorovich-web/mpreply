import type { Metadata } from "next";

import { MarketplaceLanding } from "../../../components/public-site/MarketplaceLanding";
import { createPageMetadata } from "../../../lib/seo";
import { getMarketplaceConfig } from "../../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "ИИ-ответы на сообщения покупателей Авито",
  description:
    "MPReply для Авито: единая очередь сообщений покупателей, ИИ-подготовка ответов, правила автоматизации, статусы и история обработки.",
  path: "/marketplaces/avito",
});

const marketplace = getMarketplaceConfig("avito");

export default function MarketplacePage() {
  return <MarketplaceLanding marketplace={marketplace} />;
}

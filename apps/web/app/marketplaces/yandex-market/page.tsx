import type { Metadata } from "next";

import { MarketplaceLanding } from "../../../components/public-site/MarketplaceLanding";
import { createPageMetadata } from "../../../lib/seo";
import { getMarketplaceConfig } from "../../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Обращения Яндекс Маркета — единая очередь MPReply",
  description:
    "Посмотрите, как MPReply организует поддерживаемые обращения Яндекс Маркета в одном рабочем процессе с доступным контекстом, ИИ-черновиками и контролем перед отправкой.",
  path: "/marketplaces/yandex-market",
});

const marketplace = getMarketplaceConfig("yandex-market");

export default function MarketplacePage() {
  return <MarketplaceLanding marketplace={marketplace} />;
}

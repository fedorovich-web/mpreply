import type { Metadata } from "next";

import { MarketplaceLanding } from "../../../components/public-site/MarketplaceLanding";
import { createPageMetadata } from "../../../lib/seo";
import { getMarketplaceConfig } from "../../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Интеграция Respio с Яндекс Маркетом — статус и планы",
  description:
    "Текущий статус интеграции Respio с Яндекс Маркетом. Подключение не считается production-ready до проверки API, прав, лимитов и фактической отправки ответов.",
  path: "/marketplaces/yandex-market",
});

const marketplace = getMarketplaceConfig("yandex-market");

export default function MarketplacePage() {
  return <MarketplaceLanding marketplace={marketplace} />;
}

import type { Metadata } from "next";

import { MarketplaceLanding } from "../../../components/public-site/MarketplaceLanding";
import { createPageMetadata } from "../../../lib/seo";
import { getMarketplaceConfig } from "../../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "AI-ответы для Яндекс Маркет",
  description: "Страница roadmap-интеграции Respio с Яндекс Маркетом. Подключение будет открыто после проверки API и сценариев публикации ответов.",
  path: "/marketplaces/yandex-market",
});

const marketplace = getMarketplaceConfig("yandex-market");

export default function MarketplacePage() {
  return <MarketplaceLanding marketplace={marketplace} />;
}

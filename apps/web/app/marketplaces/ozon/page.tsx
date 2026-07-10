import type { Metadata } from "next";

import { MarketplaceLanding } from "../../../components/public-site/MarketplaceLanding";
import { createPageMetadata } from "../../../lib/seo";
import { getMarketplaceConfig } from "../../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "AI-ответы для Ozon",
  description: "Страница roadmap-интеграции Respio с Ozon. Production-доступность не заявляется до финальной проверки официальных API-контрактов.",
  path: "/marketplaces/ozon",
});

const marketplace = getMarketplaceConfig("ozon");

export default function MarketplacePage() {
  return <MarketplaceLanding marketplace={marketplace} />;
}

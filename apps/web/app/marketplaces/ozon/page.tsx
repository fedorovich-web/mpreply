import type { Metadata } from "next";

import { MarketplaceLanding } from "../../../components/public-site/MarketplaceLanding";
import { createPageMetadata } from "../../../lib/seo";
import { getMarketplaceConfig } from "../../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Интеграция Respio с Ozon — статус и планы",
  description:
    "Текущий статус интеграции Respio с Ozon. Production-доступность не заявляется до проверки официального API, ограничений и runtime-сценариев отправки.",
  path: "/marketplaces/ozon",
});

const marketplace = getMarketplaceConfig("ozon");

export default function MarketplacePage() {
  return <MarketplaceLanding marketplace={marketplace} />;
}

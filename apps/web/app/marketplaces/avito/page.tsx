import type { Metadata } from "next";

import { MarketplaceLanding } from "../../../components/public-site/MarketplaceLanding";
import { createPageMetadata } from "../../../lib/seo";
import { getMarketplaceConfig } from "../../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Интеграция Respio с Авито — статус и планы",
  description:
    "Текущий статус интеграции Respio с Авито. Поддержка не заявляется готовой до подтверждения официальных API-возможностей и runtime-проверки сценариев ответов.",
  path: "/marketplaces/avito",
});

const marketplace = getMarketplaceConfig("avito");

export default function MarketplacePage() {
  return <MarketplaceLanding marketplace={marketplace} />;
}

import type { Metadata } from "next";

import { MarketplaceLanding } from "../../../components/public-site/MarketplaceLanding";
import { createPageMetadata } from "../../../lib/seo";
import { getMarketplaceConfig } from "../../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "AI-ответы для Авито",
  description: "Страница roadmap-интеграции Respio с Авито. Поддержка будет включена после подтверждения официальных API-возможностей для нужных сценариев.",
  path: "/marketplaces/avito",
});

const marketplace = getMarketplaceConfig("avito");

export default function MarketplacePage() {
  return <MarketplaceLanding marketplace={marketplace} />;
}

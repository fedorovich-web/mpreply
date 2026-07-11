import type { Metadata } from "next";

import { MarketplaceLanding } from "../../../components/public-site/MarketplaceLanding";
import { createPageMetadata } from "../../../lib/seo";
import { getMarketplaceConfig } from "../../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Автоматические ответы на отзывы и вопросы Wildberries",
  description:
    "MVP-интеграция Respio для Wildberries: импорт отзывов и вопросов, AI-ответ, SafetyGate, правила автоматизации и worker-backed отправка.",
  path: "/marketplaces/wildberries",
});

const marketplace = getMarketplaceConfig("wildberries");

export default function MarketplacePage() {
  return <MarketplaceLanding marketplace={marketplace} />;
}

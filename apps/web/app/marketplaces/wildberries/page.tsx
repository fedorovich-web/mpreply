import type { Metadata } from "next";

import { MarketplaceLanding } from "../../../components/public-site/MarketplaceLanding";
import { createPageMetadata } from "../../../lib/seo";
import { getMarketplaceConfig } from "../../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "AI-ответы для Wildberries",
  description: "MVP-интеграция Respio для отзывов и вопросов Wildberries: импорт, нормализация, AI draft, SafetyGate, automation rules и worker-backed отправка.",
  path: "/marketplaces/wildberries",
});

const marketplace = getMarketplaceConfig("wildberries");

export default function MarketplacePage() {
  return <MarketplaceLanding marketplace={marketplace} />;
}

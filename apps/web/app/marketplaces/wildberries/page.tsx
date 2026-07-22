import type { Metadata } from "next";
import { MarketplaceLanding } from "../../../components/public-site/MarketplaceLanding";
import { createPageMetadata } from "../../../lib/seo";
import { getMarketplaceConfig } from "../../../lib/site-config";

const marketplace = getMarketplaceConfig("wildberries");
export const metadata: Metadata = createPageMetadata({
  title: "ИИ-ответы на отзывы и вопросы Wildberries",
  description: marketplace.summary,
  path: marketplace.path,
});
export default function WildberriesPage() { return <MarketplaceLanding marketplace={marketplace} />; }

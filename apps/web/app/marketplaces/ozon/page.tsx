import type { Metadata } from "next";
import { MarketplaceLanding } from "../../../components/public-site/MarketplaceLanding";
import { createPageMetadata } from "../../../lib/seo";
import { getMarketplaceConfig } from "../../../lib/site-config";

const marketplace = getMarketplaceConfig("ozon");
export const metadata: Metadata = createPageMetadata({
  title: "ИИ-ответы на отзывы, вопросы и чаты Ozon",
  description: marketplace.summary,
  path: marketplace.path,
});
export default function OzonPage() { return <MarketplaceLanding marketplace={marketplace} />; }

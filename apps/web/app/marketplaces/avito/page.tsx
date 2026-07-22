import type { Metadata } from "next";
import { MarketplaceLanding } from "../../../components/public-site/MarketplaceLanding";
import { createPageMetadata } from "../../../lib/seo";
import { getMarketplaceConfig } from "../../../lib/site-config";

const marketplace = getMarketplaceConfig("avito");
export const metadata: Metadata = createPageMetadata({
  title: "ИИ-ответы на отзывы и чаты Авито",
  description: marketplace.summary,
  path: marketplace.path,
});
export default function AvitoPage() { return <MarketplaceLanding marketplace={marketplace} />; }

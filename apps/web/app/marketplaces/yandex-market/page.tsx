import type { Metadata } from "next";
import { MarketplaceLanding } from "../../../components/public-site/MarketplaceLanding";
import { createPageMetadata } from "../../../lib/seo";
import { getMarketplaceConfig } from "../../../lib/site-config";

const marketplace = getMarketplaceConfig("yandex-market");
export const metadata: Metadata = createPageMetadata({
  title: "ИИ-ответы на отзывы и вопросы Яндекс Маркета",
  description: marketplace.summary,
  path: marketplace.path,
});
export default function YandexMarketPage() { return <MarketplaceLanding marketplace={marketplace} />; }

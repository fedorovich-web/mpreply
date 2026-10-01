import type { Metadata } from "next";

import { MarketplaceLanding } from "../../../../components/public-site/MarketplaceLanding";
import { createPageMetadata } from "../../../../lib/seo";
import { getMarketplaceConfig } from "../../../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Wildberries reviews and questions — AI-assisted replies and automation",
  description:
    "Bring supported Wildberries reviews and questions into one MPReply queue with product context, AI-assisted drafts, review controls, and rule-based automation.",
  path: "/marketplaces/wildberries",
  locale: "en",
  localized: true,
});

const marketplace = getMarketplaceConfig("wildberries", "en");

export default function EnglishWildberriesMarketplacePage() {
  return <MarketplaceLanding marketplace={marketplace} locale="en" />;
}

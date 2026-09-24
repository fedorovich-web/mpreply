import type { Metadata } from "next";

import { MarketplaceLanding } from "../../../../components/public-site/MarketplaceLanding";
import { createPageMetadata } from "../../../../lib/seo";
import { getMarketplaceConfig } from "../../../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Ozon customer messages — one MPReply queue",
  description:
    "Handle supported Ozon customer messages in one MPReply queue with available context, AI-assisted drafts, workflow status, and review before sending.",
  path: "/marketplaces/ozon",
  locale: "en",
  localized: true,
});

const marketplace = getMarketplaceConfig("ozon", "en");

export default function EnglishOzonMarketplacePage() {
  return <MarketplaceLanding marketplace={marketplace} locale="en" />;
}

import type { Metadata } from "next";

import { MarketplaceLanding } from "../../../../components/public-site/MarketplaceLanding";
import { createPageMetadata } from "../../../../lib/seo";
import { getMarketplaceConfig } from "../../../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Avito buyer messages — AI-assisted replies and review controls",
  description:
    "Bring supported Avito buyer conversations into one MPReply queue with listing context, AI-assisted drafts, assignments, workflow status, and team review.",
  path: "/marketplaces/avito",
  locale: "en",
  localized: true,
});

const marketplace = getMarketplaceConfig("avito", "en");

export default function EnglishAvitoMarketplacePage() {
  return <MarketplaceLanding marketplace={marketplace} locale="en" />;
}

import type { Metadata } from "next";

import { MarketplaceLanding } from "../../../../components/public-site/MarketplaceLanding";
import { createPageMetadata } from "../../../../lib/seo";
import { getMarketplaceConfig } from "../../../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Yandex Market customer messages — one MPReply workflow",
  description:
    "Handle supported Yandex Market customer messages in one MPReply workflow with available context, AI-assisted drafts, assignments, and review controls.",
  path: "/marketplaces/yandex-market",
  locale: "en",
  localized: true,
});

const marketplace = getMarketplaceConfig("yandex-market", "en");

export default function EnglishYandexMarketMarketplacePage() {
  return <MarketplaceLanding marketplace={marketplace} locale="en" />;
}

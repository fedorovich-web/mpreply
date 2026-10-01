import type { Metadata } from "next";

import { MarketplaceLanding } from "../../../components/public-site/MarketplaceLanding";
import { createPageMetadata } from "../../../lib/seo";
import { getMarketplaceConfig } from "../../../lib/site-config";

export const metadata: Metadata = createPageMetadata({
  title: "Сообщения покупателей Авито — ИИ-ответы и контроль",
  description:
    "Собирайте поддерживаемые диалоги по объявлениям Авито в общей очереди MPReply, готовьте ответы с контекстом и оставляйте сложные сообщения на проверку менеджеру.",
  path: "/marketplaces/avito",
  localized: true,
});

const marketplace = getMarketplaceConfig("avito");

export default function MarketplacePage() {
  return <MarketplaceLanding marketplace={marketplace} />;
}

"use client";

import { MarketplaceIntegrationWorkspace } from "./WildberriesIntegrationWorkspace";
import { useWorkspace } from "../workspace/WorkspaceProvider";

export function YandexMarketIntegrationWorkspace() {
  const { locale } = useWorkspace();
  const copy = locale === "en"
    ? {
        credential: "Yandex Market API key",
        placeholder: "For example, Yandex Market — main store",
        sellerId: "Business ID",
        sellerPlaceholder: "Positive numeric Business ID",
      }
    : {
        credential: "API-ключ Яндекс Маркета",
        placeholder: "Например, Яндекс Маркет — основной магазин",
        sellerId: "Business ID",
        sellerPlaceholder: "Положительный числовой Business ID",
      };

  return (
    <MarketplaceIntegrationWorkspace
      credentialLabel={copy.credential}
      marketplace="yandex_market"
      marketplaceName={locale === "en" ? "Yandex Market" : "Яндекс Маркет"}
      placeholder={copy.placeholder}
      sellerIdLabel={copy.sellerId}
      sellerIdMode="positive-integer"
      sellerIdPlaceholder={copy.sellerPlaceholder}
    />
  );
}

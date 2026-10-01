"use client";

import { MarketplaceIntegrationWorkspace } from "./WildberriesIntegrationWorkspace";
import { useWorkspace } from "../workspace/WorkspaceProvider";

export function OzonIntegrationWorkspace() {
  const { locale } = useWorkspace();
  const copy = locale === "en"
    ? {
        credential: "Ozon API key",
        placeholder: "For example, Ozon — main store",
        sellerId: "Client ID",
        sellerPlaceholder: "Ozon Client ID",
      }
    : {
        credential: "API-ключ Ozon",
        placeholder: "Например, Ozon — основной магазин",
        sellerId: "Client ID",
        sellerPlaceholder: "Client ID кабинета Ozon",
      };

  return (
    <MarketplaceIntegrationWorkspace
      credentialLabel={copy.credential}
      marketplace="ozon"
      marketplaceName="Ozon"
      placeholder={copy.placeholder}
      sellerIdHiddenAfterSave
      sellerIdLabel={copy.sellerId}
      sellerIdMode="required"
      sellerIdPlaceholder={copy.sellerPlaceholder}
    />
  );
}

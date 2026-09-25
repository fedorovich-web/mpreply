"use client";

import { MarketplaceIntegrationWorkspace } from "./WildberriesIntegrationWorkspace";
import { useWorkspace } from "../workspace/WorkspaceProvider";

export function AvitoIntegrationWorkspace() {
  const { locale } = useWorkspace();
  const copy = locale === "en"
    ? {
        placeholder: "For example, Avito — main account",
        sellerId: "Avito User ID",
        sellerPlaceholder: "Positive numeric Avito User ID",
      }
    : {
        placeholder: "Например, Авито — основной аккаунт",
        sellerId: "Avito User ID",
        sellerPlaceholder: "Положительный числовой ID пользователя Авито",
      };

  return (
    <MarketplaceIntegrationWorkspace
      credentialLabel="Client ID"
      credentialMode="avito-client-credentials"
      marketplace="avito"
      marketplaceName={locale === "en" ? "Avito" : "Авито"}
      placeholder={copy.placeholder}
      secondaryCredentialLabel="Client Secret"
      sellerIdHiddenAfterSave
      sellerIdLabel={copy.sellerId}
      sellerIdMode="positive-integer"
      sellerIdPlaceholder={copy.sellerPlaceholder}
    />
  );
}

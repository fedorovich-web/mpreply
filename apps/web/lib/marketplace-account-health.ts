import type { MarketplaceAccount } from "./api/schemas";

type MarketplaceAccountHealth = Pick<
  MarketplaceAccount,
  "status" | "last_success_sync_at" | "last_error_sync_at"
>;

export function hasCurrentIntegrationProblem(account: MarketplaceAccountHealth): boolean {
  if (account.status === "error") return true;
  if (!account.last_error_sync_at) return false;
  if (!account.last_success_sync_at) return true;

  return Date.parse(account.last_error_sync_at) > Date.parse(account.last_success_sync_at);
}

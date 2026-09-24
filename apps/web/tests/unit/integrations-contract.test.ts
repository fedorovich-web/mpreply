import { describe, expect, it } from "vitest";

import {
  marketplaceAccountActionSchema,
  marketplaceAccountSchema,
  marketplaceAccountValidateSchema,
  marketplaceSyncSchema,
} from "../../lib/api/schemas";

const timestamp = "2026-07-12T06:00:00Z";
const account = {
  id: "11111111-1111-4111-8111-111111111111",
  organization_id: "22222222-2222-4222-8222-222222222222",
  marketplace: "wildberries",
  display_name: "WB основной кабинет",
  seller_id: "seller-42",
  status: "active",
  credentials_masked: "sha256:ab12…90ef",
  credentials_status: "valid",
  scopes_json: { validated: true },
  default_response_mode: "inherit",
  last_success_sync_at: timestamp,
  last_error_sync_at: null,
  error_count: 0,
  created_at: timestamp,
  updated_at: timestamp,
};

describe("marketplace integration API contracts", () => {
  it("accepts a safe marketplace account response without raw credentials", () => {
    const parsed = marketplaceAccountSchema.parse(account);
    expect(parsed.credentials_masked).toBe(account.credentials_masked);
    expect(parsed).not.toHaveProperty("credentials");
    expect(parsed).not.toHaveProperty("credentials_encrypted");
  });

  it("rejects malformed account identifiers", () => {
    expect(() => marketplaceAccountSchema.parse({ ...account, organization_id: "not-a-uuid" })).toThrow();
  });

  it("rejects an unknown response mode instead of silently changing it", () => {
    expect(() => marketplaceAccountSchema.parse({ ...account, default_response_mode: "unknown" })).toThrow();
  });

  it("accepts validation, rotation and sync result contracts", () => {
    expect(
      marketplaceAccountValidateSchema.parse({
        id: account.id,
        status: "active",
        credentials_status: "valid",
        scopes: ["validated"],
        checked_at: timestamp,
        error_code: null,
        error_message_safe: null,
      }).credentials_status,
    ).toBe("valid");

    expect(
      marketplaceAccountActionSchema.parse({
        id: account.id,
        status: "pending_validation",
        credentials_status: "pending_validation",
        credentials_masked: account.credentials_masked,
        message: "Credentials rotated.",
      }).status,
    ).toBe("pending_validation");

    expect(
      marketplaceSyncSchema.parse({
        account_id: account.id,
        marketplace: "wildberries",
        status: "success",
        imported_reviews: 4,
        imported_questions: 3,
        imported_chats: 0,
        updated_reviews: 1,
        updated_questions: 2,
        updated_chats: 0,
        skipped: 0,
        error_code: null,
        error_message_safe: null,
      }).imported_reviews,
    ).toBe(4);
  });
});

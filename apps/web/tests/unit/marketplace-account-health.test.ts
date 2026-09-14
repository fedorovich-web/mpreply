import { describe, expect, it } from "vitest";

import { hasCurrentIntegrationProblem } from "../../lib/marketplace-account-health";

const baseAccount = {
  status: "active",
  last_success_sync_at: "2026-09-14T06:30:00Z",
  last_error_sync_at: null as string | null,
};

describe("hasCurrentIntegrationProblem", () => {
  it("treats a newer sync error as a current problem", () => {
    expect(
      hasCurrentIntegrationProblem({
        ...baseAccount,
        last_error_sync_at: "2026-09-14T06:45:00Z",
      }),
    ).toBe(true);
  });

  it("does not treat historical errors as current after a newer successful sync", () => {
    expect(
      hasCurrentIntegrationProblem({
        ...baseAccount,
        last_error_sync_at: "2026-09-14T06:15:00Z",
      }),
    ).toBe(false);
  });

  it("treats an explicit account error status as current even without sync timestamps", () => {
    expect(
      hasCurrentIntegrationProblem({
        status: "error",
        last_success_sync_at: null,
        last_error_sync_at: null,
      }),
    ).toBe(true);
  });

  it("treats a first failed sync as current when no successful sync exists", () => {
    expect(
      hasCurrentIntegrationProblem({
        status: "active",
        last_success_sync_at: null,
        last_error_sync_at: "2026-09-14T06:45:00Z",
      }),
    ).toBe(true);
  });
});

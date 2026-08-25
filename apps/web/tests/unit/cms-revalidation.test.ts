import { describe, expect, it } from "vitest";

import {
  CMSReplayGuard,
  parseRevalidationPayload,
  verifyRevalidationSignature,
} from "../../lib/cms/revalidation";

const body = '{"id":"entry-1","kind":"article","slug":"guide","previousSlug":null,"status":"published"}';
const timestamp = "1787648400";
const signature = "sha256=7d3fcd2632af9c4b66eb01b5e2e9663272f5d3a34d562affc8a5b107e3005da2";

describe("CMS revalidation authentication", () => {
  it("accepts the exact signed body inside the timestamp window", () => {
    expect(
      verifyRevalidationSignature({
        body,
        nowSeconds: 1787648401,
        secret: "secret",
        signature,
        timestamp,
      }),
    ).toBe(true);
  });

  it("rejects tampering and stale timestamps", () => {
    expect(
      verifyRevalidationSignature({
        body: `${body} `,
        nowSeconds: 1787648401,
        secret: "secret",
        signature,
        timestamp,
      }),
    ).toBe(false);
    expect(
      verifyRevalidationSignature({
        body,
        nowSeconds: 1787649001,
        secret: "secret",
        signature,
        timestamp,
      }),
    ).toBe(false);
  });

  it("rejects a second use of the same valid signature", () => {
    const guard = new CMSReplayGuard();
    expect(guard.accept(signature, 1787648401)).toBe(true);
    expect(guard.accept(signature, 1787648402)).toBe(false);
    expect(guard.accept(signature, 1787649001)).toBe(true);
  });

  it("rejects malformed JSON without throwing an internal error", () => {
    expect(parseRevalidationPayload("{")).toBeNull();
    expect(parseRevalidationPayload(body)).toMatchObject({ id: "entry-1", status: "published" });
  });
});

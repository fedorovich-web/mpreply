import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

const SIGNATURE_TTL_SECONDS = 300;

export const cmsRevalidationPayloadSchema = z.object({
  id: z.string().min(1).max(128),
  kind: z.enum(["article", "guide", "checklist", "methodology", "template"]),
  previousSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).nullable(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  status: z.enum(["draft", "published"]),
});

export function parseRevalidationPayload(body: string) {
  try {
    const parsed = cmsRevalidationPayloadSchema.safeParse(JSON.parse(body));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function verifyRevalidationSignature({
  body,
  nowSeconds,
  secret,
  signature,
  timestamp,
}: {
  body: string;
  nowSeconds: number;
  secret: string;
  signature: string;
  timestamp: string;
}): boolean {
  if (!/^\d{10}$/.test(timestamp) || !/^sha256=[a-f0-9]{64}$/.test(signature)) {
    return false;
  }
  const timestampSeconds = Number(timestamp);
  if (Math.abs(nowSeconds - timestampSeconds) > SIGNATURE_TTL_SECONDS) {
    return false;
  }

  const expected = `sha256=${createHmac("sha256", secret)
    .update(`${timestamp}.${body}`, "utf8")
    .digest("hex")}`;
  return timingSafeEqual(Buffer.from(signature, "utf8"), Buffer.from(expected, "utf8"));
}

export class CMSReplayGuard {
  private readonly accepted = new Map<string, number>();

  accept(signature: string, nowSeconds: number): boolean {
    for (const [key, expiresAt] of this.accepted) {
      if (expiresAt <= nowSeconds) {
        this.accepted.delete(key);
      }
    }
    if (this.accepted.has(signature)) {
      return false;
    }
    this.accepted.set(signature, nowSeconds + SIGNATURE_TTL_SECONDS);
    return true;
  }
}

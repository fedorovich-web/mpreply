import { createHmac } from "node:crypto";

import { APIError, type CollectionAfterChangeHook, type CollectionBeforeChangeHook } from "payload";

type PublicationData = {
  _status?: "draft" | "published" | null;
  editorialState?: "draft" | "in_review" | "approved" | null;
};

type CMSUser = {
  role?: "admin" | "editor" | "service" | null;
} | null;

export function assertPublicationAllowed({
  data,
  user,
}: {
  data: PublicationData;
  user: CMSUser;
}): void {
  if (data._status !== "published") {
    return;
  }
  if (user?.role !== "admin") {
    throw new APIError("Only CMS administrators can publish content", 403);
  }
  if (data.editorialState !== "approved") {
    throw new APIError("Content must be approved before publication", 400);
  }
}

export const enforcePublicationPolicy: CollectionBeforeChangeHook = ({ data, req }) => {
  assertPublicationAllowed({
    data: data as PublicationData,
    user: req.user as CMSUser,
  });
  return data;
};

export function createRevalidationSignature(secret: string, timestamp: string, body: string): string {
  const digest = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`, "utf8")
    .digest("hex");
  return `sha256=${digest}`;
}

export const revalidateContent: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  const url = process.env.CMS_REVALIDATION_URL;
  const secret = process.env.CMS_REVALIDATION_SECRET;
  if (!url || !secret) {
    return doc;
  }

  const body = JSON.stringify({
    id: String(doc.id),
    kind: doc.kind,
    slug: doc.slug,
    previousSlug: previousDoc?.slug ?? null,
    status: doc._status,
  });
  const timestamp = Math.floor(Date.now() / 1000).toString();

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-mpreply-cms-signature": createRevalidationSignature(secret, timestamp, body),
        "x-mpreply-cms-timestamp": timestamp,
      },
      body,
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      req.payload.logger.error({
        msg: "CMS revalidation webhook failed",
        status: response.status,
      });
    }
  } catch {
    req.payload.logger.error({ msg: "CMS revalidation webhook failed" });
  }

  return doc;
};

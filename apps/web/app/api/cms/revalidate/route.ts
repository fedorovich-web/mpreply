import { revalidateTag } from "next/cache";

import {
  CMSReplayGuard,
  parseRevalidationPayload,
  verifyRevalidationSignature,
} from "../../../../lib/cms/revalidation";

const MAX_BODY_BYTES = 65_536;
const replayGuard = new CMSReplayGuard();

export async function POST(request: Request) {
  const secret = process.env.CMS_REVALIDATION_SECRET?.trim();
  if (!secret) {
    return Response.json({ error: "cms_revalidation_unconfigured" }, { status: 503 });
  }

  const contentLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return Response.json({ error: "request_too_large" }, { status: 413 });
  }

  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
    return Response.json({ error: "request_too_large" }, { status: 413 });
  }

  const signature = request.headers.get("x-mpreply-cms-signature") || "";
  const timestamp = request.headers.get("x-mpreply-cms-timestamp") || "";
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!verifyRevalidationSignature({ body, nowSeconds, secret, signature, timestamp })) {
    return Response.json({ error: "invalid_signature" }, { status: 401 });
  }
  if (!replayGuard.accept(signature, nowSeconds)) {
    return Response.json({ error: "replayed_request" }, { status: 409 });
  }

  const payload = parseRevalidationPayload(body);
  if (!payload) {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  const tags = new Set([
    "cms:content",
    "cms:sitemap",
    `cms:content:${payload.kind}`,
    `cms:slug:${payload.kind}:${payload.slug}`,
  ]);
  if (payload.previousSlug) {
    tags.add(`cms:slug:${payload.kind}:${payload.previousSlug}`);
  }
  for (const tag of tags) {
    revalidateTag(tag, "max");
  }

  return Response.json({ revalidated: true });
}

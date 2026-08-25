import "server-only";

import type { CMSRuntimeConfig } from "./config";

type CMSFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
const SAFE_FILENAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;
const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export class CMSMediaError extends Error {
  readonly status: number;

  constructor(status = 502) {
    super("CMS media is unavailable");
    this.name = "CMSMediaError";
    this.status = status;
  }
}

export async function fetchCMSMedia(
  filename: string,
  config: CMSRuntimeConfig,
  fetcher: CMSFetch = fetch,
): Promise<{ body: ArrayBuffer; contentType: string }> {
  if (!SAFE_FILENAME.test(filename)) {
    throw new CMSMediaError(404);
  }

  let response: Response;
  try {
    response = await fetcher(`${config.apiUrl}/api/media/file/${encodeURIComponent(filename)}`, {
      headers: {
        accept: "image/avif,image/webp,image/png,image/jpeg",
        authorization: `Bearer ${config.readToken}`,
      },
      redirect: "error",
      signal: AbortSignal.timeout(config.requestTimeoutMs),
    });
  } catch {
    throw new CMSMediaError();
  }

  if (response.status === 404) {
    throw new CMSMediaError(404);
  }
  if (!response.ok) {
    throw new CMSMediaError();
  }

  const contentType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() || "";
  const contentLength = Number(response.headers.get("content-length") || "0");
  if (!ALLOWED_CONTENT_TYPES.has(contentType) || (contentLength > 0 && contentLength > MAX_MEDIA_BYTES)) {
    throw new CMSMediaError();
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_MEDIA_BYTES) {
    throw new CMSMediaError();
  }
  return { body: buffer, contentType };
}

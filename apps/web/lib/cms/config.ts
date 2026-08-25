export type CMSRuntimeConfig = {
  apiUrl: string;
  readToken: string;
  requestTimeoutMs: number;
};

type Environment = Record<string, string | undefined>;

const DEFAULT_TIMEOUT_MS = 4_000;

export function readCMSRuntimeConfig(environment: Environment = process.env): CMSRuntimeConfig | null {
  const apiUrl = environment.CMS_API_URL?.trim().replace(/\/$/, "");
  const readToken = environment.CMS_READ_TOKEN?.trim();

  if (!apiUrl && !readToken) {
    return null;
  }
  if (!apiUrl || !readToken) {
    throw new Error("CMS server configuration is incomplete");
  }

  const parsedUrl = new URL(apiUrl);
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("CMS_API_URL must use HTTP or HTTPS");
  }

  const rawTimeout = environment.CMS_REQUEST_TIMEOUT_MS?.trim();
  const requestTimeoutMs = rawTimeout ? Number(rawTimeout) : DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 250 || requestTimeoutMs > 10_000) {
    throw new Error("CMS_REQUEST_TIMEOUT_MS must be an integer between 250 and 10000");
  }

  return {
    apiUrl: parsedUrl.toString().replace(/\/$/, ""),
    readToken,
    requestTimeoutMs,
  };
}

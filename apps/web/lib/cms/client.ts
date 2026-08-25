import "server-only";

import { readCMSRuntimeConfig, type CMSRuntimeConfig } from "./config";
import {
  cmsContentKindSchema,
  parseContentDetail,
  parseContentList,
  type CMSContentDetail,
  type CMSContentKind,
  type CMSContentSummary,
} from "./schema";

type CMSFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;
type NextRequestInit = RequestInit & {
  next?: {
    revalidate: number;
    tags: string[];
  };
};

export class CMSNotFoundError extends Error {
  constructor() {
    super("CMS content was not found");
    this.name = "CMSNotFoundError";
  }
}

export class CMSUnavailableError extends Error {
  constructor(message = "CMS is temporarily unavailable") {
    super(message);
    this.name = "CMSUnavailableError";
  }
}

export class CMSContractError extends Error {
  constructor() {
    super("CMS returned an invalid content response");
    this.name = "CMSContractError";
  }
}

function createContentQuery(kind?: CMSContentKind, slug?: string): URLSearchParams {
  const query = new URLSearchParams({
    "where[_status][equals]": "published",
    "where[editorialState][equals]": "approved",
    depth: "1",
    limit: slug ? "1" : "100",
    sort: "-publishedAt",
  });
  if (kind) {
    query.set("where[kind][equals]", kind);
  }
  if (slug) {
    query.set("where[slug][equals]", slug);
  }
  return query;
}

export function createCMSClient(config: CMSRuntimeConfig, fetcher: CMSFetch = fetch) {
  async function request(query: URLSearchParams, tags: string[]): Promise<unknown> {
    let response: Response;
    try {
      response = await fetcher(`${config.apiUrl}/api/content?${query.toString()}`, {
        headers: {
          accept: "application/json",
          authorization: `Bearer ${config.readToken}`,
        },
        signal: AbortSignal.timeout(config.requestTimeoutMs),
        next: {
          revalidate: 300,
          tags,
        },
      } as NextRequestInit);
    } catch {
      throw new CMSUnavailableError();
    }

    if (response.status === 404) {
      throw new CMSNotFoundError();
    }
    if (!response.ok) {
      throw new CMSUnavailableError();
    }

    try {
      return await response.json();
    } catch {
      throw new CMSContractError();
    }
  }

  return {
    async getPublishedContent(kind: CMSContentKind, slug: string): Promise<CMSContentDetail> {
      cmsContentKindSchema.parse(kind);
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        throw new CMSNotFoundError();
      }
      const response = await request(createContentQuery(kind, slug), [
        "cms:content",
        `cms:content:${kind}`,
        `cms:slug:${kind}:${slug}`,
      ]);
      let summaries: CMSContentSummary[];
      try {
        summaries = parseContentList(response);
      } catch {
        throw new CMSContractError();
      }
      if (summaries.length === 0) {
        throw new CMSNotFoundError();
      }

      const providerDocument = (response as { docs: unknown[] }).docs[0];
      try {
        return parseContentDetail(providerDocument);
      } catch {
        throw new CMSContractError();
      }
    },

    async listPublishedContent(kind?: CMSContentKind): Promise<CMSContentSummary[]> {
      if (kind) {
        cmsContentKindSchema.parse(kind);
      }
      const response = await request(createContentQuery(kind), [
        "cms:content",
        ...(kind ? [`cms:content:${kind}`] : []),
      ]);
      try {
        return parseContentList(response);
      } catch {
        throw new CMSContractError();
      }
    },
  };
}

export function getCMSClient() {
  const config = readCMSRuntimeConfig();
  return config ? createCMSClient(config) : null;
}

export async function listPublishedContent(kind?: CMSContentKind): Promise<CMSContentSummary[] | null> {
  const client = getCMSClient();
  return client ? client.listPublishedContent(kind) : null;
}

export async function getPublishedContent(kind: CMSContentKind, slug: string): Promise<CMSContentDetail> {
  const client = getCMSClient();
  if (!client) {
    throw new CMSUnavailableError("CMS is not configured");
  }
  return client.getPublishedContent(kind, slug);
}

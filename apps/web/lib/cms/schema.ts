import { z } from "zod";

export const cmsContentKindSchema = z.enum([
  "article",
  "guide",
  "checklist",
  "methodology",
  "template",
]);

export type CMSContentKind = z.infer<typeof cmsContentKindSchema>;

const marketplaceSchema = z.enum(["wildberries", "ozon", "yandex-market", "avito"]);

const categorySchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

const coverSchema = z.object({
  alt: z.string().min(1).max(240),
  height: z.number().int().positive().nullable().optional(),
  url: z.string().min(1).max(500),
  width: z.number().int().positive().nullable().optional(),
});

const seoSchema = z.object({
  canonical: z.string().max(300).nullable().optional(),
  description: z.string().min(1).max(320),
  noindex: z.boolean().default(false),
  title: z.string().min(1).max(180),
});

const lexicalDocumentSchema = z.object({
  root: z.object({
    children: z.array(z.unknown()),
    type: z.literal("root"),
    version: z.number().int().positive(),
  }),
});

const providerContentSchema = z.object({
  _status: z.literal("published"),
  authorName: z.string().min(1).max(120).nullable().optional(),
  body: lexicalDocumentSchema,
  category: categorySchema,
  cover: coverSchema.nullable().optional(),
  createdAt: z.string().datetime(),
  editorialState: z.literal("approved"),
  excerpt: z.string().min(1).max(420),
  id: z.string().uuid(),
  kind: cmsContentKindSchema,
  marketplaces: z.array(marketplaceSchema).max(4).default([]),
  publishedAt: z.string().datetime().nullable().optional(),
  seo: seoSchema,
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1).max(180),
  updatedAt: z.string().datetime(),
});

const providerListSchema = z.object({
  docs: z.array(providerContentSchema).max(1_000),
  totalDocs: z.number().int().nonnegative(),
});

export type CMSContentDetail = z.infer<typeof providerContentSchema>;
export type CMSContentSummary = Omit<CMSContentDetail, "body">;

export function parseContentDetail(input: unknown): CMSContentDetail {
  return providerContentSchema.parse(input);
}

export function parseContentList(input: unknown): CMSContentSummary[] {
  return providerListSchema.parse(input).docs.map((document) => ({
    _status: document._status,
    authorName: document.authorName,
    category: document.category,
    cover: document.cover,
    createdAt: document.createdAt,
    editorialState: document.editorialState,
    excerpt: document.excerpt,
    id: document.id,
    kind: document.kind,
    marketplaces: document.marketplaces,
    publishedAt: document.publishedAt,
    seo: document.seo,
    slug: document.slug,
    title: document.title,
    updatedAt: document.updatedAt,
  }));
}

import type { Metadata } from "next";

import { createPageMetadata } from "../seo";
import type { CMSContentDetail, CMSContentKind } from "./schema";

const KIND_LABELS: Record<CMSContentKind, string> = {
  article: "Статья",
  guide: "Гайд",
  checklist: "Чек-лист",
  methodology: "Методика",
  template: "Шаблон",
};

export function contentKindLabel(kind: CMSContentKind): string {
  return KIND_LABELS[kind];
}

export function contentPath(kind: CMSContentKind, slug: string): string {
  return kind === "article" ? `/blog/${slug}` : `/resources/${slug}`;
}

export function createContentMetadata(content: CMSContentDetail): Metadata {
  return createPageMetadata({
    title: content.seo.title,
    description: content.seo.description,
    path: content.seo.canonical || contentPath(content.kind, content.slug),
    noIndex: content.seo.noindex,
  });
}

export function publicCMSMediaPath(providerPath: string): string {
  const match = /^\/api\/media\/file\/([A-Za-z0-9][A-Za-z0-9._-]{0,199})$/.exec(providerPath);
  if (!match) {
    throw new Error("Invalid CMS media path");
  }
  return `/api/cms/media/${encodeURIComponent(match[1])}`;
}

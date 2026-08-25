import Link from "next/link";

import { contentKindLabel, contentPath } from "../../lib/cms/presentation";
import type { CMSContentKind, CMSContentSummary } from "../../lib/cms/schema";
import { MarketingGlyph } from "./MarketingGlyph";

const KIND_GLYPH: Record<CMSContentKind, "reviews" | "questions" | "settings" | "context" | "recommendations"> = {
  article: "reviews",
  guide: "recommendations",
  checklist: "questions",
  methodology: "settings",
  template: "context",
};

export function CMSContentCard({
  content,
  headingLevel,
}: {
  content: CMSContentSummary;
  headingLevel: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const href = contentPath(content.kind, content.slug);

  return (
    <article className="resource-library-card cms-content-card">
      <MarketingGlyph variant={KIND_GLYPH[content.kind]} />
      <span className="resource-state">{contentKindLabel(content.kind)}</span>
      <Heading>{content.title}</Heading>
      <p>{content.excerpt}</p>
      <Link className="cms-content-card-link" href={href} aria-label={`Читать: ${content.title}`}>
        Читать
      </Link>
    </article>
  );
}

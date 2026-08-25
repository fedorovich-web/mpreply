import Link from "next/link";
import Image from "next/image";

import { CMSRichText } from "../../lib/cms/lexical";
import { contentKindLabel, publicCMSMediaPath } from "../../lib/cms/presentation";
import type { CMSContentDetail } from "../../lib/cms/schema";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "long",
  timeZone: "UTC",
});

export function CMSContentArticle({ content }: { content: CMSContentDetail }) {
  const collectionPath = content.kind === "article" ? "/blog" : "/resources";
  const collectionLabel = content.kind === "article" ? "Блог" : "Материалы";
  const publishedAt = content.publishedAt || content.updatedAt;

  return (
    <article className="cms-content-article">
      <header className="cms-content-header">
        <nav className="cms-content-breadcrumbs" aria-label="Навигация по материалу">
          <Link href={collectionPath}>{collectionLabel}</Link>
          <span aria-hidden="true">/</span>
          <span>{content.category.name}</span>
        </nav>
        <p className="public-eyebrow">{contentKindLabel(content.kind)}</p>
        <h1>{content.title}</h1>
        <p className="public-lead">{content.excerpt}</p>
        <div className="cms-content-meta">
          <time dateTime={publishedAt}>{dateFormatter.format(new Date(publishedAt))}</time>
          {content.authorName ? <span>{content.authorName}</span> : null}
        </div>
      </header>
      {content.cover?.width && content.cover.height ? (
        <figure className="cms-content-cover">
          <Image
            src={publicCMSMediaPath(content.cover.url)}
            alt={content.cover.alt}
            width={content.cover.width}
            height={content.cover.height}
            sizes="(max-width: 760px) 100vw, 720px"
          />
        </figure>
      ) : null}
      <CMSRichText document={content.body} />
    </article>
  );
}

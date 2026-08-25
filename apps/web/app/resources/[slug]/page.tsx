import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CMSContentArticle } from "../../../components/public-site/CMSContentArticle";
import { PublicShell } from "../../../components/public-site/PublicShell";
import { PublicTrialCta } from "../../../components/public-site/PublicTrialCta";
import { CMSNotFoundError, getPublishedContent } from "../../../lib/cms/client";
import { createContentMetadata } from "../../../lib/cms/presentation";

type PageProps = {
  params: Promise<{ slug: string }>;
};

async function loadResource(slug: string) {
  try {
    const content = await getPublishedContent(undefined, slug);
    if (content.kind === "article") {
      notFound();
    }
    return content;
  } catch (error) {
    if (error instanceof CMSNotFoundError) {
      notFound();
    }
    throw error;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return createContentMetadata(await loadResource(slug));
}

export default async function ResourceDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const content = await loadResource(slug);

  return (
    <PublicShell>
      <main className="public-section cms-content-page">
        <div className="public-container">
          <CMSContentArticle content={content} />
        </div>
      </main>
      <div className="public-section public-cta-section">
        <div className="public-container home-final-cta-card public-page-final-cta">
          <div>
            <p className="public-eyebrow">Применить материал</p>
            <h2>Настройте правила ответов в MPReply</h2>
            <p>Используйте данные о товарах и правила продавца в автоматических ответах.</p>
          </div>
          <PublicTrialCta className="button button-primary public-cta-on-dark" source="resource-article-footer">
            Начать бесплатный тест
          </PublicTrialCta>
        </div>
      </div>
    </PublicShell>
  );
}

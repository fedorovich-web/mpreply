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

async function loadArticle(slug: string) {
  try {
    return await getPublishedContent("article", slug);
  } catch (error) {
    if (error instanceof CMSNotFoundError) {
      notFound();
    }
    throw error;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return createContentMetadata(await loadArticle(slug));
}

export default async function BlogArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const content = await loadArticle(slug);

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
            <p className="public-eyebrow">Применить на практике</p>
            <h2>Настройте ответы на обращениях своих покупателей</h2>
            <p>Проверьте работу MPReply на отзывах, вопросах и чатах.</p>
          </div>
          <PublicTrialCta className="button button-primary public-cta-on-dark" source="blog-article-footer">
            Начать бесплатный тест
          </PublicTrialCta>
        </div>
      </div>
    </PublicShell>
  );
}

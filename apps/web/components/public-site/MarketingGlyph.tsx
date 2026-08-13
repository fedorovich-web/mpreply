import Image from "next/image";

type MarketingGlyphVariant =
  | "reviews"
  | "questions"
  | "chats"
  | "flow"
  | "context"
  | "settings"
  | "history"
  | "recommendations"
  | "workspace"
  | "product"
  | "automation"
  | "control";

type MarketingGlyphProps = {
  variant: MarketingGlyphVariant;
};

const GLYPH_SRC: Record<MarketingGlyphVariant, string> = {
  reviews: "/brand/mpreply-icon-pack-1-blue-purple/reviews.webp",
  questions: "/brand/mpreply-icon-pack-1-blue-purple/questions.webp",
  chats: "/brand/mpreply-icon-pack-1-blue-purple/chats.webp",
  flow: "/brand/mpreply-icon-pack-1-blue-purple/flow.webp",
  context: "/brand/mpreply-icon-pack-1-blue-purple/context.webp",
  settings: "/brand/mpreply-icon-pack-1-blue-purple/settings.webp",
  history: "/brand/mpreply-icon-pack-1-blue-purple/history.webp",
  recommendations: "/brand/mpreply-icon-pack-1-blue-purple/recommendations.webp",
  workspace: "/brand/mpreply-icon-pack-1-blue-purple/flow.webp",
  product: "/brand/mpreply-icon-pack-1-blue-purple/context.webp",
  automation: "/brand/mpreply-icon-pack-1-blue-purple/settings.webp",
  control: "/brand/mpreply-icon-pack-1-blue-purple/settings.webp",
};

export function MarketingGlyph({ variant }: MarketingGlyphProps) {
  return (
    <span className={`marketing-glyph marketing-glyph-${variant}`} aria-hidden="true">
      <Image src={GLYPH_SRC[variant]} alt="" width={512} height={512} loading="lazy" />
    </span>
  );
}

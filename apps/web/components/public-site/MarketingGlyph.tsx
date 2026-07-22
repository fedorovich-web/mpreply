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
  // Backward-compatible aliases used by existing public pages.
  | "workspace"
  | "product"
  | "automation"
  | "control";

type MarketingGlyphProps = {
  variant: MarketingGlyphVariant;
};

const GLYPH_SRC: Record<MarketingGlyphVariant, string> = {
  reviews: "/brand/respio-icon-pack-1-blue-purple/reviews.webp",
  questions: "/brand/respio-icon-pack-1-blue-purple/questions.webp",
  chats: "/brand/respio-icon-pack-1-blue-purple/chats.webp",
  flow: "/brand/respio-icon-pack-1-blue-purple/flow.webp",
  context: "/brand/respio-icon-pack-1-blue-purple/context.webp",
  settings: "/brand/respio-icon-pack-1-blue-purple/settings.webp",
  history: "/brand/respio-icon-pack-1-blue-purple/history.webp",
  recommendations: "/brand/respio-icon-pack-1-blue-purple/recommendations.webp",
  // Existing page data can keep its semantic names while using the new pack.
  workspace: "/brand/respio-icon-pack-1-blue-purple/flow.webp",
  product: "/brand/respio-icon-pack-1-blue-purple/context.webp",
  automation: "/brand/respio-icon-pack-1-blue-purple/settings.webp",
  control: "/brand/respio-icon-pack-1-blue-purple/settings.webp",
};

export function MarketingGlyph({ variant }: MarketingGlyphProps) {
  return (
    <span className={`marketing-glyph marketing-glyph-${variant}`} aria-hidden="true">
      <Image src={GLYPH_SRC[variant]} alt="" width={512} height={512} loading="lazy" />
    </span>
  );
}

import type { CSSProperties } from "react";

type BrandLogoVariant = "horizontal" | "canvas";

type BrandLogoProps = {
  variant?: BrandLogoVariant;
  className?: string;
  imageClassName?: string;
  alt?: string;
  priority?: boolean;
  style?: CSSProperties;
};

const BRAND_ASSETS: Record<
  BrandLogoVariant,
  { avif: string; webp: string; width: number; height: number }
> = {
  horizontal: {
    avif: "/logo/logo.avif",
    webp: "/logo/logo.webp",
    width: 249,
    height: 60,
  },
  canvas: {
    avif: "/logo/logo-canvas.avif",
    webp: "/logo/logo-canvas.webp",
    width: 300,
    height: 261,
  },
};

export function BrandLogo({
  variant = "horizontal",
  className,
  imageClassName,
  alt = "MP Reply",
  priority = false,
  style,
}: BrandLogoProps) {
  const asset = BRAND_ASSETS[variant];

  return (
    <picture className={className} style={style}>
      <source srcSet={asset.avif} type="image/avif" />
      <img
        className={imageClassName}
        src={asset.webp}
        alt={alt}
        width={asset.width}
        height={asset.height}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        draggable={false}
      />
    </picture>
  );
}

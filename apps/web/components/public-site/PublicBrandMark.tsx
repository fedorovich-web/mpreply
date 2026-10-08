import Image from "next/image";

export function PublicBrandMark() {
  return (
    <span className="brand-image-mark" aria-hidden="true">
      <Image src="/images/brands/mpreply-logo.webp" alt="" width={201} height={58} unoptimized />
    </span>
  );
}

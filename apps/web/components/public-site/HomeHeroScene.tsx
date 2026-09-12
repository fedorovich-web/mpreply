import Image from "next/image";

export function HomeHeroScene() {
  return (
    <div className="homepage-hero-scene">
      <Image
        alt="Интерфейс MPReply с общей очередью обращений и подготовкой ответа с помощью ИИ"
        className="homepage-hero-image"
        height={1086}
        priority
        sizes="(max-width: 1080px) 100vw, 58vw"
        src="/images/mpreply-hero.webp"
        unoptimized
        width={1448}
      />
    </div>
  );
}
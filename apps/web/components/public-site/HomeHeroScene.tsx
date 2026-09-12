import Image from "next/image";

export function HomeHeroScene() {
  return (
    <div className="homepage-hero-scene">
      <Image
        alt="Интерфейс MPReply с общей очередью обращений и подготовкой ответа с помощью ИИ"
        className="homepage-hero-image"
        height={1086}
        priority
        quality={85}
        sizes="(max-width: 480px) 118vw, (max-width: 720px) 112vw, (max-width: 1080px) 108vw, 58vw"
        src="/images/mpreply-hero.webp"
        width={1448}
      />
    </div>
  );
}
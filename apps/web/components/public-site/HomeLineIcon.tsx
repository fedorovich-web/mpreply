import Image from "next/image";

export type HomeLineIconName = "link" | "send" | "clock" | "message" | "lightning" | "users" | "sparkle" | "star" | "question" | "inbox";

const iconSources: Record<HomeLineIconName, string> = {
  link: "/images/icons/final/20-link.avif",
  send: "/images/icons/final/35-paper-plane.avif",
  clock: "/images/icons/final/16-history-clock.avif",
  message: "/images/icons/final/05-chat.avif",
  lightning: "/images/icons/final/30-speedometer.avif",
  users: "/images/icons/final/19-team-users.avif",
  sparkle: "/images/icons/final/10-ai-draft.avif",
  star: "/images/icons/final/08-rating-star-chat.avif",
  question: "/images/icons/final/09-question-chat.avif",
  inbox: "/images/icons/final/07-envelope-reply.avif",
};

export function HomeLineIcon({ name }: { name: HomeLineIconName }) {
  return <Image className="home-line-icon" src={iconSources[name]} alt="" width={128} height={128} unoptimized />;
}

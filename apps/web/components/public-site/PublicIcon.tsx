import type { CSSProperties, HTMLAttributes } from "react";

export type PublicIconName =
  | "inbox"
  | "message"
  | "search"
  | "download"
  | "check-circle"
  | "play"
  | "sparkles"
  | "shield-check"
  | "lightning"
  | "document"
  | "archive"
  | "chart"
  | "users"
  | "clock"
  | "sync"
  | "link"
  | "gear"
  | "send"
  | "vk"
  | "star";

type PublicIconProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  name: PublicIconName;
};

const iconSources: Record<PublicIconName, string> = {
  inbox: "/images/mockups/features-icons/01-unified-inbox.webp",
  message: "/images/mockups/demo-icons/01-receive-chat.webp",
  search: "/images/mockups/features-icons/01-unified-inbox.webp",
  download: "/images/mockups/wildberries-icons/01-history-actions.webp",
  "check-circle": "/images/mockups/demo-icons/04-review-send.webp",
  play: "/images/mockups/demo-icons/04-review-send.webp",
  sparkles: "/images/mockups/features-icons/02-ai-sparkles.webp",
  "shield-check": "/images/mockups/features-icons/03-quality-shield.webp",
  lightning: "/images/mockups/features-icons/04-auto-replies-lightning.webp",
  document: "/images/mockups/features-icons/05-templates-document.webp",
  archive: "/images/mockups/wildberries-icons/01-history-actions.webp",
  chart: "/images/mockups/wildberries-icons/05-analytics.webp",
  users: "/images/mockups/wildberries-icons/03-team-transparency.webp",
  clock: "/images/mockups/wildberries-icons/02-more-speed.webp",
  sync: "/images/mockups/wildberries-icons/01-history-actions.webp",
  link: "/images/mockups/wildberries-icons/01-history-actions.webp",
  gear: "/images/mockups/wildberries-icons/04-templates.webp",
  send: "/images/mockups/demo-icons/04-review-send.webp",
  vk: "/images/mockups/demo-icons/05-unified-queue-team.webp",
  star: "/images/mockups/wildberries-icons/02-more-speed.webp",
};

export function PublicIcon({
  name,
  className,
  style,
  "aria-hidden": ariaHidden,
  ...props
}: PublicIconProps) {
  const iconStyle: CSSProperties = {
    ...style,
    backgroundImage: `url("${iconSources[name]}")`,
  };

  return (
    <span
      {...props}
      aria-hidden={ariaHidden ?? true}
      className={className ? `public-icon-image ${className}` : "public-icon-image"}
      style={iconStyle}
    />
  );
}

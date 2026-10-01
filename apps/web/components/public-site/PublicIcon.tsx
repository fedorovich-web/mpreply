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
  | "star";

type PublicIconProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  name: PublicIconName;
};

const iconSources: Record<Exclude<PublicIconName, "play">, string> = {
  inbox: "/images/icons/final/07-envelope-reply.avif",
  message: "/images/icons/final/05-chat.avif",
  search: "/images/icons/final/32-search.avif",
  download: "/images/icons/final/23-cloud-download.avif",
  "check-circle": "/images/icons/final/11-document-check.avif",
  sparkles: "/images/icons/final/10-ai-draft.avif",
  "shield-check": "/images/icons/final/12-quality-shield.avif",
  lightning: "/images/icons/final/30-speedometer.avif",
  document: "/images/icons/final/06-reply-document.avif",
  archive: "/images/icons/final/21-database.avif",
  chart: "/images/icons/final/14-analytics-growth.avif",
  users: "/images/icons/final/19-team-users.avif",
  clock: "/images/icons/final/16-history-clock.avif",
  sync: "/images/icons/final/15-sync.avif",
  link: "/images/icons/final/20-link.avif",
  gear: "/images/icons/final/13-settings.avif",
  send: "/images/icons/final/35-paper-plane.avif",
  star: "/images/icons/final/08-rating-star-chat.avif",
};

export function PublicIcon({
  name,
  className,
  style,
  "aria-hidden": ariaHidden,
  ...props
}: PublicIconProps) {
  if (name === "play") {
    return (
      <span
        {...props}
        aria-hidden={ariaHidden ?? true}
        className={className ? `public-icon-image ${className}` : "public-icon-image"}
        style={style}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M10 8.5v7l6-3.5-6-3.5Z" fill="currentColor" stroke="none" />
        </svg>
      </span>
    );
  }

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

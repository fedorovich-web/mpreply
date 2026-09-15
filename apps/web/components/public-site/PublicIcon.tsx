import type { SVGProps } from "react";

export type PublicIconName =
  | "inbox"
  | "message"
  | "search"
  | "play"
  | "sparkles"
  | "shield-check"
  | "lightning"
  | "document"
  | "chart"
  | "users"
  | "clock"
  | "sync"
  | "link"
  | "gear"
  | "send"
  | "star";

type PublicIconProps = Omit<SVGProps<SVGSVGElement>, "name"> & {
  name: PublicIconName;
};

function IconPaths({ name }: { name: PublicIconName }) {
  switch (name) {
    case "inbox":
      return (
        <>
          <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
          <path d="m5 7 7 5.2L19 7" />
          <path d="m5 17 4.7-4.2M19 17l-4.7-4.2" />
        </>
      );
    case "message":
      return (
        <>
          <path d="M5.5 5.5h13a2.5 2.5 0 0 1 2.5 2.5v6.2a2.5 2.5 0 0 1-2.5 2.5h-7.4L6.2 20v-3.3h-.7A2.5 2.5 0 0 1 3 14.2V8a2.5 2.5 0 0 1 2.5-2.5Z" />
          <path d="M7.5 10h9M7.5 13.2h6.2" />
        </>
      );
    case "search":
      return (
        <>
          <circle cx="10.5" cy="10.5" r="5.5" />
          <path d="m14.6 14.6 4.2 4.2" />
        </>
      );
    case "play":
      return (
        <>
          <circle cx="12" cy="12" r="8.4" />
          <path d="m10.2 8.7 5.2 3.3-5.2 3.3V8.7Z" />
        </>
      );
    case "sparkles":
      return (
        <>
          <path d="M12 3.2c.6 3.7 2.5 5.6 6.2 6.2-3.7.6-5.6 2.5-6.2 6.2-.6-3.7-2.5-5.6-6.2-6.2C9.5 8.8 11.4 6.9 12 3.2Z" />
          <path d="M18.6 14.3c.3 1.8 1.2 2.7 3 3-1.8.3-2.7 1.2-3 3-.3-1.8-1.2-2.7-3-3 1.8-.3 2.7-1.2 3-3Z" />
          <path d="M5.2 15.4c.25 1.4.95 2.1 2.35 2.35-1.4.25-2.1.95-2.35 2.35-.25-1.4-.95-2.1-2.35-2.35 1.4-.25 2.1-.95 2.35-2.35Z" />
        </>
      );
    case "shield-check":
      return (
        <>
          <path d="M12 3.3 19 6v5.4c0 4.5-2.8 7.4-7 9.2-4.2-1.8-7-4.7-7-9.2V6l7-2.7Z" />
          <path d="m8.7 11.9 2.1 2.1 4.5-4.6" />
        </>
      );
    case "lightning":
      return <path d="m13.8 2.8-8 10.2h5.4l-1 8.2 8-10.7h-5.4l1-7.7Z" />;
    case "document":
      return (
        <>
          <path d="M6 3.5h8l4 4V20.5H6V3.5Z" />
          <path d="M14 3.5v4h4" />
          <path d="M9 11h6M9 14.5h6M9 18h4" />
        </>
      );
    case "chart":
      return (
        <>
          <path d="M4 20V5" />
          <path d="M4 20h16" />
          <path d="M7.5 17v-4M12 17V9M16.5 17V6" />
        </>
      );
    case "users":
      return (
        <>
          <circle cx="9" cy="8" r="2.7" />
          <path d="M4.5 18.5c.45-3.25 2-4.9 4.5-4.9s4.05 1.65 4.5 4.9" />
          <circle cx="16.8" cy="9.2" r="2.1" />
          <path d="M14.8 14.3c.7-.65 1.55-.95 2.55-.95 2.1 0 3.45 1.4 3.8 4.15" />
        </>
      );
    case "clock":
      return (
        <>
          <circle cx="12" cy="12" r="8.2" />
          <path d="M12 7.5V12l3.2 2" />
        </>
      );
    case "sync":
      return (
        <>
          <path d="M19.5 8.5A7.8 7.8 0 0 0 6.3 6.1L4.5 8" />
          <path d="M4.5 4.8V8H7.8" />
          <path d="M4.5 15.5a7.8 7.8 0 0 0 13.2 2.4l1.8-1.9" />
          <path d="M19.5 19.2V16h-3.3" />
        </>
      );
    case "link":
      return (
        <>
          <path d="m9.4 14.6-1.2 1.2a3.4 3.4 0 0 1-4.8-4.8l3.1-3.1a3.4 3.4 0 0 1 4.8 0" />
          <path d="m14.6 9.4 1.2-1.2a3.4 3.4 0 1 1 4.8 4.8l-3.1 3.1a3.4 3.4 0 0 1-4.8 0" />
          <path d="m8.8 15.2 6.4-6.4" />
        </>
      );
    case "gear":
      return (
        <>
          <circle cx="12" cy="12" r="3.1" />
          <path d="M12 3.3v2M12 18.7v2M3.3 12h2M18.7 12h2M5.8 5.8l1.4 1.4M16.8 16.8l1.4 1.4M18.2 5.8l-1.4 1.4M7.2 16.8l-1.4 1.4" />
          <circle cx="12" cy="12" r="6.4" />
        </>
      );
    case "send":
      return (
        <>
          <path d="m3.5 4.5 17 7.5-17 7.5 2.4-6.1L14 12l-8.1-1.4-2.4-6.1Z" />
          <path d="M5.9 10.6 14 12l-8.1 1.4" />
        </>
      );
    case "star":
      return <path d="m12 3.3 2.55 5.15 5.7.83-4.12 4.02.97 5.68L12 16.3l-5.1 2.68.97-5.68-4.12-4.02 5.7-.83L12 3.3Z" />;
  }
}

export function PublicIcon({ name, className, ...props }: PublicIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <IconPaths name={name} />
    </svg>
  );
}

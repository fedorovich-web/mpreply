"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type PublicTrialCtaProps = {
  children: ReactNode;
  className?: string;
  source?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className" | "type">;

export function PublicTrialCta({ children, className, source = "public-site", ...props }: PublicTrialCtaProps) {
  return (
    <button
      {...props}
      aria-haspopup="dialog"
      className={className}
      type="button"
      onClick={(event) => {
        props.onClick?.(event);
        if (event.defaultPrevented) return;

        window.dispatchEvent(
          new CustomEvent("respio:trial-open", {
            detail: { source },
          }),
        );
      }}
    >
      {children}
    </button>
  );
}

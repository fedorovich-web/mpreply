"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export const PUBLIC_TRIAL_POPOVER_ID = "mpreply-trial-modal";

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
      data-trial-source={source}
      popoverTarget={PUBLIC_TRIAL_POPOVER_ID}
      popoverTargetAction="show"
      type="button"
      onClick={(event) => {
        props.onClick?.(event);
        if (event.defaultPrevented) return;

        document.documentElement.dataset.mpreplyTrialSource = source;
        window.dispatchEvent(
          new CustomEvent("mpreply:trial-open", {
            detail: { source },
          }),
        );
      }}
    >
      {children}
    </button>
  );
}

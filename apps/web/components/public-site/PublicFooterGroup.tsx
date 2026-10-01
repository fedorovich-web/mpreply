"use client";

import type { ReactNode } from "react";
import { useId, useState } from "react";

type PublicFooterGroupProps = {
  title: string;
  children: ReactNode;
  className?: string;
};

export function PublicFooterDisclosure({ title, children, className = "" }: PublicFooterGroupProps) {
  const [open, setOpen] = useState(false);
  const contentId = useId();

  return (
    <div className={`public-footer-disclosure ${className}`} data-open={open}>
      <button
        className="public-footer-disclosure-trigger"
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
      >
        {title}<span className="public-footer-disclosure-chevron" aria-hidden="true" />
      </button>
      <div className="public-footer-disclosure-content" id={contentId} aria-hidden={!open} inert={!open}>
        <div className="public-footer-disclosure-links">{children}</div>
      </div>
    </div>
  );
}

export function PublicFooterGroup({ title, children, className = "" }: PublicFooterGroupProps) {
  return (
    <>
      <div className={`${className} public-footer-desktop-group`}>
        <strong>{title}</strong>
        {children}
      </div>
      <PublicFooterDisclosure title={title}>{children}</PublicFooterDisclosure>
    </>
  );
}

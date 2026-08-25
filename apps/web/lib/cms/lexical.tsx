import type { ReactNode } from "react";

import type { CMSContentDetail } from "./schema";

type LexicalNode = Record<string, unknown>;

function isNode(value: unknown): value is LexicalNode {
  return typeof value === "object" && value !== null;
}

function safeHref(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 500) {
    return null;
  }
  if (value.startsWith("/") || value.startsWith("#") || value.startsWith("mailto:")) {
    return value;
  }
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

function renderText(node: LexicalNode, key: string): ReactNode {
  if (typeof node.text !== "string") {
    return null;
  }
  const format = typeof node.format === "number" ? node.format : 0;
  let content: ReactNode = node.text;
  if (format & 1) content = <strong>{content}</strong>;
  if (format & 2) content = <em>{content}</em>;
  if (format & 4) content = <s>{content}</s>;
  if (format & 8) content = <u>{content}</u>;
  if (format & 16) content = <code>{content}</code>;
  if (format & 32) content = <sub>{content}</sub>;
  if (format & 64) content = <sup>{content}</sup>;
  return <span key={key}>{content}</span>;
}

function childrenOf(node: LexicalNode, key: string): ReactNode[] {
  if (!Array.isArray(node.children)) {
    return [];
  }
  return node.children.map((child, index) => renderNode(child, `${key}-${index}`));
}

function renderNode(value: unknown, key: string): ReactNode {
  if (!isNode(value) || typeof value.type !== "string") {
    return null;
  }
  if (value.type === "text") {
    return renderText(value, key);
  }

  const children = childrenOf(value, key);
  switch (value.type) {
    case "paragraph":
      return <p key={key}>{children}</p>;
    case "heading":
      if (value.tag === "h2") return <h2 key={key}>{children}</h2>;
      if (value.tag === "h3") return <h3 key={key}>{children}</h3>;
      if (value.tag === "h4") return <h4 key={key}>{children}</h4>;
      return null;
    case "list":
      return value.listType === "number" ? <ol key={key}>{children}</ol> : <ul key={key}>{children}</ul>;
    case "listitem":
      return <li key={key}>{children}</li>;
    case "quote":
      return <blockquote key={key}>{children}</blockquote>;
    case "link": {
      const fields = isNode(value.fields) ? value.fields : {};
      const href = safeHref(fields.url);
      if (!href) {
        return <span key={key}>{children}</span>;
      }
      const newTab = fields.newTab === true;
      return (
        <a href={href} key={key} rel="noopener noreferrer" target={newTab ? "_blank" : undefined}>
          {children}
        </a>
      );
    }
    default:
      return null;
  }
}

export function CMSRichText({ document }: { document: CMSContentDetail["body"] }) {
  return (
    <div className="cms-rich-text">
      {document.root.children.map((node, index) => renderNode(node, `cms-node-${index}`))}
    </div>
  );
}

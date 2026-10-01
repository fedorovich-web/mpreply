import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const demo = readFileSync(join(root, "app/demo/page.tsx"), "utf8");
const englishDemo = readFileSync(join(root, "app/en/demo/page.tsx"), "utf8");
const entry = readFileSync(join(root, "components/public-site/DemoEntry.tsx"), "utf8");
const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
const css = readFileSync(join(root, "styles/demo-entry.css"), "utf8");

describe("real read-only demo entry", () => {
  it("routes both locales through the same real demo entry and keeps sample pages out of indexing", () => {
    expect(demo).toContain('<DemoEntry locale="ru" />');
    expect(englishDemo).toContain('<DemoEntry locale="en" />');
    for (const source of [demo, englishDemo]) {
      expect(source).toContain("robots: { index: false, follow: false }");
      expect(source).not.toMatch(/demo-journey|demo-scenarios|demo-process|demo-team-tools/);
    }
  });
  it("validates the backend-created session and opens the real localized product dashboard", () => {
    expect(entry).toContain('apiRequest("/api/auth/demo", authSessionSchema, { method: "POST" })');
    expect(entry).toContain('router.replace(localizedPath(locale, "/app/dashboard"))');
    expect(entry).toContain("router.refresh()");
    expect(entry).not.toContain("localStorage");
  });
  it("guards automatic startup against duplicate effects", () => {
    expect(entry).toContain("const started = useRef(false)");
    expect(entry).toContain("if (started.current) return");
    expect(entry).toContain("started.current = true");
  });
  it("provides accessible live loading and recoverable error states", () => {
    for (const state of ["setError(false)", "setPending(true)", "setError(true)", "setPending(false)"]) expect(entry).toContain(state);
    expect(entry).toContain('role="alert"');
    expect(entry).toContain('role="status"');
    expect(entry).toContain("onClick={() => void open()}");
  });
  it("keeps the heading, explanation and home action in semantic live HTML", () => {
    expect(entry).toContain('<main className="demo-entry-page">');
    expect(entry).toContain('aria-labelledby="demo-entry-title"');
    expect(entry).toContain('<h1 id="demo-entry-title">{labels.title}</h1>');
    expect(entry).toContain("<p>{labels.description}</p>");
    expect(entry).toContain('href={localizedPath(locale, "/")}');
  });
  it("loads dedicated entry styling", () => {
    expect(layout).toContain('import "../styles/demo-entry.css"');
    expect(css).toContain(".demo-entry-page");
    expect(css).toContain(".demo-entry-card");
    expect(css).toContain("var(--color-brand-primary)");
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const contacts = readFileSync(join(process.cwd(), "app/contacts/page.tsx"), "utf8");

describe("contacts support routes", () => {
  it("renders the demo and account route cards as actual links", () => {
    expect(contacts).toContain('className="contact-support-route contact-support-route-demo" href="/demo"');
    expect(contacts).toContain('className="contact-support-route contact-support-route-connect" href="/auth/register?intent=connect-marketplace"');
    expect(contacts).not.toContain('<div className="contact-support-route contact-support-route-demo">');
    expect(contacts).not.toContain('<div className="contact-support-route contact-support-route-connect">');
  });
});

import { describe, expect, it } from "vitest";

import {
  canCreateContent,
  canDeleteContent,
  canPublishContent,
  canReadContent,
  canUpdateContent,
  isAdmin,
  resolveNewUserRole,
} from "../src/access/contentAccess";

function accessArgs(role?: "admin" | "editor" | "service") {
  return {
    req: {
      user: role ? { id: "user-1", role } : null,
    },
  } as never;
}

describe("CMS content access", () => {
  it("recognizes only the CMS admin role as administrative", () => {
    expect(isAdmin(accessArgs("admin"))).toBe(true);
    expect(isAdmin(accessArgs("editor"))).toBe(false);
    expect(isAdmin(accessArgs())).toBe(false);
  });

  it("lets editors create and update drafts but not publish or delete", () => {
    const editor = accessArgs("editor");

    expect(canCreateContent(editor)).toBe(true);
    expect(canUpdateContent(editor)).toBe(true);
    expect(canPublishContent(editor)).toBe(false);
    expect(canDeleteContent(editor)).toBe(false);
  });

  it("allows unauthenticated reads only for published content", () => {
    expect(canReadContent(accessArgs())).toEqual({
      _status: { equals: "published" },
    });
    expect(canReadContent(accessArgs("editor"))).toBe(true);
    expect(canReadContent(accessArgs("service"))).toEqual({
      _status: { equals: "published" },
    });
  });

  it("makes only the first CMS user an administrator by default", () => {
    expect(resolveNewUserRole({ actorRole: null, requestedRole: undefined, userCount: 0 })).toBe("admin");
    expect(resolveNewUserRole({ actorRole: "admin", requestedRole: undefined, userCount: 1 })).toBe("editor");
    expect(resolveNewUserRole({ actorRole: "admin", requestedRole: "service", userCount: 1 })).toBe("service");
    expect(() =>
      resolveNewUserRole({ actorRole: "editor", requestedRole: "admin", userCount: 1 }),
    ).toThrow("Only CMS administrators can assign roles");
  });
});

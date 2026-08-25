import {
  APIError,
  type Access,
  type FieldAccess,
  type PayloadRequest,
} from "payload";

export type CMSRole = "admin" | "editor" | "service";

function roleFromAccess(args: Parameters<Access>[0]): CMSRole | null {
  const role = (args.req.user as { role?: unknown } | null)?.role;
  return role === "admin" || role === "editor" || role === "service" ? role : null;
}

export const isAdmin: Access = (args) => roleFromAccess(args) === "admin";

export const canUseAdmin = ({ req }: { req: PayloadRequest }): boolean => {
  const role = (req.user as { role?: unknown } | null)?.role;
  return role === "admin" || role === "editor";
};

export const canCreateContent: Access = (args) => {
  const role = roleFromAccess(args);
  return role === "admin" || role === "editor";
};

export const canUpdateContent: Access = canCreateContent;

export const canDeleteContent: Access = isAdmin;

export const canPublishContent: Access = isAdmin;

export const canReadContent: Access = (args) => {
  const role = roleFromAccess(args);
  if (role === "admin" || role === "editor") {
    return true;
  }

  return {
    _status: {
      equals: "published",
    },
  };
};

export const canReadAuthenticated: Access = (args) => roleFromAccess(args) !== null;

export const canAssignRoles: FieldAccess = ({ req }) =>
  !req.user || (req.user as { role?: unknown }).role === "admin";

export const isAdminField: FieldAccess = ({ req }) =>
  (req.user as { role?: unknown } | null)?.role === "admin";

export function resolveNewUserRole({
  actorRole,
  requestedRole,
  userCount,
}: {
  actorRole: CMSRole | null;
  requestedRole: CMSRole | undefined;
  userCount: number;
}): CMSRole {
  if (userCount === 0) {
    return "admin";
  }
  if (actorRole !== "admin") {
    throw new APIError("Only CMS administrators can assign roles", 403);
  }
  return requestedRole ?? "editor";
}

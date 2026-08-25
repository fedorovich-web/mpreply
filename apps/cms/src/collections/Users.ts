import type { CollectionConfig } from "payload";

import {
  canAssignRoles,
  canUseAdmin,
  isAdmin,
  isAdminField,
  resolveNewUserRole,
  type CMSRole,
} from "../access/contentAccess";

export const Users: CollectionConfig = {
  slug: "users",
  auth: {
    tokenExpiration: 60 * 60 * 8,
  },
  admin: {
    useAsTitle: "email",
  },
  access: {
    admin: canUseAdmin,
    create: isAdmin,
    delete: isAdmin,
    read: ({ req }) => {
      const user = req.user as { id?: string; role?: string } | null;
      if (user?.role === "admin") {
        return true;
      }
      return user?.id ? { id: { equals: user.id } } : false;
    },
    update: ({ req }) => {
      const user = req.user as { id?: string; role?: string } | null;
      if (user?.role === "admin") {
        return true;
      }
      return user?.id ? { id: { equals: user.id } } : false;
    },
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        if (operation !== "create") {
          return data;
        }
        const { totalDocs } = await req.payload.count({ collection: "users" });
        const actorRole = (req.user as { role?: CMSRole } | null)?.role ?? null;
        data.role = resolveNewUserRole({
          actorRole,
          requestedRole: data.role as CMSRole | undefined,
          userCount: totalDocs,
        });
        return data;
      },
    ],
  },
  fields: [
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: "editor",
      access: {
        create: canAssignRoles,
        update: isAdminField,
      },
      options: [
        { label: "Администратор", value: "admin" },
        { label: "Редактор", value: "editor" },
        { label: "Сервис чтения", value: "service" },
      ],
    },
  ],
};

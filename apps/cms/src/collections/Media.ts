import type { CollectionConfig } from "payload";

import {
  canCreateContent,
  canReadAuthenticated,
  canUpdateContent,
  isAdmin,
} from "../access/contentAccess";

export const Media: CollectionConfig = {
  slug: "media",
  access: {
    create: canCreateContent,
    delete: isAdmin,
    read: canReadAuthenticated,
    update: canUpdateContent,
  },
  upload: {
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
    staticDir: "uploads",
  },
  fields: [
    {
      name: "alt",
      type: "text",
      required: true,
      maxLength: 240,
    },
  ],
};

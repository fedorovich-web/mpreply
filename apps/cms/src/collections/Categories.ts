import type { CollectionConfig, TextFieldValidation } from "payload";

import { canReadAuthenticated, isAdmin } from "../access/contentAccess";

const validateSlug: TextFieldValidation = (value) => {
  if (typeof value !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    return "Slug должен содержать только строчные латинские буквы, цифры и дефисы";
  }
  return true;
};

export const Categories: CollectionConfig = {
  slug: "categories",
  admin: {
    useAsTitle: "name",
  },
  access: {
    create: isAdmin,
    delete: isAdmin,
    read: canReadAuthenticated,
    update: isAdmin,
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      maxLength: 120,
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
      maxLength: 96,
      validate: validateSlug,
    },
    {
      name: "description",
      type: "textarea",
      maxLength: 320,
    },
  ],
};

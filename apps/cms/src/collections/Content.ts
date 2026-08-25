import { lexicalEditor } from "@payloadcms/richtext-lexical";
import type { CollectionConfig, TextFieldValidation } from "payload";

import {
  canCreateContent,
  canDeleteContent,
  canReadContent,
  canUpdateContent,
} from "../access/contentAccess";
import { enforcePublicationPolicy, revalidateContent } from "../hooks/revalidateContent";

const validateSlug: TextFieldValidation = (value) => {
  if (typeof value !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    return "Slug должен содержать только строчные латинские буквы, цифры и дефисы";
  }
  return true;
};

export const Content: CollectionConfig = {
  slug: "content",
  admin: {
    defaultColumns: ["title", "kind", "editorialState", "_status", "updatedAt"],
    useAsTitle: "title",
  },
  access: {
    create: canCreateContent,
    delete: canDeleteContent,
    read: canReadContent,
    readVersions: canReadContent,
    update: canUpdateContent,
  },
  hooks: {
    beforeChange: [enforcePublicationPolicy],
    afterChange: [revalidateContent],
  },
  versions: {
    drafts: {
      autosave: true,
      schedulePublish: true,
      validate: true,
    },
    maxPerDoc: 50,
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      maxLength: 180,
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
      maxLength: 120,
      validate: validateSlug,
    },
    {
      name: "excerpt",
      type: "textarea",
      required: true,
      maxLength: 420,
    },
    {
      name: "body",
      type: "richText",
      required: true,
      editor: lexicalEditor(),
    },
    {
      name: "kind",
      type: "select",
      required: true,
      index: true,
      options: [
        { label: "Статья", value: "article" },
        { label: "Гайд", value: "guide" },
        { label: "Чек-лист", value: "checklist" },
        { label: "Методика", value: "methodology" },
        { label: "Шаблон", value: "template" },
      ],
    },
    {
      name: "category",
      type: "relationship",
      relationTo: "categories",
      required: true,
    },
    {
      name: "marketplaces",
      type: "select",
      hasMany: true,
      options: [
        { label: "Wildberries", value: "wildberries" },
        { label: "Ozon", value: "ozon" },
        { label: "Яндекс Маркет", value: "yandex-market" },
        { label: "Авито", value: "avito" },
      ],
    },
    {
      name: "cover",
      type: "upload",
      relationTo: "media",
    },
    {
      name: "authorName",
      type: "text",
      maxLength: 120,
    },
    {
      name: "editorialState",
      type: "select",
      required: true,
      defaultValue: "draft",
      index: true,
      options: [
        { label: "Черновик", value: "draft" },
        { label: "На проверке", value: "in_review" },
        { label: "Одобрен", value: "approved" },
      ],
    },
    {
      name: "seo",
      type: "group",
      fields: [
        {
          name: "title",
          type: "text",
          required: true,
          maxLength: 180,
        },
        {
          name: "description",
          type: "textarea",
          required: true,
          maxLength: 320,
        },
        {
          name: "canonical",
          type: "text",
          maxLength: 300,
        },
        {
          name: "noindex",
          type: "checkbox",
          defaultValue: false,
        },
      ],
    },
  ],
};
